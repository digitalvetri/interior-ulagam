import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  leads, projects, quotes, payments, materials, invoices, expenses, vendors,
  customers, designTasks, siteVisits,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import {
  toTallySalesCsv, toTallySalesXml,
  toTallyReceiptCsv, toTallyReceiptXml,
  type InvoiceRow as TallyInvoiceRow,
  type PaymentRow as TallyPaymentRow,
} from '@/lib/tally';

const KINDS = [
  'leads', 'projects', 'quotes', 'payments', 'materials', 'backup',
  'tally-sales-csv', 'tally-sales-xml',
  'tally-receipts-csv', 'tally-receipts-xml',
] as const;
type Kind = typeof KINDS[number];

function csvResponse(name: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}

function jsonDownloadResponse(name: string, body: unknown) {
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}

function xmlResponse(name: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}

// Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD from the request URL. Returns null bounds
// when the param is missing so the caller can decide whether to require it.
function parseDateRange(req: NextRequest): { from: Date | null; to: Date | null } {
  const url = new URL(req.url);
  const fromRaw = url.searchParams.get('from');
  const toRaw   = url.searchParams.get('to');
  const isValid = (v: string | null) => v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    from: isValid(fromRaw) ? new Date(`${fromRaw}T00:00:00Z`) : null,
    to:   isValid(toRaw)   ? new Date(`${toRaw}T23:59:59Z`)   : null,
  };
}

async function loadTallyInvoices(tenantId: string, from: Date | null, to: Date | null): Promise<TallyInvoiceRow[]> {
  // Join invoices → projects → leads to enrich the customer + project name.
  const conditions = [eq(invoices.tenantId, tenantId)];
  if (from) conditions.push(gte(invoices.invoiceDate, from.toISOString().slice(0, 10)));
  if (to)   conditions.push(lte(invoices.invoiceDate, to.toISOString().slice(0, 10)));

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      subtotalPaise: invoices.subtotalPaise,
      cgstPaise: invoices.cgstPaise,
      sgstPaise: invoices.sgstPaise,
      igstPaise: invoices.igstPaise,
      placeOfSupply: invoices.placeOfSupply,
      isInterstate: invoices.isInterstate,
      projectId: invoices.projectId,
      projectName: projects.name,
      customerName: leads.contactName,
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .where(and(...conditions));

  return rows.map(r => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    subtotalPaise: r.subtotalPaise,
    cgstPaise: r.cgstPaise,
    sgstPaise: r.sgstPaise,
    igstPaise: r.igstPaise,
    placeOfSupply: r.placeOfSupply,
    isInterstate: r.isInterstate,
    projectId: r.projectId,
    projectName: r.projectName ?? 'Project',
    customerName: r.customerName ?? 'Customer',
  }));
}

