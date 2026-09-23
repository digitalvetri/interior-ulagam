import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, projects, payments, customers, milestones } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

// GET /api/v1/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// KPI cards for the Reports Dashboard with current/previous period comparison.
export async function GET(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp   = request.nextUrl.searchParams;
  const from = sp.get('from');
  const to   = sp.get('to');
  const tid  = ctx.tenantId;

  const fromDate = from ? new Date(from + 'T00:00:00.000Z') : null;
  const toDate   = to   ? new Date(to   + 'T23:59:59.999Z') : null;

  // Previous period = same duration shifted back
  let prevFrom: Date | null = null;
  let prevTo:   Date | null = null;
  if (fromDate && toDate) {
    const duration = toDate.getTime() - fromDate.getTime();
    prevTo   = new Date(fromDate.getTime() - 1);
    prevFrom = new Date(fromDate.getTime() - duration - 1);
  }

  // Build filter arrays
  const currLead = [eq(leads.tenantId, tid)];
  const prevLead = [eq(leads.tenantId, tid)];
  if (fromDate) currLead.push(gte(leads.createdAt, fromDate));
  if (toDate)   currLead.push(lte(leads.createdAt, toDate));
  if (prevFrom) prevLead.push(gte(leads.createdAt, prevFrom));
  if (prevTo)   prevLead.push(lte(leads.createdAt, prevTo));

  const currCust = [eq(customers.tenantId, tid)];
  const prevCust = [eq(customers.tenantId, tid)];
  if (fromDate) currCust.push(gte(customers.createdAt, fromDate));
  if (toDate)   currCust.push(lte(customers.createdAt, toDate));
  if (prevFrom) prevCust.push(gte(customers.createdAt, prevFrom));
  if (prevTo)   prevCust.push(lte(customers.createdAt, prevTo));

  const currPay = [eq(payments.tenantId, tid), eq(payments.status, 'captured')];
  const prevPay = [eq(payments.tenantId, tid), eq(payments.status, 'captured')];
  if (fromDate) currPay.push(gte(payments.createdAt, fromDate));
  if (toDate)   currPay.push(lte(payments.createdAt, toDate));
  if (prevFrom) prevPay.push(gte(payments.createdAt, prevFrom));
  if (prevTo)   prevPay.push(lte(payments.createdAt, prevTo));

  try {
    const [
      cLeads, pLeads,
      cClients, pClients,
      activeProjRows,
      cRev, pRev,
      outstandingRows,
    ] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(...currLead)),
      db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(...prevLead)),
      db.select({ n: sql<number>`count(*)::int` }).from(customers).where(and(...currCust)),
      db.select({ n: sql<number>`count(*)::int` }).from(customers).where(and(...prevCust)),
      // Active projects: snapshot count — not period-filtered (mirrors projects/page.tsx activeCount)
      db.select({ n: sql<number>`count(*)::int` })
        .from(projects)
        .where(and(eq(projects.tenantId, tid), ne(projects.lifecycleStage, 'complete'))),
      db.select({ total: sql<number>`coalesce(sum(amount_paise), 0)::bigint` })
        .from(payments).where(and(...currPay)),
      db.select({ total: sql<number>`coalesce(sum(amount_paise), 0)::bigint` })
        .from(payments).where(and(...prevPay)),
      // Outstanding: non-paid milestones joined to projects for tenantId (milestones has no tenant_id)
      db.select({ total: sql<number>`coalesce(sum(${milestones.amountPaise}), 0)::bigint` })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(and(
          eq(projects.tenantId, tid),
          ne(milestones.paymentStatus, 'paid'),
        )),
    ]);

    const pctChange = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    const cl = cLeads[0]?.n   ?? 0;
    const pl = pLeads[0]?.n   ?? 0;
    const cc = cClients[0]?.n ?? 0;
    const pc = pClients[0]?.n ?? 0;
    const cr = Number(cRev[0]?.total ?? 0);
    const pr = Number(pRev[0]?.total ?? 0);

    return NextResponse.json({
      data: {
        leads:            { curr: cl, prev: pl, changePct: pctChange(cl, pl) },
        newClients:       { curr: cc, prev: pc, changePct: pctChange(cc, pc) },
        activeProjects:   activeProjRows[0]?.n ?? 0,
        revenue:          { currPaise: cr, prevPaise: pr, changePct: pctChange(cr, pr) },
        outstandingPaise: Number(outstandingRows[0]?.total ?? 0),
      },
    });
  } catch (err) {
    console.error('[reports/summary]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Unused — needed so Next.js doesn't strip the route
export const dynamic = 'force-dynamic';
