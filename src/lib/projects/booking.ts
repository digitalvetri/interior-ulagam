// Pure rules used when a quote/lead becomes a project. No database access.
// All amounts are integer paise.

/**
 * Contract value for a project booked from a quote — EXCLUDING GST.
 * projects.total_contract_paise is ex-GST; the money engine adds GST on top
 * using projects.gst_pct, so the quote's GST-inclusive total must never be used.
 */
export function contractFromQuote(q: { subtotalPaise: number; discountPaise: number }): number {
  return Math.max(0, Number(q.subtotalPaise) - Number(q.discountPaise));
}

export interface MilestoneSeed {
  label: string;
  pctOfTotal: number;
  amountPaise: number;
  sortOrder: number;
}

/** Default 10 / 40 / 40 / 10 milestone plan (CLAUDE.md "Milestone default split"). */
export const DEFAULT_MILESTONE_PLAN: readonly { label: string; pctOfTotal: number }[] = [
  { label: 'Advance', pctOfTotal: 10 },
  { label: 'Design Approval', pctOfTotal: 40 },
  { label: 'Work Completion', pctOfTotal: 40 },
  { label: 'Handover', pctOfTotal: 10 },
];

/**
 * Split an ex-GST contract over a milestone plan. The last milestone absorbs the
 * rounding so the amounts always sum exactly to the contract.
 */
export function splitMilestones(
  contractPaise: number,
  plan: readonly { label: string; pctOfTotal: number }[] = DEFAULT_MILESTONE_PLAN,
): MilestoneSeed[] {
  let allocated = 0;
  return plan.map((p, i) => {
    const isLast = i === plan.length - 1;
    const amountPaise = isLast ? contractPaise - allocated : Math.round((contractPaise * p.pctOfTotal) / 100);
    allocated += amountPaise;
    return { label: p.label, pctOfTotal: p.pctOfTotal, amountPaise, sortOrder: i };
  });
}
