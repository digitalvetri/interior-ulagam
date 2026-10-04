import type { CivilJobStatus } from '@/types/civil';

// Profit = what the client is billed − what the work really cost.
// Real costs are private to the owner and never leave the app in a download.

/** Jobs that count towards profit — every status, since jobs are only entered once finished. */
export const COUNTED_STATUSES: readonly CivilJobStatus[] = ['done', 'billed', 'paid'];

/** A job's real cost: entered line costs plus costs that are not billed at all. */
export function jobCost(
  lines: readonly { costPaise: number | null }[],
  extras: readonly { amountPaise: number }[],
): { costPaise: number; linesWithoutCost: number } {
  let costPaise = 0;
  let linesWithoutCost = 0;
  for (const l of lines) {
    if (l.costPaise === null) linesWithoutCost++;
    else costPaise += l.costPaise;
  }
  for (const e of extras) costPaise += e.amountPaise;
  return { costPaise, linesWithoutCost };
}

export function profitOf(billedPaise: number, costPaise: number): { profitPaise: number; marginPct: number | null } {
  const profitPaise = billedPaise - costPaise;
  return {
    profitPaise,
    marginPct: billedPaise > 0 ? Math.round((profitPaise / billedPaise) * 1000) / 10 : null,
  };
}
