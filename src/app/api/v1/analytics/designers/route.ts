import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, projects, quotes, quoteLines, deliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { DesignerMetrics } from '@/types/analytics';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 });
  }

  try {
    // a) Get all designers for tenant
    const designers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.tenantId, ctx.tenantId), eq(users.role, 'designer')));

    if (designers.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // b) Fetch all projects for this tenant once, then filter per designer
    const allProjects = await db
      .select({
        id: projects.id,
        lifecycleStage: projects.lifecycleStage,
        designerIds: projects.designerIds,
        totalContractPaise: projects.totalContractPaise,
      })
      .from(projects)
      .where(eq(projects.tenantId, ctx.tenantId));

    const allProjectIds = allProjects.map((p) => p.id);

    // c) Get approved quote IDs for all tenant projects (in one query)
    interface ApprovedQuoteRow { id: string; projectId: string }
    let approvedQuotes: ApprovedQuoteRow[] = [];
    if (allProjectIds.length > 0) {
      approvedQuotes = await db
        .select({ id: quotes.id, projectId: quotes.projectId })
        .from(quotes)
        .where(
          and(
            eq(quotes.tenantId, ctx.tenantId),
            eq(quotes.status, 'approved'),
            inArray(quotes.projectId, allProjectIds),
          ),
        );
    }

    const approvedQuoteIds = approvedQuotes.map((q) => q.id);

    // d) Get quote line aggregates for those approved quotes (one query)
    interface QuoteLineAgg {
      quoteId: string;
      totalMarginPaise: string;
      totalClientPaise: string;
    }
    let quoteLineAggs: QuoteLineAgg[] = [];
    if (approvedQuoteIds.length > 0) {
      quoteLineAggs = await db
        .select({
          quoteId: quoteLines.quoteId,
          totalMarginPaise: sql<string>`COALESCE(SUM(${quoteLines.marginPaise}), 0)`,
          totalClientPaise: sql<string>`COALESCE(SUM(${quoteLines.clientRatePaise} * ${quoteLines.qty}), 0)`,
        })
        .from(quoteLines)
        .where(inArray(quoteLines.quoteId, approvedQuoteIds))
        .groupBy(quoteLines.quoteId);
    }

    // e) Get deliverable revision averages per project (one query)
    interface DeliverableAgg {
      projectId: string;
      avgRevisionCount: string;
    }
    let deliverableAggs: DeliverableAgg[] = [];
    if (allProjectIds.length > 0) {
      deliverableAggs = await db
        .select({
          projectId: deliverables.projectId,
          avgRevisionCount: sql<string>`AVG(${deliverables.revisionCount})`,
        })
        .from(deliverables)
        .where(inArray(deliverables.projectId, allProjectIds))
        .groupBy(deliverables.projectId);
    }

    // Build lookup maps
    const quoteLineAggByQuoteId = new Map<string, QuoteLineAgg>(
      quoteLineAggs.map((a) => [a.quoteId, a]),
    );

    // quoteId → projectId map from approvedQuotes
    const projectIdByQuoteId = new Map<string, string>(
      approvedQuotes.map((q) => [q.id, q.projectId]),
    );

    // projectId → { totalMarginPaise, totalClientPaise }
    const marginByProjectId = new Map<string, { margin: number; client: number }>();
    for (const agg of quoteLineAggs) {
      const projectId = projectIdByQuoteId.get(agg.quoteId);
      if (!projectId) continue;
      const existing = marginByProjectId.get(projectId) ?? { margin: 0, client: 0 };
      marginByProjectId.set(projectId, {
        margin: existing.margin + Number(agg.totalMarginPaise),
        client: existing.client + Number(agg.totalClientPaise),
      });
    }

    const avgRevisionByProjectId = new Map<string, number>(
      deliverableAggs.map((a) => [a.projectId, Number(a.avgRevisionCount)]),
    );

    // f) Assemble per-designer metrics
    const data: DesignerMetrics[] = designers.map((designer) => {
      const designerProjects = allProjects.filter((p) =>
        p.designerIds.includes(designer.id),
      );

      const activeProjectCount = designerProjects.filter(
        (p) => p.lifecycleStage !== 'complete',
      ).length;

      const completedProjects = designerProjects.filter(
        (p) => p.lifecycleStage === 'complete',
      ).length;

      const totalContractPaise = designerProjects.reduce(
        (sum, p) => sum + (p.totalContractPaise ?? 0),
        0,
      );

      // Aggregate margin across all designer's projects' approved quote lines
      let totalMarginPaise = 0;
      let totalClientForMarginPaise = 0;
      for (const p of designerProjects) {
        const m = marginByProjectId.get(p.id);
        if (m) {
          totalMarginPaise += m.margin;
          totalClientForMarginPaise += m.client;
        }
      }

      const avgMarginPct =
        totalClientForMarginPaise > 0
          ? Math.round((totalMarginPaise / totalClientForMarginPaise) * 10000) / 100
          : null;

      // Average of per-project avg revision counts
      const revisionValues = designerProjects
        .map((p) => avgRevisionByProjectId.get(p.id))
        .filter((v): v is number => v !== undefined);

      const avgRevisionCount =
        revisionValues.length > 0
          ? Math.round(
              (revisionValues.reduce((s, v) => s + v, 0) / revisionValues.length) * 100,
            ) / 100
          : null;

      return {
        userId: designer.id,
        fullName: designer.fullName,
        phone: designer.phone ?? null,
        activeProjectCount,
        completedProjects,
        totalContractPaise,
        avgMarginPct,
        avgRevisionCount,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[analytics/designers GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
