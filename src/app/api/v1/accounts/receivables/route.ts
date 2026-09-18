import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { milestones, projects, invoices, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const overdueOnly = searchParams.get('overdueOnly') === 'true';

  try {
    const outstandingStatuses: Array<'pending' | 'link_sent' | 'overdue'> = overdueOnly
      ? ['overdue']
      : ['pending', 'link_sent', 'overdue'];

    const rows = await db
      .select({
        id:              milestones.id,
        projectId:       milestones.projectId,
        projectName:     projects.name,
        label:           milestones.label,
        amountPaise:     milestones.amountPaise,
        paymentStatus:   milestones.paymentStatus,
        createdAt:       milestones.createdAt,
        promisedAt:      milestones.promisedAt,
        invoiceDueDate:  invoices.dueDate,
        clientName:      customers.fullName,
        clientPhone:     customers.phone,
        lastContactedAt: customers.lastContactedAt,
        healthStatus:    customers.healthStatus,
        customerId:      customers.id,
      })
      .from(milestones)
      .innerJoin(projects, and(
        eq(milestones.projectId, projects.id),
        eq(projects.tenantId, ctx.tenantId),
      ))
      .leftJoin(invoices,  eq(milestones.invoiceId,  invoices.id))
      .leftJoin(customers, eq(projects.customerId,   customers.id))
      .where(inArray(milestones.paymentStatus, outstandingStatuses));

    const now = Date.now();

    const items = rows.map(row => {
      const daysSinceCreation = Math.floor((now - new Date(row.createdAt).getTime()) / 86_400_000);
      const daysLate = row.invoiceDueDate
        ? Math.max(0, Math.floor((now - new Date(row.invoiceDueDate).getTime()) / 86_400_000))
        : 0;
      return {
        id:              row.id,
        projectId:       row.projectId,
        projectName:     row.projectName ?? '',
        label:           row.label,
        amountPaise:     row.amountPaise,
        paymentStatus:   row.paymentStatus as 'pending' | 'link_sent' | 'overdue',
        createdAt:       row.createdAt.toISOString(),
        daysSinceCreation,
        daysLate,
        dueDate:         row.invoiceDueDate ?? null,
        clientName:      row.clientName ?? null,
        clientPhone:     row.clientPhone ?? null,
        promisedAt:      row.promisedAt?.toISOString() ?? null,
        lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
        healthStatus:    row.healthStatus ?? null,
        customerId:      row.customerId ?? null,
      };
    });

    items.sort((a, b) => b.daysLate - a.daysLate);

    const totalOutstandingPaise = items.reduce((s, i) => s + i.amountPaise, 0);
    // Include items marked 'overdue' by webhook even when no invoiceDueDate is set
    const totalOverduePaise = items
      .filter(i => i.daysLate > 0 || i.paymentStatus === 'overdue')
      .reduce((s, i) => s + i.amountPaise, 0);
    const linkSentPaise = items
      .filter(i => i.paymentStatus === 'link_sent' && i.daysLate === 0)
      .reduce((s, i) => s + i.amountPaise, 0);
    const notYetDuePaise = items
      .filter(i => i.paymentStatus === 'pending' && i.daysLate === 0)
      .reduce((s, i) => s + i.amountPaise, 0);

    return NextResponse.json({
      data: { items, totalOutstandingPaise, totalOverduePaise, linkSentPaise, notYetDuePaise },
    });
  } catch (err) {
    console.error('[accounts/receivables GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
