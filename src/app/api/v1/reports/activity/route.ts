import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, projects, invoices, payments, expenses } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

export type ActivityType = 'lead' | 'project' | 'invoice' | 'payment' | 'expense';

export interface ActivityItem {
  id:          string;
  type:        ActivityType;
  label:       string;
  detail:      string | null;
  date:        string; // ISO
  amountPaise?: number;
}

// GET /api/v1/reports/activity
// Returns last 20 CRM events aggregated from leads, projects, invoices, payments, expenses.
export async function GET() {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const tid = ctx.tenantId;

  try {
    const [rLeads, rProjects, rInvoices, rPayments, rExpenses] = await Promise.all([
      db.select({ id: leads.id, label: leads.contactName, detail: leads.stage, date: leads.createdAt })
        .from(leads)
        .where(eq(leads.tenantId, tid))
        .orderBy(desc(leads.createdAt))
        .limit(8),

      db.select({ id: projects.id, label: projects.name, detail: projects.lifecycleStage, date: projects.createdAt })
        .from(projects)
        .where(eq(projects.tenantId, tid))
        .orderBy(desc(projects.createdAt))
        .limit(6),

      db.select({ id: invoices.id, label: invoices.invoiceNumber, detail: invoices.status, date: invoices.createdAt })
        .from(invoices)
        .where(eq(invoices.tenantId, tid))
        .orderBy(desc(invoices.createdAt))
        .limit(6),

      db.select({ id: payments.id, amountPaise: payments.amountPaise, date: payments.createdAt })
        .from(payments)
        .where(and(eq(payments.tenantId, tid), eq(payments.status, 'captured' as const)))
        .orderBy(desc(payments.createdAt))
        .limit(6),

      db.select({ id: expenses.id, label: expenses.description, detail: expenses.category, date: expenses.createdAt, amountPaise: expenses.amountPaise })
        .from(expenses)
        .where(eq(expenses.tenantId, tid))
        .orderBy(desc(expenses.createdAt))
        .limit(6),
    ]);

    const items: ActivityItem[] = [
      ...rLeads.map(r    => ({ id: r.id, type: 'lead'    as const, label: r.label,                   detail: r.detail,    date: r.date?.toISOString() ?? '' })),
      ...rProjects.map(r => ({ id: r.id, type: 'project' as const, label: r.label,                   detail: r.detail,    date: r.date?.toISOString() ?? '' })),
      ...rInvoices.map(r => ({ id: r.id, type: 'invoice' as const, label: r.label ?? 'Invoice',      detail: r.detail,    date: r.date?.toISOString() ?? '' })),
      ...rPayments.map(r => ({ id: r.id, type: 'payment' as const, label: 'Payment received',        detail: null,        date: r.date?.toISOString() ?? '', amountPaise: Number(r.amountPaise ?? 0) })),
      ...rExpenses.map(r => ({ id: r.id, type: 'expense' as const, label: r.label ?? 'Expense',      detail: r.detail,    date: r.date?.toISOString() ?? '', amountPaise: Number(r.amountPaise ?? 0) })),
    ]
      .filter(i => i.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return NextResponse.json({ data: { items } });
  } catch (err) {
    console.error('[reports/activity]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
