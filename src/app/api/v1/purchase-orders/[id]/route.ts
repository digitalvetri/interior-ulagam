import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseOrders } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

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

    return NextResponse.json({ data: po });
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

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdatePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const updateValues: Partial<typeof purchaseOrders.$inferInsert> = {};

    if (input.status !== undefined) updateValues.status = input.status;
    if (input.advancePaidPaise !== undefined) updateValues.advancePaidPaise = input.advancePaidPaise;
    if (input.linesJson !== undefined) updateValues.linesJson = input.linesJson;
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

    await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    return NextResponse.json({ message: 'Purchase order deleted' });
  } catch (err) {
    console.error('[purchase-orders/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
