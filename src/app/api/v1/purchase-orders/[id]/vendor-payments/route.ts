import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, desc, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vendorPayments, purchaseOrders } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const RecordSchema = z.object({
  amountPaise: z.number().int().positive(),
  method:    z.string().optional(),
  reference: z.string().optional(),
  note:      z.string().optional(),
  paidAt:    z.string().datetime().optional(),
});

// GET /api/v1/purchase-orders/[id]/vendor-payments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: poId } = await params;

  const [po] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await db
    .select()
    .from(vendorPayments)
    .where(
      and(
        eq(vendorPayments.purchaseOrderId, poId),
        eq(vendorPayments.tenantId, ctx.tenantId),
      ),
    )
    .orderBy(desc(vendorPayments.paidAt));

  return NextResponse.json({ data: rows });
}

// POST /api/v1/purchase-orders/[id]/vendor-payments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: poId } = await params;

  const [po] = await db
    .select({
      id:       purchaseOrders.id,
      vendorId: purchaseOrders.vendorId,
      status:   purchaseOrders.status,
    })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (po.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record payment for a cancelled PO' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 422 });
  }

  const { amountPaise, method, reference, note, paidAt } = parsed.data;

  // Idempotency: if reference provided, reject duplicates on same PO
  if (reference?.trim()) {
    const [existing] = await db
      .select({ id: vendorPayments.id })
      .from(vendorPayments)
      .where(
        and(
          eq(vendorPayments.purchaseOrderId, poId),
          eq(vendorPayments.reference, reference.trim()),
          eq(vendorPayments.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `Payment with reference "${reference.trim()}" already recorded for this PO` },
        { status: 409 },
      );
    }
  }

  const [inserted] = await db
    .insert(vendorPayments)
    .values({
      tenantId:        ctx.tenantId,
      vendorId:        po.vendorId ?? undefined,
      purchaseOrderId: poId,
      amountPaise,
      method:    method    ?? null,
      reference: reference ?? null,
      note:      note      ?? null,
      paidAt:    paidAt ? new Date(paidAt) : new Date(),
    })
    .returning();

  // Sync advancePaidPaise from actual vendor_payments totals (do not touch status — GRN drives that)
  const allPayments = await db
    .select({ amountPaise: vendorPayments.amountPaise })
    .from(vendorPayments)
    .where(
      and(
        eq(vendorPayments.purchaseOrderId, poId),
        eq(vendorPayments.tenantId, ctx.tenantId),
      ),
    );

  const totalPaidPaise = allPayments.reduce((s, p) => s + p.amountPaise, 0);

  await db
    .update(purchaseOrders)
    .set({ advancePaidPaise: totalPaidPaise })
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, ctx.tenantId),
        ne(purchaseOrders.status, 'cancelled'),
      ),
    );

  return NextResponse.json({ data: inserted }, { status: 201 });
}
