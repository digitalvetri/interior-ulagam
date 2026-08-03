import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai';

interface LeadCreatedData {
  leadId: string;
  tenantId: string;
  inboundText?: string; // WhatsApp message text that created this lead, if any
}

const EnrichmentSchema = z.object({
  propertyType: z.enum(['apartment', 'villa', 'independent_house', 'office', 'commercial', 'other']).nullable(),
  projectLocation: z.string().max(100).nullable(),
  budgetBand: z.string().max(50).nullable(),
  confidence: z.number().min(0).max(100),
});

export const leadEnrich = defineJob(
  { id: 'lead-enrich', name: 'Lead Auto-Enrichment' },
  { event: 'lead/created' },
  async ({ event, step }) => {
    const { leadId, tenantId, inboundText } = event.data as LeadCreatedData;

    const lead = await step.run('fetch-lead', async () => {
      const [row] = await db
        .select({
          notes: leads.notes,
          propertyType: leads.propertyType,
          projectLocation: leads.projectLocation,
          budgetBand: leads.budgetBand,
        })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);
      return row ?? null;
    });

    if (!lead) return { skipped: true, reason: 'lead not found' };

    // Skip if all three enrichment fields are already set (manual entry)
    if (lead.propertyType && lead.projectLocation && lead.budgetBand) {
      return { skipped: true, reason: 'already enriched' };
    }

    // Build the text to analyse — prefer inbound WA message, fallback to notes
    const text = inboundText ?? lead.notes ?? '';
    if (text.trim().length < 10) {
      return { skipped: true, reason: 'insufficient text' };
    }

    const enrichment = await step.run('ai-extract', async () => {
      return groqProvider.chatJSON({
        model: 'light',
        system: `You are an assistant for an interior design studio in South India.
Extract structured information from client inquiry messages.
Respond with JSON only. Use null for fields you cannot confidently extract.
For propertyType: choose from apartment, villa, independent_house, office, commercial, other.
For budgetBand: use Indian format like "10L-20L", "20L-50L", "50L+", "5L-10L", etc.
For projectLocation: extract the area/city name only (e.g. "Saibaba Colony", "Coimbatore", "RS Puram").
Set confidence to 0-100 reflecting how certain you are overall.`,
        user: `Client message: "${text}"`,
        schema: EnrichmentSchema,
      });
    });

    // Only write back fields that were empty AND AI is confident (>= 70%)
    if (enrichment.confidence < 70) {
      return { skipped: true, reason: `low confidence: ${enrichment.confidence}` };
    }

    const updates: Record<string, string | null> = {};
    if (!lead.propertyType && enrichment.propertyType) {
      updates.propertyType = enrichment.propertyType;
    }
    if (!lead.projectLocation && enrichment.projectLocation) {
      updates.projectLocation = enrichment.projectLocation;
    }
    if (!lead.budgetBand && enrichment.budgetBand) {
      updates.budgetBand = enrichment.budgetBand;
    }

    if (Object.keys(updates).length === 0) {
      return { skipped: true, reason: 'no new fields to update' };
    }

    await step.run('write-enrichment', async () => {
      // Intentionally NOT touching lastActivityAt — enrichment is not human activity
      await db
        .update(leads)
        .set(updates)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
    });

    // Re-score now that fields are filled in
    await step.sendEvent('trigger-rescore', {
      name: 'lead/score.compute',
      data: { leadId, tenantId },
    });

    return { leadId, enriched: updates, confidence: enrichment.confidence };
  },
);
