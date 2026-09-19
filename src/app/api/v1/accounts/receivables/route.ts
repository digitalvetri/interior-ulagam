import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, payments, projects, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, ne, sql, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const overdueOnly = searchParams.get('overdueOnly') === 'true';

  try {
    const now = Date.now();

    // All non-void, non-draft invoices for this tenant.
    // Outstanding is computed from the payments table, not the status field,
    // so stale statuses don't cause false positives.
    const invRows = await db
      .select({
        id:              invoices.id,
        projectId:       invoices.projectId,
        projectName:     projects.name,
        invoiceNumber:   invoices.invoiceNumber,
        subtotalPaise:   invoices.subtotalPaise,
        cgstPaise:       invoices.cgstPaise,
        sgstPaise:       invoices.sgstPaise,
        igstPaise:       invoices.igstPaise,
        dueDate:         invoices.dueDate,
        createdAt:       invoices.createdAt,
        clientName:      customers.fullName,
        clientPhone:     customers.phone,
        lastContactedAt: customers.lastContactedAt,
        healthStatus:    customers.healthStatus,
        customerId:      customers.id,
      })
      .from(invoices)
      .innerJoin(projects,  eq(invoices.projectId, projects.id))
      .leftJoin(customers,  eq(projects.customerId, customers.id))
      .where(and(
        eq(invoices.tenantId, ctx.tenantId),
        ne(invoices.status, 'void'),
        ne(invoices.status, 'draft'),
      ));

    // Sum captured payments per invoice.
    const invoiceIds = invRows.map(r => r.id);
    const paymentSumsMap = new Map<string, number>();
    if (invoiceIds.length > 0) {
      const sums = await db
        .select({
          invoiceId: payments.invoiceId,
          total:     sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number),
        })
        .from(payments)
        .where(and(
          inArray(payments.invoiceId, invoiceIds),
          ne(payments.status, 'pending'),
        ))
        .groupBy(payments.invoiceId);
      for (const s of sums) {
        if (s.invoiceId) paymentSumsMap.set(s.invoiceId, s.total);
      }
    }

    const items = invRows
      .map(row => {
        const totalInvoicePaise =
          row.subtotalPaise + row.cgstPaise + row.sgstPaise + row.igstPaise;
        const paidPaise   = paymentSumsMap.get(row.id) ?? 0;
        const outstanding = Math.max(0, totalInvoicePaise - paidPaise);
        if (outstanding === 0) return null;

        const daysSinceCreation = Math.floor(
          (now - new Date(row.createdAt).getTime()) / 86_400_000,
        );
        const daysLate = row.dueDate
          ? Math.max(0, Math.floor((now - new Date(row.dueDate).getTime()) / 86_400_000))
          : 0;

        if (overdueOnly && daysLate === 0) return null;

        const paymentStatus: 'pending' | 'link_sent' | 'overdue' =
          daysLate > 0 ? 'overdue' : 'pending';

        return {
          id:              row.id,
          projectId:       row.projectId,
          projectName:     row.projectName ?? '',
          label:           row.invoiceNumber,
          amountPaise:     outstanding,
          paymentStatus,
          createdAt:       row.createdAt.toISOString(),
          daysSinceCreation,
          daysLate,
          dueDate:         row.dueDate ?? null,
          clientName:      row.clientName ?? null,
          clientPhone:     row.clientPhone ?? null,
          promisedAt:      null,
          lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
          healthStatus:    row.healthStatus ?? null,
          customerId:      row.customerId ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    items.sort((a, b) => b.daysLate - a.daysLate);

    const totalOutstandingPaise = items.reduce((s, i) => s + i.amountPaise, 0);
    const totalOverduePaise     = items
      .filter(i => i.daysLate > 0)
      .reduce((s, i) => s + i.amountPaise, 0);
    const notYetDuePaise = items
      .filter(i => i.daysLate === 0)
      .reduce((s, i) => s + i.amountPaise, 0);
    const linkSentPaise = 0;

    return NextResponse.json({
      data: { items, totalOutstandingPaise, totalOverduePaise, linkSentPaise, notYetDuePaise },
    });
  } catch (err) {
    console.error('[accounts/receivables GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
