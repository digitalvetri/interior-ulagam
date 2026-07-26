import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  leads, projects, quotes, payments, materials, invoices, expenses, vendors,
  customers, designTasks, siteVisits,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { toCsv } from '@/lib/csv';

const KINDS = [
  'leads', 'projects', 'quotes', 'payments', 'materials', 'backup',
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

export async function GET(
  _req: NextRequest,
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
