import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { payments, invoices, projects, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, ne, sql } from 'drizzle-orm';
import { nextReceiptNumber } from '@/lib/finance/receipt-number';
import { PAYMENT_SETTLED } from '@/lib/finance/constants';

const PAYMENT_MODES = ['upi', 'cash', 'bank', 'cheque', 'card', 'razorpay'] as const;

const CreatePaymentSchema = z.object({
  amountPaise:  z.number().int().positive(),
  mode:         z.enum(PAYMENT_MODES),
  reference:    z.string().max(200).optional(),
  receivedAt:   z.string().datetime().optional(), // ISO; defaults to now
  note:         z.string().max(500).optional(),
  invoiceId:    z.string().uuid().optional().nullable(),
  projectId:    z.string().uuid().optional().nullable(),
  customerId:   z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectIdParam = searchParams.get('projectId');
  const limitParam     = searchParams.get('limit');
  const limit          = Math.min(parseInt(limitParam ?? '500', 10) || 500, 1000);

  const COLS = {
    id:            payments.id,
    receiptNumber: payments.receiptNumber,
    receivedAt:    payments.receivedAt,
    createdAt:     payments.createdAt,
    amountPaise:   payments.amountPaise,
    status:        payments.status,
    mode:          payments.mode,
    reference:     payments.reference,
    note:          payments.note,
    invoiceId:     payments.invoiceId,
    projectId:     payments.projectId,
    customerId:    payments.customerId,
    invoiceNumber: invoices.invoiceNumber,
    projectName:   projects.name,
    clientName:    customers.fullName,
  };

  try {
    if (projectIdParam) {
      // Project-scoped: payments whose invoice belongs to this project, or direct projectId match
      const rows = await db
        .select(COLS)
        .from(payments)
        .leftJoin(invoices,  eq(payments.invoiceId, invoices.id))
        .leftJoin(projects,  sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projects.id}`)
        .leftJoin(customers, sql`COALESCE(${projects.customerId}, ${payments.customerId}) = ${customers.id}`)
        .where(and(
          eq(payments.tenantId, ctx.tenantId),
          sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projectIdParam}::uuid`,
        ))
        .orderBy(desc(payments.createdAt));
      return NextResponse.json({ data: rows });
    }

    // All payments for tenant — enriched with client/project/invoice names
    const q = db
      .select(COLS)
      .from(payments)
      .leftJoin(invoices,  eq(payments.invoiceId, invoices.id))
      .leftJoin(projects,  sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projects.id}`)
      .leftJoin(customers, sql`COALESCE(${projects.customerId}, ${payments.customerId}) = ${customers.id}`)
      .where(eq(payments.tenantId, ctx.tenantId))
      .orderBy(desc(payments.createdAt));

    const rows = await q.limit(limit);
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[payments GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  try {
    // Verify invoice belongs to this tenant if supplied; fetch totals for status update.
    let invoiceTotals: { subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number } | null = null;
    if (d.invoiceId) {
      const [inv] = await db
        .select({
          tenantId:      invoices.tenantId,
          subtotalPaise: invoices.subtotalPaise,
          cgstPaise:     invoices.cgstPaise,
          sgstPaise:     invoices.sgstPaise,
          igstPaise:     invoices.igstPaise,
        })
        .from(invoices).where(eq(invoices.id, d.invoiceId)).limit(1);
      if (!inv || inv.tenantId !== ctx.tenantId) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
      invoiceTotals = inv;
    }

    const receiptNumber = await nextReceiptNumber(ctx.tenantId);
    const receivedAt    = d.receivedAt ? new Date(d.receivedAt) : new Date();

    const [row] = await db.insert(payments).values({
      tenantId:    ctx.tenantId,
      invoiceId:   d.invoiceId ?? null,
      projectId:   d.projectId ?? null,
      customerId:  d.customerId ?? null,
      amountPaise: d.amountPaise,
      status:      PAYMENT_SETTLED,
      mode:        d.mode,
      reference:   d.reference ?? null,
      receivedAt,
      recordedBy:  ctx.userId,
      note:        d.note ?? null,
      receiptNumber,
    }).returning();

    // Keep invoice lifecycle status in sync when this payment is linked to an invoice.
    if (d.invoiceId && invoiceTotals) {
      const totalInvoicePaise =
        invoiceTotals.subtotalPaise + invoiceTotals.cgstPaise +
        invoiceTotals.sgstPaise    + invoiceTotals.igstPaise;

      const [{ paidPaise }] = await db
        .select({ paidPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number) })
        .from(payments)
        .where(and(eq(payments.invoiceId, d.invoiceId), ne(payments.status, 'pending')));

      const newStatus =
        paidPaise >= totalInvoicePaise ? 'paid' :
        paidPaise > 0                  ? 'part_paid' : 'issued';

      await db
        .update(invoices)
        .set({ status: newStatus })
        .where(eq(invoices.id, d.invoiceId));
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[payments POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
