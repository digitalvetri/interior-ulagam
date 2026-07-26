import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, quotes, quoteLines, expenses } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, inArray, sql } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Verify project belongs to this tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // a) Get approved quote IDs for this project
    const approvedQuotes = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.projectId, projectId),
          eq(quotes.tenantId, ctx.tenantId),
          eq(quotes.status, 'approved'),
        ),
      );

    const approvedQuoteIds = approvedQuotes.map((q) => q.id);

    // b+c) Sum costRatePaise * qty and clientRatePaise * qty from quoteLines
    let quotedCostPaise = 0;
    let quotedClientPaise = 0;

    if (approvedQuoteIds.length > 0) {
      const [lineSums] = await db
        .select({
          quotedCostPaise: sql<string>`COALESCE(SUM(${quoteLines.costRatePaise} * ${quoteLines.qty}), 0)`,
          quotedClientPaise: sql<string>`COALESCE(SUM(${quoteLines.clientRatePaise} * ${quoteLines.qty}), 0)`,
        })
        .from(quoteLines)
        .where(inArray(quoteLines.quoteId, approvedQuoteIds));

      quotedCostPaise = Number(lineSums?.quotedCostPaise ?? 0);
      quotedClientPaise = Number(lineSums?.quotedClientPaise ?? 0);
    }

    // d) Sum actual expenses for this project
    const [expenseSums] = await db
      .select({
        actualExpensesPaise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
      })
      .from(expenses)
      .where(and(eq(expenses.projectId, projectId), eq(expenses.tenantId, ctx.tenantId)));

    const actualExpensesPaise = Number(expenseSums?.actualExpensesPaise ?? 0);

    // e) Burn percentage
    const burnPct = quotedCostPaise > 0
      ? Math.round((actualExpensesPaise / quotedCostPaise) * 100)
      : 0;

    // f) Remaining budget
    const remainingPaise = Math.max(0, quotedCostPaise - actualExpensesPaise);

    // g) Variance (positive = over budget)
    const variancePaise = actualExpensesPaise - quotedCostPaise;

    // h) Status
    const status: 'on_track' | 'watch' | 'overrun' =
      burnPct < 60 ? 'on_track' : burnPct < 80 ? 'watch' : 'overrun';

    return NextResponse.json({
      data: {
        quotedCostPaise,
        quotedClientPaise,
        actualExpensesPaise,
        remainingPaise,
        variancePaise,
        burnPct,
        status,
      },
    });
  } catch (err) {
    console.error('[projects/:id/cost-to-complete GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
