import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

type LeadStage =
  | 'new' | 'contacted' | 'qualified' | 'site_visit' | 'measurement' | 'measured' | 'booked'
  | 'quotation' | 'negotiation' | 'won' | 'lost'
  // legacy
  | 'site_visit_scheduled' | 'consultation_done' | 'proposal_sent';

interface LeadStatsResponse {
  new: number;
  contacted: number;
  qualified: number;
  site_visit: number;
  measurement: number;
  measured: number;
  booked: number;
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
  measured: 0,
  booked: 0,
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
      .where(and(eq(leads.tenantId, ctx.tenantId), isNull(leads.archivedAt)))
      .groupBy(leads.stage);

    // Legacy stage values that predate the current stage enum
    const LEGACY_STAGE_MAP: Partial<Record<LeadStage, keyof LeadStatsResponse>> = {
      site_visit_scheduled: 'site_visit',
      consultation_done:    'qualified',
      proposal_sent:        'quotation',
    };

    const counts: LeadStatsResponse = { ...ZERO_STATS };
    const budgets: Record<string, number> = { ...ZERO_STATS };
    for (const row of rows) {
      const stage = row.stage as LeadStage;
      const canonical = (LEGACY_STAGE_MAP[stage] ?? stage) as keyof LeadStatsResponse;
      if (canonical in counts) {
        counts[canonical] += row.count;
        budgets[canonical] = (budgets[canonical] ?? 0) + Number(row.sumPaise);
      }
    }

    return NextResponse.json({ data: { counts, budgets } });
  } catch (e) {
    console.error('[GET /api/v1/leads/stats]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
