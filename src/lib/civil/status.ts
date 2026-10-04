import type { CivilJobStatus } from '@/types/civil';

export interface JobBillingState {
  status: CivilJobStatus;
  billNo: string | null;
  billDate: string | null;
  paidDate: string | null;
}

export interface StatusChangeInput {
  billNo?: string;
  billDate?: string;
  paidDate?: string;
}

export type StatusPlan =
  | { ok: true; patch: JobBillingState }
  | { ok: false; error: string };

const RANK: Record<CivilJobStatus, number> = { done: 0, billed: 1, paid: 2 };

export const STATUS_LABEL: Record<CivilJobStatus, string> = {
  done: 'Done', billed: 'Billed', paid: 'Paid',
};

/** Lines (and so the amount) are frozen once a bill has gone out. */
export function canEditLines(status: CivilJobStatus): boolean {
  return RANK[status] < RANK.billed;
}

/**
 * Decide the new billing fields for a status change. Moving forward needs the
 * facts of the new stage (bill no. + date, paid date); moving back clears the
 * facts of every stage left behind, so a "Done" job never carries a bill number.
 */
export function planStatusChange(job: JobBillingState, to: CivilJobStatus, input: StatusChangeInput): StatusPlan {
  if (job.status === to) return { ok: false, error: `Job is already ${STATUS_LABEL[to]}.` };

  // Billing again replaces the bill; marking paid keeps a bill already on the job
  // (the bulk dialog sends one bill no. for jobs that may each have their own).
  const billNo = (to === 'paid' ? (job.billNo || input.billNo?.trim()) : (input.billNo?.trim() || job.billNo)) || null;
  const billDate = (to === 'paid' ? (job.billDate || input.billDate) : (input.billDate || job.billDate)) || null;
  const paidDate = input.paidDate || job.paidDate;

  if (RANK[to] >= RANK.billed && (!billNo || !billDate)) {
    return { ok: false, error: 'Enter the bill number and bill date.' };
  }
  if (to === 'paid' && !input.paidDate) {
    return { ok: false, error: 'Enter the date the payment was received.' };
  }

  return {
    ok: true,
    patch: {
      status: to,
      billNo: RANK[to] >= RANK.billed ? billNo : null,
      billDate: RANK[to] >= RANK.billed ? billDate : null,
      paidDate: to === 'paid' ? paidDate : null,
    },
  };
}
