import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, payments, projects, milestones } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

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
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)));

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const [invoicePayments, projectRow, milestoneRow] = await Promise.all([
      db.select().from(payments)
        .where(and(eq(payments.invoiceId, id), eq(payments.tenantId, ctx.tenantId))),
      db.select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, invoice.projectId)),
      db.select({ id: milestones.id, projectId: milestones.projectId, label: milestones.label })
        .from(milestones)
        .where(eq(milestones.invoiceId, id)),
    ]);

    return NextResponse.json({
      data: {
        invoice: { ...invoice, projectName: projectRow[0]?.name ?? null },
        payments: invoicePayments,
        project: projectRow[0] ?? null,
        sourceMilestone: milestoneRow[0] ?? null,
      },
    });
  } catch (err) {
    console.error('[invoices/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
