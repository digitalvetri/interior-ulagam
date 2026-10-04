import { z } from 'zod';

// Shared client/server schemas for project money. Amounts are integer paise, ex-GST.

export const PROJECT_STAGES = [
  'design_pending', 'design_in_progress', 'design_approved',
  'procurement', 'execution', 'snagging', 'handover', 'complete',
] as const;

export const GST_RATES = [0, 5, 12, 18, 28] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-30');
const money = z.number().int().min(0).max(100_000_000_000_00);

export const ProjectContractInput = z.object({
  contractPaise: money.nullable(),
  gstPct: z.union(GST_RATES.map(r => z.literal(r)) as unknown as [z.ZodLiteral<0>, z.ZodLiteral<5>, z.ZodLiteral<12>, z.ZodLiteral<18>, z.ZodLiteral<28>]),
  startedAt: isoDate.nullable(),
  expectedEndAt: isoDate.nullable(),
  additions: z.array(z.object({
    description: z.string().trim().min(1, 'Describe the extra work').max(300),
    amountPaise: money,
    addedOn: isoDate,
  })).max(100),
  milestones: z.array(z.object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1, 'Name each milestone').max(120),
    pctOfTotal: z.number().int().min(0).max(100),
    triggerStage: z.enum(PROJECT_STAGES).nullable(),
    dueOn: isoDate.nullable(),
  })).max(20),
}).refine(v => v.milestones.length === 0 || v.milestones.reduce((s, m) => s + m.pctOfTotal, 0) === 100, {
  message: 'Milestone percentages must add up to 100%', path: ['milestones'],
}).refine(v => !v.startedAt || !v.expectedEndAt || v.startedAt <= v.expectedEndAt, {
  message: 'Planned handover must be after the start date', path: ['expectedEndAt'],
});
export type ProjectContractInput = z.infer<typeof ProjectContractInput>;

export const LedgerAdjustmentInput = z.object({
  kind: z.enum(['discount', 'refund', 'write_off']),
  amountPaise: money.min(1),
  reason: z.string().trim().min(3, 'Give a reason').max(300),
  adjDate: isoDate,
  projectId: z.string().uuid().nullable(),
});
export type LedgerAdjustmentInput = z.infer<typeof LedgerAdjustmentInput>;

export const StaffDaysInput = z.object({
  weekStart: isoDate,
  rows: z.array(z.object({
    userId: z.string().uuid(),
    projectId: z.string().uuid().nullable(),
    days: z.number().min(0).max(7).multipleOf(0.5),
  })).max(2000),
});
export type StaffDaysInput = z.infer<typeof StaffDaysInput>;
