import { and, count, eq, gte, notInArray } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { leads, waMessages } from '@/lib/db/schema';
import type { ScoreBreakdown } from '@/types/leads';

interface LeadScoreData {
  leadId: string;
  tenantId: string;
}

type LeadRow = {
  id: string;
  tenantId: string;
  contactPhone: string;
  contactEmail: string | null;
  source: string;
  propertyType: string | null;
  projectLocation: string | null;
  budgetBand: string | null;
  projectValuePaise: number | null;
  designerName: string | null;
  followUpDate: Date | null;
  notes: string | null;
  ownerId: string | null;
  lastActivityAt: Date;
};

// ─── Scoring formulas ─────────────────────────────────────────────────────────

function recencyScore(lastActivityAt: Date): number {
  const days = Math.floor((Date.now() - lastActivityAt.getTime()) / 86_400_000);
  if (days <= 2)  return 30;
  if (days <= 7)  return 20;
  if (days <= 14) return 10;
  return 0;
}

function valueScore(projectValuePaise: number | null): number {
  if (!projectValuePaise || projectValuePaise <= 0) return 0;
  const lakhs = projectValuePaise / 10_000_000; // paise → lakhs
  if (lakhs >= 50) return 25;
  if (lakhs >= 20) return 20;
  if (lakhs >= 10) return 15;
  if (lakhs >= 5)  return 10;
  return 5;
}

function completenessScore(lead: LeadRow): number {
  const fields = [
    lead.contactPhone,
    lead.contactEmail,
    lead.propertyType,
    lead.projectLocation,
    lead.budgetBand,
    lead.projectValuePaise != null ? 'set' : null,
    lead.designerName,
    lead.followUpDate != null ? 'set' : null,
    lead.notes,
    lead.ownerId,
  ];
  const filled = fields.filter((f) => f != null && String(f).trim().length > 0).length;
  return Math.round((filled / fields.length) * 20);
}

function sourceScore(source: string): number {
  const map: Record<string, number> = {
    referral:  15,
    walk_in:   12,
    whatsapp:  12,
    instagram: 10,
    website:    8,
    other:      5,
  };
  return map[source] ?? 5;
}

// Sync fallback when waMessages data is unavailable: reward notes + follow-up being set
function engagementFallback(lead: LeadRow): number {
  let pts = 0;
  if (lead.notes && lead.notes.trim().length > 10) pts += 5;
  if (lead.followUpDate) pts += 5;
  return pts;
}

// Async: count inbound WA messages in the last 30 days for this phone
async function waEngagementScore(tenantId: string, contactPhone: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [row] = await db
    .select({ cnt: count() })
    .from(waMessages)
    .where(
      and(
        eq(waMessages.tenantId, tenantId),
        eq(waMessages.threadId, contactPhone),
        eq(waMessages.direction, 'inbound'),
        gte(waMessages.createdAt, since),
      ),
    );
  const msgs = Number(row?.cnt ?? 0);
  if (msgs >= 5) return 10;
  if (msgs >= 3) return 7;
  if (msgs >= 1) return 4;
  return 0;
}

function buildBreakdown(lead: LeadRow, engagementPts: number): ScoreBreakdown {
  return {
    recency:      recencyScore(lead.lastActivityAt),
    value:        valueScore(lead.projectValuePaise),
    completeness: completenessScore(lead),
    source:       sourceScore(lead.source),
    engagement:   engagementPts,
  };
}

const LEAD_SELECT = {
  id: leads.id,
  tenantId: leads.tenantId,
  contactPhone: leads.contactPhone,
  contactEmail: leads.contactEmail,
  source: leads.source,
  propertyType: leads.propertyType,
  projectLocation: leads.projectLocation,
  budgetBand: leads.budgetBand,
  projectValuePaise: leads.projectValuePaise,
  designerName: leads.designerName,
  followUpDate: leads.followUpDate,
  notes: leads.notes,
  ownerId: leads.ownerId,
  lastActivityAt: leads.lastActivityAt,
} as const;

// ─── Inngest function ─────────────────────────────────────────────────────────

export const leadScoreCompute = inngest.createFunction(
  { id: 'lead-score-compute', name: 'Lead Score Compute' },
  [
    { event: 'lead/score.compute' },
    // Nightly at 2 AM IST = 20:30 UTC
    { cron: '30 20 * * *' },
  ],
  async ({ event, step }) => {
    // Cron: score active leads only — terminal leads don't benefit from rescoring
    if (!event.data) {
      return await step.run('score-all-leads', async () => {
        const allLeads = await db.select(LEAD_SELECT).from(leads)
          .where(notInArray(leads.stage, ['won', 'lost']));
        let updated = 0;
        for (const lead of allLeads) {
          const eng = engagementFallback(lead);
          const breakdown = buildBreakdown(lead, eng);
          const score = Math.min(
            100,
            breakdown.recency + breakdown.value + breakdown.completeness +
            breakdown.source + breakdown.engagement,
          );
          // Intentionally NOT updating lastActivityAt — scoring is not human activity
          await db
            .update(leads)
            .set({ score, scoreBreakdown: breakdown })
            .where(and(eq(leads.id, lead.id), eq(leads.tenantId, lead.tenantId)));
          updated++;
        }
        return { updated };
      });
    }

    // Event-triggered: score a single lead with live WA engagement query
    const { leadId, tenantId } = event.data as LeadScoreData;
    return await step.run('score-single-lead', async () => {
      const [lead] = await db
        .select(LEAD_SELECT)
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (!lead) return { skipped: true };

      const waScore = await waEngagementScore(tenantId, lead.contactPhone);
      const eng = waScore > 0 ? waScore : engagementFallback(lead);
      const breakdown = buildBreakdown(lead, eng);
      const score = Math.min(
        100,
        breakdown.recency + breakdown.value + breakdown.completeness +
        breakdown.source + breakdown.engagement,
      );

      await db
        .update(leads)
        .set({ score, scoreBreakdown: breakdown })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      return { leadId, score, breakdown };
    });
  },
);
