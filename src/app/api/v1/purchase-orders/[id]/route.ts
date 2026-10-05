import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseOrders, vendors, projects, grns, expenses, vendorPayments } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, isNotNull, count } from 'drizzle-orm';
import { withServerLineIds } from '@/lib/procurement/line-ids';

const PO_STATUSES = [
  'draft',
  'sent',
  'acknowledged',
  'partial',
  'complete',
  'cancelled',
] as const;

const UpdatePurchaseOrderSchema = z
  .object({
    status: z.enum(PO_STATUSES).optional(),
    advancePaidPaise: z.number().int().nonnegative().optional(),
    linesJson: z.array(z.record(z.unknown())).optional(),
    expectedDeliveryAt: z.string().datetime().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Enrich with vendor and project names
    const [vendorRow, projectRow] = await Promise.all([
      po.vendorId
        ? db.select({ name: vendors.name, phone: vendors.phone }).from(vendors).where(eq(vendors.id, po.vendorId)).then(r => r[0] ?? null)
        : null,
      po.projectId
        ? db.select({ name: projects.name }).from(projects).where(eq(projects.id, po.projectId)).then(r => r[0] ?? null)
        : null,
    ]);

    return NextResponse.json({
      data: {
        ...po,
        vendorName: vendorRow?.name ?? null,
        vendorPhone: po.vendorPhone ?? vendorRow?.phone ?? null,
        projectName: projectRow?.name ?? null,
      },
    });
  } catch (err) {
    console.error('[purchase-orders/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Procurement staff move a PO through its workflow (send / acknowledge /
  // cancel) and edit its lines; the advance figure is money, so owner-only.
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdatePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (input.advancePaidPaise !== undefined) {
    const ownerOnly = requireApiRole(ctx, ROLES.OWNER_ONLY);
    if (ownerOnly) return ownerOnly;
  }

  try {
    const [existing] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // A line that already has goods received against it can't be removed —
    // its GRN rows would point at nothing and the PO would mis-report receipt.
    if (input.linesJson !== undefined) {
      const keptIds = new Set(
        input.linesJson.map((l) => (typeof l.id === 'string' ? l.id : null)).filter((x): x is string => !!x),
      );
      const received = await db
        .selectDistinct({ lineId: grns.lineId })
        .from(grns)
        .where(and(
          eq(grns.poId, id),
          eq(grns.tenantId, ctx.tenantId),
          eq(grns.status, 'active'),
          isNotNull(grns.lineId),
        ));
      const dropped = received.filter((r) => r.lineId && !keptIds.has(r.lineId));
      if (dropped.length > 0) {
        return NextResponse.json(
          { error: 'A line with goods already received can’t be removed from this order. Void its GRN first or keep the line.' },
          { status: 409 },
        );
      }
    }

    const updateValues: Partial<typeof purchaseOrders.$inferInsert> = {};

    if (input.status !== undefined) updateValues.status = input.status;
    if (input.advancePaidPaise !== undefined) updateValues.advancePaidPaise = input.advancePaidPaise;
    if (input.linesJson !== undefined) updateValues.linesJson = withServerLineIds(input.linesJson);
    if (input.expectedDeliveryAt !== undefined) {
      updateValues.expectedDeliveryAt = new Date(input.expectedDeliveryAt);
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set(updateValues)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated, message: 'Purchase order updated' });
  } catch (err) {
    console.error('[purchase-orders/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Only drafts can be hard-deleted. Anything that's already been sent, acknowledged,
    // delivered, or completed must be cancelled via status change so we keep the audit trail.
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft orders can be deleted. Cancel this order instead to preserve history.' },
        { status: 409 },
      );
    }

    // A draft can still carry deliveries or vendor bills; deleting it would
    // cascade the GRNs away and orphan the bills. Cancel instead.
    const [[grnCount], [billCount], [paymentCount]] = await Promise.all([
      db.select({ n: count() }).from(grns)
        .where(and(eq(grns.poId, id), eq(grns.tenantId, ctx.tenantId))),
      db.select({ n: count() }).from(expenses)
        .where(and(eq(expenses.poId, id), eq(expenses.tenantId, ctx.tenantId))),
      db.select({ n: count() }).from(vendorPayments)
        .where(and(eq(vendorPayments.purchaseOrderId, id), eq(vendorPayments.tenantId, ctx.tenantId))),
    ]);
    if (Number(grnCount?.n ?? 0) > 0 || Number(billCount?.n ?? 0) > 0 || Number(paymentCount?.n ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This order has goods receipts, vendor bills or payments recorded against it. Cancel it instead of deleting.' },
        { status: 409 },
      );
    }

    await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    return NextResponse.json({ message: 'Purchase order deleted' });
  } catch (err) {
    console.error('[purchase-orders/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
