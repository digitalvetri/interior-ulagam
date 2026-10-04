import type { MilestoneStatus, ProjectStage } from '@/lib/project-money/calc';

// JSON shapes of the project-money API, as pages receive them. Paise everywhere.

export interface MoneyMilestone {
  id: string;
  label: string;
  pctOfTotal: number;
  triggerStage: ProjectStage | null;
  dueOn: string | null;
  sortOrder: number;
  razorpayLinkId: string | null;
  /** Has money against it: can be renamed, not removed. */
  locked: boolean;
  amountPaise: number;
  gstPaise: number;
  totalPaise: number;
  receivedPaise: number;
  balancePaise: number;
  isDue: boolean;
  dueDate: string | null;
  daysOverdue: number;
  status: MilestoneStatus;
}

/** GET /api/v1/projects/:id/money — profit and staff cost are null for non-owners. */
export interface ProjectMoney {
  project: {
    id: string; name: string; stage: ProjectStage; customerId: string | null; gstPct: number;
    startedAt: string | null; expectedEndAt: string | null; handoverAt: string | null;
  };
  contract: {
    contractPaise: number | null;
    additions: { id: string; description: string; amountPaise: number; addedOn: string }[];
    additionsPaise: number;
    revisedPaise: number;
    gstPaise: number;
    totalWithGstPaise: number;
    milestonePctTotal: number;
  };
  milestones: MoneyMilestone[];
  billing: {
    duePaise: number; receivedPaise: number; allocatedPaise: number; advancePaise: number;
    outstandingPaise: number; overduePaise: number; paidOutPaise: number; cashInHandPaise: number;
  };
  costs: {
    materialPaise: number; contractLabourPaise: number; staffLabourPaise: number | null; otherPaise: number;
    totalPaise: number; committedPaise: number; staffDays: number | null;
  };
  profit: {
    profitPaise: number; marginPct: number | null; expectedProfitPaise: number; expectedMarginPct: number | null;
    quotedMarginPct: number | null;
  } | null;
  duration: {
    elapsedDays: number | null; plannedDays: number | null; daysLeft: number | null; timeUsedPct: number | null;
    finished: boolean; collectedPct: number | null; stagePct: number;
  };
}

export type LedgerKind = 'due' | 'payment' | 'discount' | 'refund' | 'write_off';

/** GET /api/v1/customers/:id/ledger */
export interface CustomerLedger {
  customer: { id: string; fullName: string; phone: string };
  projects: { id: string; name: string }[];
  totals: {
    contractWithGstPaise: number; duePaise: number; receivedPaise: number; adjustmentsPaise: number;
    outstandingPaise: number; advancePaise: number; overduePaise: number;
  };
  entries: {
    date: string; kind: LedgerKind; owedPaise: number; paidPaise: number; label: string; balancePaise: number;
    projectId: string | null; projectName: string | null; ref: string | null; paymentId: string | null;
  }[];
}

/** GET /api/v1/staff-days?week= */
export interface StaffWeek {
  weekStart: string;
  workingDays: number;
  staff: { id: string; fullName: string; role: string; salaryPaise: number; dayRatePaise: number }[];
  projects: { id: string; name: string; stage: ProjectStage }[];
  logs: { userId: string; projectId: string | null; days: number }[];
}

/** POST /api/v1/payments response */
export interface RecordedPayment {
  id: string;
  receiptNumber: string | null;
  amountPaise: number;
  allocatedPaise: number;
  advancePaise: number;
}

export const STAGE_LABEL: Record<ProjectStage, string> = {
  design_pending: 'Design pending', design_in_progress: 'Designing', design_approved: 'Design approved',
  procurement: 'Procurement', execution: 'Execution', snagging: 'Snagging', handover: 'Handover', complete: 'Complete',
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  paid: 'Paid', part_paid: 'Part paid', overdue: 'Overdue', due: 'Due', upcoming: 'Upcoming',
};
