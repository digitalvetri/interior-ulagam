import type { MilestoneView } from '@/lib/project-money/calc';

type StoredStatus = 'pending' | 'link_sent' | 'paid' | 'overdue';

/**
 * Should the daily escalation flip this milestone to 'overdue'?
 * Only when the money engine says it is overdue (fallen due, past the grace
 * days, balance unpaid) and it is not already paid or flagged.
 */
export function shouldMarkOverdue(view: Pick<MilestoneView, 'status' | 'balancePaise'>, stored: StoredStatus): boolean {
  if (stored === 'paid' || stored === 'overdue') return false;
  return view.status === 'overdue' && view.balancePaise > 0;
}
