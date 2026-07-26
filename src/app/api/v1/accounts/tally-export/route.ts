import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payments, invoices, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner' && ctx.role !== 'accountant') {
    return NextResponse.json({ error: 'Forbidden: owner or accountant role required' }, { status: 403 });
  }

  try {
    const rows = await db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        projectName: projects.name,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise: invoices.cgstPaise,
        sgstPaise: invoices.sgstPaise,
        igstPaise: invoices.igstPaise,
        reconciledAt: payments.reconciledAt,
        razorpayPaymentId: payments.razorpayPaymentId,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(payments.tenantId, ctx.tenantId),
          sql`${payments.status} = 'captured'`,
        ),
      );

    const csvHeader = 'invoice_number,project_name,subtotal_rs,gst_rs,total_rs,paid_at,razorpay_payment_id';

    const csvRows = rows.map((row) => {
      const subtotalRs = (row.subtotalPaise / 100).toFixed(2);
      const gstPaise = row.cgstPaise + row.sgstPaise + row.igstPaise;
      const gstRs = (gstPaise / 100).toFixed(2);
      const totalRs = ((row.subtotalPaise + gstPaise) / 100).toFixed(2);
      const paidAt = row.reconciledAt ? row.reconciledAt.toISOString() : '';
      const razorpayId = row.razorpayPaymentId ?? '';
      // Wrap project_name in quotes to handle commas
      const projectName = `"${row.projectName.replace(/"/g, '""')}"`;

      return `${row.invoiceNumber},${projectName},${subtotalRs},${gstRs},${totalRs},${paidAt},${razorpayId}`;
    });

    const csvString = [csvHeader, ...csvRows].join('\n');

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=tally-export.csv',
      },
    });
  } catch (err) {
    console.error('[accounts/tally-export GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
