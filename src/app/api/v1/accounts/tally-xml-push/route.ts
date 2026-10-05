import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { milestones, invoices, payments, projects } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { toReceiptVoucherXml } from '@/lib/tally';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  try {
    // Fetch all paid milestones with invoices for tenant:
    // milestones → invoices (milestones.invoiceId = invoices.id)
    // → payments (payments.invoiceId = invoices.id, status='captured')
    // → projects (invoices.projectId = projects.id)
    const rows = await db
      .select({
        milestoneLabel: milestones.label,
        invoiceNumber: invoices.invoiceNumber,
        projectName: projects.name,
        amountPaise: payments.amountPaise,
        reconciledAt: payments.reconciledAt,
        razorpayPaymentId: payments.razorpayPaymentId,
      })
      .from(milestones)
      .innerJoin(invoices, eq(milestones.invoiceId, invoices.id))
      .innerJoin(payments, eq(payments.invoiceId, invoices.id))
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(payments.tenantId, ctx.tenantId),
          eq(invoices.tenantId, ctx.tenantId),
          sql`${payments.status} = 'captured'`,
        ),
      );

    const xmlString = toReceiptVoucherXml(rows.map((row) => ({
      date: row.reconciledAt ? row.reconciledAt.toISOString().slice(0, 10).replace(/-/g, '') : '',
      voucherNumber: row.invoiceNumber,
      partyLedgerName: row.projectName,
      amountPaise: row.amountPaise,
      narration: `${row.milestoneLabel} ${row.razorpayPaymentId ?? ''}`.trim(),
    })));

    return new NextResponse(xmlString, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename=tally-vouchers.xml',
      },
    });
  } catch (err) {
    console.error('[accounts/tally-xml-push GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
