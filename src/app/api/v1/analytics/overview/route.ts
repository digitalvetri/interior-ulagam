import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, projects, quotes, invoices, payments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ─── Lead pipeline: counts by stage ─────────────────────────
    const leadStageRows = await db
      .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, ctx.tenantId))
      .groupBy(leads.stage);

    // ─── Project counts ─────────────────────────────────────────
    const projectStageRows = await db
      .select({ stage: projects.lifecycleStage, count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.tenantId, ctx.tenantId))
      .groupBy(projects.lifecycleStage);

    // ─── Quotes: total value by status + counts ─────────────────
    const quoteRows = await db
      .select({
        status: quotes.status,
        count: sql<number>`count(*)::int`,
        totalPaise: sql<number>`coalesce(sum(total_paise), 0)::bigint`,
      })
      .from(quotes)
      .where(eq(quotes.tenantId, ctx.tenantId))
      .groupBy(quotes.status);

    // ─── Invoices: total invoiced amount ────────────────────────
    const [invoiceAgg] = await db
      .select({
        count:            sql<number>`count(*)::int`,
        totalSubPaise:    sql<number>`coalesce(sum(subtotal_paise), 0)::bigint`,
        totalGstPaise:    sql<number>`coalesce(sum(cgst_paise + sgst_paise + igst_paise), 0)::bigint`,
      })
      .from(invoices)
      .where(eq(invoices.tenantId, ctx.tenantId));

    // ─── Payments: captured (paid) total ────────────────────────
    const [paymentsAgg] = await db
      .select({
        capturedPaise: sql<number>`coalesce(sum(amount_paise) filter (where status = 'captured'), 0)::bigint`,
        pendingPaise:  sql<number>`coalesce(sum(amount_paise) filter (where status <> 'captured'), 0)::bigint`,
        count:         sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(eq(payments.tenantId, ctx.tenantId));

    // ─── 30-day payment trend (daily buckets) ───────────────────
    const trendRows = await db
      .select({
        day: sql<string>`to_char(coalesce(reconciled_at, created_at)::date, 'YYYY-MM-DD')`,
        amountPaise: sql<number>`coalesce(sum(amount_paise) filter (where status = 'captured'), 0)::bigint`,
      })
      .from(payments)
      .where(and(
        eq(payments.tenantId, ctx.tenantId),
        sql`coalesce(reconciled_at, created_at) >= (now() - interval '30 days')`,
      ))
      .groupBy(sql`to_char(coalesce(reconciled_at, created_at)::date, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(coalesce(reconciled_at, created_at)::date, 'YYYY-MM-DD')`);

    // Fill missing days with zero so the sparkline is dense
    const trend = fillTrend(trendRows, 30);

    // ─── Won / lost / open lead totals for the conversion pill ──
    let leadsWon = 0, leadsLost = 0, leadsOpen = 0;
    for (const r of leadStageRows) {
      const c = Number(r.count);
      if (r.stage === 'won')          leadsWon += c;
      else if (r.stage === 'lost')    leadsLost += c;
      else                            leadsOpen += c;
    }
    const totalLeads = leadsWon + leadsLost + leadsOpen;
    const conversionPct = (leadsWon + leadsLost) > 0
      ? Math.round((leadsWon / (leadsWon + leadsLost)) * 100)
      : 0;

    // ─── Quote win rate ─────────────────────────────────────────
    let quotesApproved = 0, quotesLost = 0, quotesOpen = 0, quotesApprovedValue = 0;
    for (const r of quoteRows) {
      const c = Number(r.count);
      const v = Number(r.totalPaise);
      if (r.status === 'approved')     { quotesApproved += c; quotesApprovedValue += v; }
      else if (r.status === 'rejected'){ quotesLost += c; }
      else                             { quotesOpen += c; }
    }
    const totalDecidedQuotes = quotesApproved + quotesLost;
    const quoteWinPct = totalDecidedQuotes > 0
      ? Math.round((quotesApproved / totalDecidedQuotes) * 100)
      : 0;

    const totalInvoicedPaise = Number(invoiceAgg?.totalSubPaise ?? 0) + Number(invoiceAgg?.totalGstPaise ?? 0);
    const capturedPaise = Number(paymentsAgg?.capturedPaise ?? 0);
    const outstandingPaise = Math.max(0, totalInvoicedPaise - capturedPaise);

    return NextResponse.json({
      data: {
        leads: {
          total: totalLeads,
          won: leadsWon,
          lost: leadsLost,
          open: leadsOpen,
          conversionPct,
          byStage: leadStageRows.map((r) => ({ stage: r.stage, count: Number(r.count) })),
        },
        projects: {
          total: projectStageRows.reduce((s, r) => s + Number(r.count), 0),
          byStage: projectStageRows.map((r) => ({ stage: r.stage, count: Number(r.count) })),
        },
        quotes: {
          total: quoteRows.reduce((s, r) => s + Number(r.count), 0),
          approved: quotesApproved,
          approvedValuePaise: quotesApprovedValue,
          winPct: quoteWinPct,
          byStatus: quoteRows.map((r) => ({
            status: r.status,
            count: Number(r.count),
            valuePaise: Number(r.totalPaise),
          })),
        },
        finance: {
          totalInvoicedPaise,
          capturedPaise,
          outstandingPaise,
          paymentCount: Number(paymentsAgg?.count ?? 0),
        },
        trend30d: trend,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/analytics/overview]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function fillTrend(
  rows: { day: string; amountPaise: number }[],
  days: number,
): { day: string; amountPaise: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.amountPaise)]));
  const out: { day: string; amountPaise: number }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ day: key, amountPaise: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
