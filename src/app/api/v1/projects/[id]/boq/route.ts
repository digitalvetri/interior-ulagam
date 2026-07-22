import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes, quoteLines, purchaseOrders, grns, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type { BOQSummary } from '@/types/purchase-orders';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify the project belongs to this tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // a. Get approved quote IDs for this project
    const approvedQuotes = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.projectId, id), eq(quotes.status, 'approved')));

    const approvedQuoteIds = approvedQuotes.map((q) => q.id);

    // b. Sum quote lines from approved quotes
    // clientRatePaise and costRatePaise are per-unit; multiply by qty for totals
    // marginPaise is already (clientRate − costRate) × qty per line
    let totalClientPaise = 0;
    let totalCostPaise = 0;
    let totalMarginPaise = 0;

    if (approvedQuoteIds.length > 0) {
      const [sums] = await db
        .select({
          totalClientPaise: sql<string>`coalesce(sum(${quoteLines.clientRatePaise} * ${quoteLines.qty}), 0)`,
          totalCostPaise: sql<string>`coalesce(sum(${quoteLines.costRatePaise} * ${quoteLines.qty}), 0)`,
          totalMarginPaise: sql<string>`coalesce(sum(${quoteLines.marginPaise}), 0)`,
        })
        .from(quoteLines)
        .where(inArray(quoteLines.quoteId, approvedQuoteIds));

      if (sums) {
        totalClientPaise = Number(sums.totalClientPaise);
        totalCostPaise = Number(sums.totalCostPaise);
        totalMarginPaise = Number(sums.totalMarginPaise);
      }
    }

    // c. Count POs for this project
    const [{ poCountRaw }] = await db
      .select({
        poCountRaw: sql<string>`count(*)`,
      })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.projectId, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    const poCount = Number(poCountRaw);

    // d. Count GRNs for POs belonging to this project (nested subquery via project PO IDs)
    const [{ grnCountRaw }] = await db
      .select({
        grnCountRaw: sql<string>`count(*)`,
      })
      .from(grns)
      .innerJoin(purchaseOrders, eq(grns.poId, purchaseOrders.id))
      .where(
        and(
          eq(purchaseOrders.projectId, id),
          eq(purchaseOrders.tenantId, ctx.tenantId),
          eq(grns.tenantId, ctx.tenantId),
        ),
      );

    const grnCount = Number(grnCountRaw);

    const summary: BOQSummary = {
      quoted: {
        totalClientPaise,
        totalCostPaise,
        totalMarginPaise,
      },
      poCount,
      grnCount,
    };

    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error('[projects/:id/boq GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
