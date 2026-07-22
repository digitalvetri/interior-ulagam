import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { milestones, invoices, payments, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner' && ctx.role !== 'accountant') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

    const tallymessages = rows
      .map((row) => {
        const date = row.reconciledAt
          ? row.reconciledAt.toISOString().slice(0, 10).replace(/-/g, '')
          : '';
        const amount = (row.amountPaise / 100).toFixed(2);
        const narration = `${row.milestoneLabel} ${row.razorpayPaymentId ?? ''}`.trim();

        return `        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${date}</DATE>
            <VOUCHERNUMBER>${row.invoiceNumber}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${row.projectName}</PARTYLEDGERNAME>
            <AMOUNT>${amount}</AMOUNT>
            <NARRATION>${narration}</NARRATION>
          </VOUCHER>
        </TALLYMESSAGE>`;
      })
      .join('\n');

    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
${tallymessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

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
