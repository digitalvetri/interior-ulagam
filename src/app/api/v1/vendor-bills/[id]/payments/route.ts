import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sum } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses, vendorPayments, purchaseOrders } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const RecordPaymentSchema = z.object({
  amountPaise: z.number().int().positive('Amount must be a positive integer in paise'),
  method:      z.string().optional(),
  reference:   z.string().optional(),
  note:        z.string().optional(),
  paidAt:      z.string().datetime().optional(),
});

// POST /api/v1/vendor-bills/[id]/payments
// Records a vendor_payment specifically against this bill (expense_id = bill.id).
// Also syncs purchaseOrders.advancePaidPaise and marks expenses.paidAt when fully paid.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: billId } = await params;

  // Load the bill
  const [bill] = await db
    .select({
      id:             expenses.id,
      poId:           expenses.poId,
      voidedAt:       expenses.voidedAt,
      amountPaise:    expenses.amountPaise,
      gstAmountPaise: expenses.gstAmountPaise,
    })
    .from(expenses)
    .where(and(eq(expenses.id, billId), eq(expenses.tenantId, ctx.tenantId)))
    .limit(1);

  if (!bill)          return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
  if (bill.voidedAt)  return NextResponse.json({ error: 'Cannot pay a voided bill' }, { status: 409 });
  if (!bill.poId)     return NextResponse.json({ error: 'Bill is not linked to a purchase order' }, { status: 400 });

  // Validate PO exists and belongs to tenant
  const [po] = await db
    .select({ id: purchaseOrders.id, vendorId: purchaseOrders.vendorId, status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, bill.poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!po) return NextResponse.json({ error: 'Linked purchase order not found' }, { status: 404 });
  if (po.status === 'cancelled') return NextResponse.json({ error: 'Cannot pay against a cancelled PO' }, { status: 409 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = RecordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { amountPaise, method, reference, note, paidAt } = parsed.data;

  // Check remaining balance
  const [{ alreadyPaid }] = await db
    .select({ alreadyPaid: sum(vendorPayments.amountPaise) })
    .from(vendorPayments)
    .where(and(eq(vendorPayments.expenseId, billId), eq(vendorPayments.tenantId, ctx.tenantId)));

  const billTotal    = bill.amountPaise + bill.gstAmountPaise;
  const paidSoFar    = Number(alreadyPaid ?? 0);
  const remaining    = Math.max(0, billTotal - paidSoFar);

  if (amountPaise > remaining) {
    return NextResponse.json({
      error: `Payment of ₹${(amountPaise / 100).toLocaleString('en-IN')} exceeds remaining balance of ₹${(remaining / 100).toLocaleString('en-IN')}`,
    }, { status: 422 });
  }

  // Idempotency check on (PO, reference)
  if (reference?.trim()) {
    const [dup] = await db
      .select({ id: vendorPayments.id })
      .from(vendorPayments)
      .where(and(
        eq(vendorPayments.purchaseOrderId, bill.poId),
        eq(vendorPayments.reference, reference.trim()),
        eq(vendorPayments.tenantId, ctx.tenantId),
      ))
      .limit(1);

    if (dup) {
      return NextResponse.json({ error: `Payment with reference "${reference.trim()}" already recorded` }, { status: 409 });
    }
  }

  // Insert the vendor payment, linking it to both the bill and the PO
  const [inserted] = await db
    .insert(vendorPayments)
    .values({
      tenantId:        ctx.tenantId,
      vendorId:        po.vendorId ?? null,
      purchaseOrderId: bill.poId,
      expenseId:       billId,
      amountPaise,
      method:    method    ?? null,
      reference: reference ?? null,
      note:      note      ?? null,
      paidAt:    paidAt ? new Date(paidAt) : new Date(),
    })
    .returning();

  // Sync purchaseOrders.advancePaidPaise (all payments for this PO, allocated + advance)
  const allPoPayments = await db
    .select({ amountPaise: vendorPayments.amountPaise })
    .from(vendorPayments)
    .where(and(
      eq(vendorPayments.purchaseOrderId, bill.poId),
      eq(vendorPayments.tenantId, ctx.tenantId),
    ));

  const totalPaidForPo = allPoPayments.reduce((s, p) => s + p.amountPaise, 0);

  await db
    .update(purchaseOrders)
    .set({ advancePaidPaise: totalPaidForPo })
    .where(and(eq(purchaseOrders.id, bill.poId), eq(purchaseOrders.tenantId, ctx.tenantId)));

  // Mark the bill as paid if now fully settled
  const newPaidTotal = paidSoFar + amountPaise;
  if (newPaidTotal >= billTotal) {
    await db
      .update(expenses)
      .set({ paidAt: inserted.paidAt })
      .where(and(eq(expenses.id, billId), eq(expenses.tenantId, ctx.tenantId)));
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}
