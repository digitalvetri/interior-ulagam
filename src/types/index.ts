import { z } from 'zod';

// ─── Lead ─────────────────────────────────────────────────────────────────────

export const LeadStageSchema = z.enum([
  'new', 'site_visit_scheduled', 'consultation_done',
  'proposal_sent', 'negotiation', 'won', 'lost',
]);
export type LeadStage = z.infer<typeof LeadStageSchema>;

export const LeadSourceSchema = z.enum([
  'instagram', 'whatsapp', 'referral', 'website', 'walk_in', 'other',
]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const CreateLeadSchema = z.object({
  contactName: z.string().min(1),
  contactPhone: z.string().min(10),
  source: LeadSourceSchema,
  budgetBand: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

// ─── Quote ────────────────────────────────────────────────────────────────────

export const QuoteLineSchema = z.object({
  room: z.string().min(1),
  item: z.string().min(1),
  description: z.string().optional(),
  qty: z.number().int().positive(),
  unit: z.string().default('nos'),
  clientRatePaise: z.number().int().nonnegative(),
  costRatePaise: z.number().int().nonnegative(),
  hsnSac: z.string().optional(),
  materialId: z.string().uuid().optional(),
});
export type QuoteLineInput = z.infer<typeof QuoteLineSchema>;

// Margin formula (always computed here, never trusted from client)
export function computeMarginPaise(clientRatePaise: number, costRatePaise: number, qty: number): number {
  return (clientRatePaise - costRatePaise) * qty;
}

// ─── AI output schemas ────────────────────────────────────────────────────────

export const SiteLogAIParseSchema = z.object({
  stage: z.string(),
  progressPct: z.number().int().min(0).max(100),
  blockers: z.array(z.string()),
  labourCount: z.number().int().nonnegative(),
  delayFlag: z.boolean(),
});
export type SiteLogAIParse = z.infer<typeof SiteLogAIParseSchema>;

// ─── GST helpers ─────────────────────────────────────────────────────────────

export function computeGst(subtotalPaise: number, placeOfSupply: string, studioState = 'TN'): {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  isInterstate: boolean;
} {
  const isInterstate = placeOfSupply !== studioState;
  const gstRatePct = 18; // Works contract
  const totalGstPaise = Math.round(subtotalPaise * gstRatePct / 100);

  if (isInterstate) {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: totalGstPaise, isInterstate: true };
  }
  const half = Math.round(totalGstPaise / 2);
  return { cgstPaise: half, sgstPaise: totalGstPaise - half, igstPaise: 0, isInterstate: false };
}
