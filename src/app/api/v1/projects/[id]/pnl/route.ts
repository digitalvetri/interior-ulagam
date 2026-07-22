import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, quotes, quoteLines, invoices, payments, expenses } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { PnLSummary } from '@/types/accounts';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Verify project belongs to this tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // a. Get approved quote IDs for project
    const approvedQuotes = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.projectId, projectId), eq(quotes.status, 'approved')));

    const approvedQuoteIds = approvedQuotes.map((q) => q.id);

    // b. Sum quoteLines for approved quotes
    let totalClientPaise = 0;
    let totalCostPaise = 0;
    let totalMarginPaise = 0;

    if (approvedQuoteIds.length > 0) {
      const [lineSums] = await db
        .select({
          totalClientPaise: sql<string>`COALESCE(SUM(${quoteLines.clientRatePaise} * ${quoteLines.qty}), 0)`,
          totalCostPaise: sql<string>`COALESCE(SUM(${quoteLines.costRatePaise} * ${quoteLines.qty}), 0)`,
          totalMarginPaise: sql<string>`COALESCE(SUM(${quoteLines.marginPaise}), 0)`,
        })
        .from(quoteLines)
        .where(inArray(quoteLines.quoteId, approvedQuoteIds));

      totalClientPaise = Number(lineSums?.totalClientPaise ?? 0);
      totalCostPaise = Number(lineSums?.totalCostPaise ?? 0);
      totalMarginPaise = Number(lineSums?.totalMarginPaise ?? 0);
    }

    // c. Get captured payments for this project's invoices
    // payments → invoices → projectId (payments has no direct projectId)
    const projectInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.projectId, projectId), eq(invoices.tenantId, ctx.tenantId)));

    const projectInvoiceIds = projectInvoices.map((inv) => inv.id);

    let totalPaidPaise = 0;
    if (projectInvoiceIds.length > 0) {
      const [paymentSums] = await db
        .select({
          totalPaidPaise: sql<string>`COALESCE(SUM(${payments.amountPaise}), 0)`,
        })
        .from(payments)
        .where(
          and(
            inArray(payments.invoiceId, projectInvoiceIds),
            eq(payments.tenantId, ctx.tenantId),
            sql`${payments.status} = 'captured'`,
          ),
        );

      totalPaidPaise = Number(paymentSums?.totalPaidPaise ?? 0);
    }

    // d. Get expenses for project
    const [expenseSums] = await db
      .select({
        totalExpensesPaise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
      })
      .from(expenses)
      .where(and(eq(expenses.projectId, projectId), eq(expenses.tenantId, ctx.tenantId)));

    const totalExpensesPaise = Number(expenseSums?.totalExpensesPaise ?? 0);

    // e. Derived fields
    const receivablePaise = totalClientPaise - totalPaidPaise;
    const actualMarginPaise = totalPaidPaise - totalExpensesPaise;

    const summary: PnLSummary = {
      projectId,
      totalClientPaise,
      totalCostPaise,
      totalMarginPaise,
      totalPaidPaise,
      totalExpensesPaise,
      receivablePaise,
      actualMarginPaise,
    };

    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error('[projects/:id/pnl GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