async function loadTallyPayments(tenantId: string, from: Date | null, to: Date | null): Promise<TallyPaymentRow[]> {
  const conditions = [eq(payments.tenantId, tenantId)];
  if (from) conditions.push(gte(payments.createdAt, from));
  if (to)   conditions.push(lte(payments.createdAt, to));

  const rows = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      amountPaise: payments.amountPaise,
      status: payments.status,
      reconciledAt: payments.reconciledAt,
      createdAt: payments.createdAt,
      razorpayPaymentId: payments.razorpayPaymentId,
      invoiceNumber: invoices.invoiceNumber,
      customerName: leads.contactName,
    })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .where(and(...conditions));

  return rows.map(r => ({
    id: r.id,
    invoiceId: r.invoiceId,
    amountPaise: r.amountPaise,
    status: r.status,
    reconciledAt: r.reconciledAt ? r.reconciledAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    invoiceNumber: r.invoiceNumber ?? null,
    customerName: r.customerName ?? 'Customer',
    source: r.razorpayPaymentId ? 'razorpay' as const : 'manual' as const,
    reference: r.razorpayPaymentId,
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Unknown export kind' }, { status: 400 });
  }
  const k = kind as Kind;
  const today = new Date().toISOString().slice(0, 10);
  const range = parseDateRange(req);
  const rangeSuffix = range.from || range.to
    ? `_${range.from?.toISOString().slice(0, 10) ?? 'start'}_to_${range.to?.toISOString().slice(0, 10) ?? 'today'}`
    : '';

  try {
    switch (k) {
      case 'leads': {
        const rows = await db.select().from(leads).where(eq(leads.tenantId, ctx.tenantId));
        return csvResponse(`leads_${today}.csv`, toCsv(rows));
      }
      case 'projects': {
        const rows = await db.select().from(projects).where(eq(projects.tenantId, ctx.tenantId));
        return csvResponse(`projects_${today}.csv`, toCsv(rows));
      }
      case 'quotes': {
        const rows = await db.select().from(quotes).where(eq(quotes.tenantId, ctx.tenantId));
        return csvResponse(`quotes_${today}.csv`, toCsv(rows));
      }
      case 'payments': {
        const rows = await db.select().from(payments).where(eq(payments.tenantId, ctx.tenantId));
        return csvResponse(`payments_${today}.csv`, toCsv(rows));
      }
      case 'materials': {
        const rows = await db.select().from(materials).where(eq(materials.tenantId, ctx.tenantId));
        return csvResponse(`materials_${today}.csv`, toCsv(rows));
      }
      case 'tally-sales-csv': {
        const rows = await loadTallyInvoices(ctx.tenantId, range.from, range.to);
        return csvResponse(`tally_sales${rangeSuffix || '_' + today}.csv`, toTallySalesCsv(rows));
      }
      case 'tally-sales-xml': {
        const rows = await loadTallyInvoices(ctx.tenantId, range.from, range.to);
        return xmlResponse(`tally_sales${rangeSuffix || '_' + today}.xml`, toTallySalesXml(rows));
      }
      case 'tally-receipts-csv': {
        const rows = await loadTallyPayments(ctx.tenantId, range.from, range.to);
        return csvResponse(`tally_receipts${rangeSuffix || '_' + today}.csv`, toTallyReceiptCsv(rows));
      }
      case 'tally-receipts-xml': {
        const rows = await loadTallyPayments(ctx.tenantId, range.from, range.to);
        return xmlResponse(`tally_receipts${rangeSuffix || '_' + today}.xml`, toTallyReceiptXml(rows));
      }
      case 'backup': {
        const [ldRows, pjRows, qtRows, pmRows, mtRows, ivRows, exRows, vdRows, csRows, dtRows, svRows] =
          await Promise.all([
            db.select().from(leads).where(eq(leads.tenantId, ctx.tenantId)),
            db.select().from(projects).where(eq(projects.tenantId, ctx.tenantId)),
            db.select().from(quotes).where(eq(quotes.tenantId, ctx.tenantId)),
            db.select().from(payments).where(eq(payments.tenantId, ctx.tenantId)),
            db.select().from(materials).where(eq(materials.tenantId, ctx.tenantId)),
            db.select().from(invoices).where(eq(invoices.tenantId, ctx.tenantId)),
            db.select().from(expenses).where(eq(expenses.tenantId, ctx.tenantId)),
            db.select().from(vendors).where(eq(vendors.tenantId, ctx.tenantId)),
            db.select().from(customers).where(eq(customers.tenantId, ctx.tenantId)),
            db.select().from(designTasks).where(eq(designTasks.tenantId, ctx.tenantId)),
            db.select().from(siteVisits).where(eq(siteVisits.tenantId, ctx.tenantId)),
          ]);
        return jsonDownloadResponse(`backup_${today}.json`, {
          exportedAt: new Date().toISOString(),
          tenantId: ctx.tenantId,
          tables: {
            leads:       ldRows,
            projects:    pjRows,
            quotes:      qtRows,
            payments:    pmRows,
            materials:   mtRows,
            invoices:    ivRows,
            expenses:    exRows,
            vendors:     vdRows,
            customers:   csRows,
            designTasks: dtRows,
            siteVisits:  svRows,
          },
        });
      }
    }
  } catch (e) {
    console.error('[GET /api/v1/exports/:kind]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
