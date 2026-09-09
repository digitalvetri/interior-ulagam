import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
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
    .select({ id: purchaseOrders.id, vendorId: purchaseOrders.vendorId })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = RecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 422 });
  }

  const { amountPaise, method, reference, note, paidAt } = parsed.data;

  const [inserted] = await db
    .insert(vendorPayments)
    .values({
      tenantId:       ctx.tenantId,
      vendorId:       po.vendorId ?? undefined,
      purchaseOrderId: poId,
      amountPaise,
      method:    method ?? null,
      reference: reference ?? null,
      note:      note ?? null,
      paidAt:    paidAt ? new Date(paidAt) : new Date(),
    })
    .returning();

  return NextResponse.json({ data: inserted }, { status: 201 });
}
