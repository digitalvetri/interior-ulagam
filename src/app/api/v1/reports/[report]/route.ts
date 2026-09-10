import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  leads, projects, quotes, payments, expenses, invoices,
  purchaseOrders, vendors,
} from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

// GET /api/v1/reports/[report]?from=YYYY-MM-DD&to=YYYY-MM-DD
// report: enquiry-funnel | quotation-conversion | project-pipeline |
//         collections | profitability | vendor-spend
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { report } = await params;
  const sp  = request.nextUrl.searchParams;
  const from = sp.get('from'); // YYYY-MM-DD
  const to   = sp.get('to');   // YYYY-MM-DD
  const tid  = ctx.tenantId;

  const fromDate = from ? new Date(from + 'T00:00:00Z') : null;
  const toDate   = to   ? new Date(to   + 'T23:59:59Z') : null;

  try {
    switch (report) {
      case 'enquiry-funnel': {
        // Lead counts by stage and by source, optionally date-filtered (on createdAt)
        const dateFilters = [eq(leads.tenantId, tid)];
        if (fromDate) dateFilters.push(gte(leads.createdAt, fromDate));
        if (toDate)   dateFilters.push(lte(leads.createdAt, toDate));

        const [byStage, bySource, byMonth] = await Promise.all([
          db.select({
            stage: leads.stage,
            count: sql<number>`count(*)::int`,
          }).from(leads).where(and(...dateFilters)).groupBy(leads.stage),

          db.select({
            source: leads.source,
            count:  sql<number>`count(*)::int`,
          }).from(leads).where(and(...dateFilters)).groupBy(leads.source),

          db.select({
            month: sql<string>`to_char(created_at, 'YYYY-MM')`,
            count: sql<number>`count(*)::int`,
            won:   sql<number>`count(*) filter (where stage = 'won')::int`,
          }).from(leads).where(and(...dateFilters))
            .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
            .orderBy(sql`to_char(created_at, 'YYYY-MM')`),
        ]);

        return NextResponse.json({ data: { byStage, bySource, byMonth } });
      }

      case 'quotation-conversion': {
        const dateFilters = [eq(quotes.tenantId, tid)];
        if (fromDate) dateFilters.push(gte(quotes.createdAt, fromDate));
        if (toDate)   dateFilters.push(lte(quotes.createdAt, toDate));

        const [byStatus, byMonth] = await Promise.all([
          db.select({
            status:     quotes.status,
            count:      sql<number>`count(*)::int`,
            totalPaise: sql<number>`coalesce(sum(total_paise), 0)::bigint`,
          }).from(quotes).where(and(...dateFilters)).groupBy(quotes.status),

          db.select({
            month:        sql<string>`to_char(created_at, 'YYYY-MM')`,
            sent:         sql<number>`count(*)::int`,
            accepted:     sql<number>`count(*) filter (where status = 'accepted')::int`,
            rejected:     sql<number>`count(*) filter (where status = 'rejected')::int`,
            totalPaise:   sql<number>`coalesce(sum(total_paise), 0)::bigint`,
          }).from(quotes).where(and(...dateFilters))
            .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
            .orderBy(sql`to_char(created_at, 'YYYY-MM')`),
        ]);

        return NextResponse.json({ data: { byStatus, byMonth } });
      }

      case 'project-pipeline': {
        const dateFilters = [eq(projects.tenantId, tid)];
        if (fromDate) dateFilters.push(gte(projects.createdAt, fromDate));
        if (toDate)   dateFilters.push(lte(projects.createdAt, toDate));

        const [byStage, rows] = await Promise.all([
          db.select({
            stage:      projects.lifecycleStage,
            count:      sql<number>`count(*)::int`,
            totalPaise: sql<number>`coalesce(sum(total_contract_paise), 0)::bigint`,
          }).from(projects).where(and(...dateFilters)).groupBy(projects.lifecycleStage),

          db.select({
            id:                 projects.id,
            name:               projects.name,
            lifecycleStage:     projects.lifecycleStage,
            totalContractPaise: projects.totalContractPaise,
            expectedEndAt:      projects.expectedEndAt,
            createdAt:          projects.createdAt,
          }).from(projects).where(and(...dateFilters))
            .orderBy(projects.createdAt)
            .limit(200),
        ]);

        return NextResponse.json({ data: { byStage, rows } });
      }

      case 'collections': {
        const dateFilters = [eq(payments.tenantId, tid)];
        if (fromDate) dateFilters.push(gte(payments.createdAt, fromDate));
        if (toDate)   dateFilters.push(lte(payments.createdAt, toDate));

        const byMonth = await db.select({
          month:      sql<string>`to_char(coalesce(reconciled_at, created_at), 'YYYY-MM')`,
          count:      sql<number>`count(*)::int`,
          totalPaise: sql<number>`coalesce(sum(amount_paise) filter (where status = 'captured'), 0)::bigint`,
        }).from(payments).where(and(...dateFilters))
          .groupBy(sql`to_char(coalesce(reconciled_at, created_at), 'YYYY-MM')`)
          .orderBy(sql`to_char(coalesce(reconciled_at, created_at), 'YYYY-MM')`);

        return NextResponse.json({ data: { byMonth } });
      }

      case 'profitability': {
        const projFilters = [eq(projects.tenantId, tid)];
        if (fromDate) projFilters.push(gte(projects.createdAt, fromDate));
        if (toDate)   projFilters.push(lte(projects.createdAt, toDate));

        const expFilters = [eq(expenses.tenantId, tid)];
        if (fromDate) expFilters.push(gte(expenses.createdAt, fromDate));
        if (toDate)   expFilters.push(lte(expenses.createdAt, toDate));

        const [projectRows, expenseRows, paymentsRows] = await Promise.all([
          db.select({
            id:                 projects.id,
            name:               projects.name,
            lifecycleStage:     projects.lifecycleStage,
            totalContractPaise: projects.totalContractPaise,
          }).from(projects).where(and(...projFilters)).limit(200),

          db.select({
            projectId:   expenses.projectId,
            totalPaise:  sql<number>`coalesce(sum(amount_paise), 0)::bigint`,
          }).from(expenses).where(and(...expFilters))
            .groupBy(expenses.projectId),

          db.select({
            projectId:   invoices.projectId,
            totalPaise:  sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} = 'captured'), 0)::bigint`,
          }).from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(eq(payments.tenantId, tid))
            .groupBy(invoices.projectId),
        ]);

        const expByProject = new Map(expenseRows.map(e => [e.projectId, Number(e.totalPaise)]));
        const paidByProject = new Map(paymentsRows.map(p => [p.projectId, Number(p.totalPaise)]));

        const rows = projectRows.map(p => {
          const contract  = Number(p.totalContractPaise ?? 0);
          const expenses_  = expByProject.get(p.id) ?? 0;
          const collected = paidByProject.get(p.id) ?? 0;
          const margin    = contract - expenses_;
          return {
            id:              p.id,
            name:            p.name,
            stage:           p.lifecycleStage,
            contractPaise:   contract,
            expensesPaise:   expenses_,
            collectedPaise:  collected,
            marginPaise:     margin,
            marginPct:       contract > 0 ? Math.round((margin / contract) * 100) : 0,
          };
        });

        return NextResponse.json({ data: { rows } });
      }

      case 'vendor-spend': {
        const poFilters = [eq(purchaseOrders.tenantId, tid)];
        if (fromDate) poFilters.push(gte(purchaseOrders.createdAt, fromDate));
        if (toDate)   poFilters.push(lte(purchaseOrders.createdAt, toDate));

        const rows = await db
          .select({
            vendorId:     purchaseOrders.vendorId,
            vendorName:   vendors.name,
            poCount:      sql<number>`count(*)::int`,
            advancePaise: sql<number>`coalesce(sum(advance_paid_paise), 0)::bigint`,
            // Total ordered = sum of (qty × ratePaise) from linesJson
            totalPaise:   sql<number>`
              coalesce(
                sum(
                  (
                    select coalesce(sum((line->>'qty')::numeric * (line->>'ratePaise')::numeric), 0)
                    from jsonb_array_elements(lines_json) as line
                  )
                ),
                0
              )::bigint
            `,
          })
          .from(purchaseOrders)
          .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .where(and(...poFilters))
          .groupBy(purchaseOrders.vendorId, vendors.name)
          .orderBy(sql`sum(advance_paid_paise) desc`);

        return NextResponse.json({ data: { rows } });
      }

      default:
        return NextResponse.json({ error: 'Unknown report' }, { status: 404 });
    }
  } catch (err) {
    console.error(`[reports/${report}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
