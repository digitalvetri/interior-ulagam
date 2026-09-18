import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices, expenses, projects, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/finance/gst?year=2026&month=9
// Returns output tax (issued invoices) and input credit (expenses) for the month.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const year  = parseInt(sp.get('year')  ?? String(new Date().getFullYear()), 10);
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1), 10);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  const monthStart = new Date(year, month - 1, 1).toISOString();
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  try {
    // ── Output tax (invoices issued in this month, excluding draft/void) ──────
    const outputRows = await db
      .select({
        id:            invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issuedAt:      invoices.issuedAt,
        status:        invoices.status,
        isInterstate:  invoices.isInterstate,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise:     invoices.cgstPaise,
        sgstPaise:     invoices.sgstPaise,
        igstPaise:     invoices.igstPaise,
        hsnSacLinesJson: invoices.hsnSacLinesJson,
        projectName:   projects.name,
        clientName:    customers.fullName,
      })
      .from(invoices)
      .leftJoin(projects,   eq(invoices.projectId,    projects.id))
      .leftJoin(customers,  eq(projects.customerId,   customers.id))
      .where(and(
        eq(invoices.tenantId, ctx.tenantId),
        sql`${invoices.status} NOT IN ('draft', 'void')`,
        gte(invoices.issuedAt, new Date(monthStart)),
        lte(invoices.issuedAt, new Date(monthEnd)),
      ))
      .orderBy(invoices.issuedAt);

    // ── Input credit (expenses with GST in this month, by COALESCE(paidAt, createdAt)) ──
    const inputRows = await db
      .select({
        id:             expenses.id,
        expenseNumber:  expenses.expenseNumber,
        description:    expenses.description,
        category:       expenses.category,
        gstPct:         expenses.gstPct,
        amountPaise:    expenses.amountPaise,
        gstAmountPaise: expenses.gstAmountPaise,
        paidAt:         expenses.paidAt,
        createdAt:      expenses.createdAt,
      })
      .from(expenses)
      .where(and(
        eq(expenses.tenantId, ctx.tenantId),
        sql`${expenses.gstPct} > 0`,
        sql`COALESCE(${expenses.paidAt}, ${expenses.createdAt}) >= ${monthStart}`,
        sql`COALESCE(${expenses.paidAt}, ${expenses.createdAt}) <= ${monthEnd}`,
      ))
      .orderBy(expenses.createdAt);

    const totalOutput = outputRows.reduce((s, r) => s + r.cgstPaise + r.sgstPaise + r.igstPaise, 0);
    const totalInput  = inputRows.reduce((s, r) => s + r.gstAmountPaise, 0);
    const cgst = outputRows.reduce((s, r) => s + r.cgstPaise, 0);
    const sgst = outputRows.reduce((s, r) => s + r.sgstPaise, 0);
    const igst = outputRows.reduce((s, r) => s + r.igstPaise, 0);

    return NextResponse.json({
      data: {
        year, month,
        summary: {
          outputPaise: totalOutput,
          inputPaise:  totalInput,
          netPaise:    totalOutput - totalInput,
          cgstPaise:   cgst,
          sgstPaise:   sgst,
          igstPaise:   igst,
        },
        outputRows: outputRows.map(r => ({
          ...r,
          issuedAt:  r.issuedAt?.toISOString() ?? null,
        })),
        inputRows: inputRows.map(r => ({
          ...r,
          paidAt:    r.paidAt?.toISOString()    ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/v1/finance/gst]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
