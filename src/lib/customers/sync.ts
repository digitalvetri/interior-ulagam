import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, customerActivities, leads } from '@/lib/db/schema';
import type { CustomerStage } from '@/types/customers';

// ─── Stage mapping ────────────────────────────────────────────────────────────
// Lead's 7 pipeline stages → Customer's 4 lifecycle stages.
// "won" → client. "lost" maps to lead (dormant), not past_client — that's
// a manual promotion after the relationship has fully ended.

const LEAD_TO_CUSTOMER_STAGE: Record<string, CustomerStage> = {
  new:                  'lead',
  site_visit_scheduled: 'lead',
  consultation_done:    'opportunity',
  proposal_sent:        'opportunity',
  negotiation:          'opportunity',
  won:                  'client',
  lost:                 'lead',
};

// Rank order — used to enforce the no-downgrade rule.
const STAGE_RANK: Record<CustomerStage, number> = {
  lead:        0,
  opportunity: 1,
  client:      2,
  past_client: 3,
};

export function mapLeadStageToCustomerStage(leadStage: string): CustomerStage {
  return LEAD_TO_CUSTOMER_STAGE[leadStage] ?? 'lead';
}

// ─── Lead-to-customer upsert ──────────────────────────────────────────────────
// Called inline when a lead is created. Matches by (tenantId, phone) — the
// most reliable identifier in this context (email is often absent/shared).
// Never downgrades an existing customer's stage.

interface LeadSnapshot {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  source: string;
  stage: string;
  ownerId: string | null;
  projectLocation: string | null;
  contactCity?: string | null;
  pincode?: string | null;
}

type CustomerSource = 'referral' | 'instagram' | 'whatsapp' | 'website' | 'walk_in' | 'imported' | 'other';
const VALID_SOURCES = new Set<CustomerSource>([
  'referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other',
]);
function toCustomerSource(s: string): CustomerSource {
  return VALID_SOURCES.has(s as CustomerSource) ? (s as CustomerSource) : 'other';
}

export async function upsertCustomerFromLead(
  lead: LeadSnapshot,
  tenantId: string,
): Promise<{ customerId: string; isNew: boolean }> {
  const targetStage = mapLeadStageToCustomerStage(lead.stage);

  const [existing] = await db
    .select({ id: customers.id, stage: customers.stage })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, lead.contactPhone)))
    .limit(1);

  if (existing) {
    // Only upgrade — never downgrade an existing customer's stage
    if (STAGE_RANK[targetStage] > STAGE_RANK[existing.stage]) {
      await db
        .update(customers)
        .set({ stage: targetStage })
        .where(and(eq(customers.id, existing.id), eq(customers.tenantId, tenantId)));
    }
    return { customerId: existing.id, isNew: false };
  }

  const [row] = await db
    .insert(customers)
    .values({
      tenantId,
      fullName:  lead.contactName,
      phone:     lead.contactPhone,
      email:     lead.contactEmail ?? null,
      source:    toCustomerSource(lead.source),
      stage:     targetStage,
      ownerId:   lead.ownerId ?? null,
      city:      lead.contactCity ?? lead.projectLocation ?? null,
      leadId:    lead.id,
    })
    .returning({ id: customers.id });

  return { customerId: row.id, isNew: true };
}

// ─── Stage propagation ────────────────────────────────────────────────────────
// Called when a lead's stage changes. Propagates upward only — a client who
// sends a second enquiry stays a client.

export async function propagateLeadStageToCustomer(
  customerId: string,
  newLeadStage: string,
  tenantId: string,
  performedBy: string | null,
): Promise<void> {
  const targetStage = mapLeadStageToCustomerStage(newLeadStage);

  const [existing] = await db
    .select({ stage: customers.stage })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!existing) return;
  if (STAGE_RANK[targetStage] <= STAGE_RANK[existing.stage]) return;

  await db
    .update(customers)
    .set({ stage: targetStage })
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

  await db.insert(customerActivities).values({
    tenantId,
    customerId,
    type: 'stage_change',
    title: `Stage updated to ${targetStage.replace('_', ' ')} (lead progressed to ${newLeadStage.replace(/_/g, ' ')})`,
    performedBy,
  });
}

// ─── Backfill ─────────────────────────────────────────────────────────────────
// Processes all existing leads that have no customerId yet.
// Idempotent — safe to run multiple times.

export async function backfillLeadsToCustomers(tenantId: string): Promise<{
  processed: number;
  created: number;
  linked: number;
  skipped: number;
}> {
  const unlinked = await db
    .select({
      id:              leads.id,
      contactName:     leads.contactName,
      contactPhone:    leads.contactPhone,
      contactEmail:    leads.contactEmail,
      source:          leads.source,
      stage:           leads.stage,
      ownerId:         leads.ownerId,
      projectLocation: leads.projectLocation,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      isNull(leads.customerId),
    ));

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const lead of unlinked) {
    try {
      const { customerId, isNew } = await upsertCustomerFromLead(lead, tenantId);

      // Link lead → customer
      await db
        .update(leads)
        .set({ customerId })
        .where(and(eq(leads.id, lead.id), eq(leads.tenantId, tenantId)));

      if (isNew) created++; else linked++;
    } catch {
      skipped++;
    }
  }

  return { processed: unlinked.length, created, linked, skipped };
}
