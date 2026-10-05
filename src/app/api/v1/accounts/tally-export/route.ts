import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payments, invoices, projects } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { escapeCsv, toReceiptVoucherXml } from '@/lib/tally';

// GET /api/v1/accounts/tally-export?format=csv|xml
// One row / voucher per captured payment, for the amount actually paid — a
// part payment must not repeat the whole invoice total.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const format = request.nextUrl.searchParams.get('format') === 'xml' ? 'xml' : 'csv';

  try {
    const rows = await db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        projectName: projects.name,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise: invoices.cgstPaise,
        sgstPaise: invoices.sgstPaise,
        igstPaise: invoices.igstPaise,
        amountPaise: payments.amountPaise,
        reconciledAt: payments.reconciledAt,
        createdAt: payments.createdAt,
        razorpayPaymentId: payments.razorpayPaymentId,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(payments.tenantId, ctx.tenantId),
          eq(invoices.tenantId, ctx.tenantId),
          sql`${payments.status} = 'captured'`,
        ),
      );

    if (format === 'xml') {
      const xml = toReceiptVoucherXml(rows.map((row) => ({
        date: (row.reconciledAt ?? row.createdAt).toISOString().slice(0, 10).replace(/-/g, ''),
        voucherNumber: row.invoiceNumber,
        partyLedgerName: row.projectName,
        amountPaise: row.amountPaise,
        narration: `Payment against ${row.invoiceNumber}${row.razorpayPaymentId ? ` (${row.razorpayPaymentId})` : ''}`,
      })));
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': 'attachment; filename=tally-export.xml',
          'Cache-Control': 'no-store',
        },
      });
    }

    const csvHeader = 'invoice_number,project_name,payment_rs,invoice_total_rs,paid_at,razorpay_payment_id';
    const csvRows = rows.map((row) => {
      const invoiceTotalPaise = row.subtotalPaise + row.cgstPaise + row.sgstPaise + row.igstPaise;
      return [
        escapeCsv(row.invoiceNumber),
        escapeCsv(row.projectName),
        (row.amountPaise / 100).toFixed(2),
        (invoiceTotalPaise / 100).toFixed(2),
        row.reconciledAt ? row.reconciledAt.toISOString() : '',
        escapeCsv(row.razorpayPaymentId ?? ''),
      ].join(',');
    });

    return new NextResponse([csvHeader, ...csvRows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=tally-export.csv',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[accounts/tally-export GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
