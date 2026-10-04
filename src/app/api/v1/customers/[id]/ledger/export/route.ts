import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customers, tenants } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderClientStatementPdf } from '@/lib/pdf/client-statement';
import { buildLedgerExcel } from '@/lib/project-money/excel-ledger';
import { loadCustomerLedger } from '@/lib/project-money/server';
import { serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

/** The client's statement as PDF (?format=pdf) or Excel (?format=xlsx). */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;
  const { id } = await params;

  const sp = request.nextUrl.searchParams;
  const format = sp.get('format') === 'xlsx' ? 'xlsx' : 'pdf';
  const projectId = sp.get('projectId');
  if (projectId && !z.string().uuid().safeParse(projectId).success) {
    return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
  }

  try {
    const [c] = await db.select({ fullName: customers.fullName, phone: customers.phone, address: customers.address })
      .from(customers).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId))).limit(1);
    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const [tenant] = await db.select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);

    const ledger = await loadCustomerLedger(ctx.tenantId, id, projectId);
    const scope = projectId ? ledger.projects.find(p => p.id === projectId)?.name ?? 'Project' : 'All projects';
    const rows = ledger.entries.map(e => ({
      date: e.date, label: e.label, projectName: e.projectName, owedPaise: e.owedPaise, paidPaise: e.paidPaise, balancePaise: e.balancePaise,
    }));
    const fileBase = `Statement-${c.fullName}-${new Date().toISOString().slice(0, 10)}`.replace(/[^A-Za-z0-9_.-]+/g, '-');

    if (format === 'xlsx') {
      const buf = await buildLedgerExcel({ studioName: tenant?.name ?? 'Konst Design', clientName: c.fullName, scope, rows, totals: ledger.totals });
      return new NextResponse(new Uint8Array(buf), { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileBase}.xlsx"`,
      } });
    }
    const buf = await renderClientStatementPdf({
      studio: extractBranding(tenant ?? { name: 'Konst Design' }),
      client: { name: c.fullName, phone: c.phone, address: c.address }, scope, rows, totals: ledger.totals,
    });
    return new NextResponse(new Uint8Array(buf), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileBase}.pdf"`,
    } });
  } catch (err) {
    return serverError('customers/:id/ledger/export GET', err);
  }
}
