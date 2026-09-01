import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

type LeadStage =
  | 'new' | 'contacted' | 'qualified' | 'site_visit' | 'measurement'
  | 'quotation' | 'negotiation' | 'won' | 'lost'
  // legacy
  | 'site_visit_scheduled' | 'consultation_done' | 'proposal_sent';

interface LeadStatsResponse {
  new: number;
  contacted: number;
  qualified: number;
  site_visit: number;
  measurement: number;
  quotation: number;
  negotiation: number;
  won: number;
  lost: number;
}

// All active stages — initialised to 0 so empty stages are still present in output
const ZERO_STATS: LeadStatsResponse = {
  new: 0,
  contacted: 0,
  qualified: 0,
  site_visit: 0,
  measurement: 0,
  quotation: 0,
  negotiation: 0,
  won: 0,
  lost: 0,
};

// ─── GET /api/v1/leads/stats ─────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db
      .select({
        stage:    leads.stage,
        count:    sql<number>`count(*)::int`,
        sumPaise: sql<number>`coalesce(sum(${leads.projectValuePaise}), 0)`,
      })
      .from(leads)
      .where(eq(leads.tenantId, ctx.tenantId))
      .groupBy(leads.stage);

    const counts: LeadStatsResponse = { ...ZERO_STATS };
    const budgets: Record<string, number> = { ...ZERO_STATS };
    for (const row of rows) {
      const stage = row.stage as LeadStage;
      const key = stage as keyof LeadStatsResponse;
      if (key in counts) {
        counts[key] = row.count;
        budgets[stage] = Number(row.sumPaise);
      }
    }

    return NextResponse.json({ data: { counts, budgets } });
  } catch (e) {
    console.error('[GET /api/v1/leads/stats]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
