import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices, payments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// Manual payment recording — used when a client pays outside the Razorpay
// flow (cash, cheque, bank transfer confirmed by hand). The frontend is
// responsible for disabling the submit button while pending to prevent
// duplicate rows (no server-side idempotency key on manual entries).
const RecordManualPaymentSchema = z.object({
  amountPaise: z.number().int().positive().max(1_000_000_00_000), // ₹10 Cr cap
  note: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RecordManualPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Verify invoice belongs to caller's tenant and fetch totals for status update.
    const [invoice] = await db
      .select({
        id:            invoices.id,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise:     invoices.cgstPaise,
        sgstPaise:     invoices.sgstPaise,
        igstPaise:     invoices.igstPaise,
      })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const [inserted] = await db
      .insert(payments)
      .values({
        tenantId:           ctx.tenantId,
        invoiceId:          id,
        amountPaise:        parsed.data.amountPaise,
        status:             'captured',
        reconciledAt:       new Date(),
        manualOverrideBy:   ctx.dbUserId,
        manualOverrideNote: parsed.data.note,
      })
      .returning();

    // Update invoice lifecycle status based on total captured payments.
    const totalInvoicePaise =
      invoice.subtotalPaise + invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;

    const [{ paidPaise }] = await db
      .select({ paidPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.invoiceId, id), ne(payments.status, 'pending')));

    const newStatus =
      paidPaise >= totalInvoicePaise ? 'paid' :
      paidPaise > 0                  ? 'part_paid' : 'issued';

    await db
      .update(invoices)
      .set({ status: newStatus })
      .where(eq(invoices.id, id));

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err) {
    console.error('[invoices/:id/payments POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
