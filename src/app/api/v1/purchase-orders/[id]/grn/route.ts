import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { grns, purchaseOrders } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql, sum } from 'drizzle-orm';

const CreateGRNSchema = z.object({
  lineId: z.string().uuid().optional(),
  deliveredQty: z.number().int().positive(),
  photoProof: z.array(z.string().url()).optional(),
  notes: z.string().optional(),
});

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
    // Verify the PO belongs to this tenant
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(grns)
      .where(and(eq(grns.poId, id), eq(grns.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[purchase-orders/:id/grn GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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

  const parsed = CreateGRNSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify the PO belongs to this tenant before creating GRN
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const [grn] = await db
      .insert(grns)
      .values({
        tenantId: ctx.tenantId,
        poId: id,
        lineId: input.lineId ?? null,
        deliveredQty: input.deliveredQty,
        photoProof: input.photoProof ?? [],
        receivedAt: sql`now()`,
        notes: input.notes ?? null,
      })
      .returning();

    // Auto-update PO status based on total delivered vs ordered qty
    if (po.status !== 'cancelled' && po.status !== 'draft') {
      const lines = Array.isArray(po.linesJson)
        ? (po.linesJson as Record<string, unknown>[])
        : [];
      const totalOrdered = lines.reduce<number>((s, l) => {
        const qty = typeof l.qty === 'number' ? l.qty : 0;
        return s + qty;
      }, 0);

      const [deliveredRow] = await db
        .select({ total: sum(grns.deliveredQty) })
        .from(grns)
        .where(and(eq(grns.poId, id), eq(grns.tenantId, ctx.tenantId)));

      const totalDelivered = Number(deliveredRow?.total ?? 0);

      if (totalOrdered > 0) {
        const newStatus = totalDelivered >= totalOrdered ? 'complete' : 'partial';
        await db
          .update(purchaseOrders)
          .set({ status: newStatus })
          .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));
      }
    }

    return NextResponse.json({ data: grn, message: 'GRN recorded' }, { status: 201 });
  } catch (err) {
    console.error('[purchase-orders/:id/grn POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
