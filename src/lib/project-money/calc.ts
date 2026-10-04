// Project money — the one set of rules every money number in the app uses.
// Pure functions: no database, no clock (callers pass "today" as yyyy-mm-dd).
// All amounts are integer paise. Contract and costs are EXCLUDING GST.

export const STAGE_ORDER = [
  'design_pending', 'design_in_progress', 'design_approved',
  'procurement', 'execution', 'snagging', 'handover', 'complete',
] as const;
export type ProjectStage = (typeof STAGE_ORDER)[number];

/** Days after a milestone falls due before it counts as overdue. */
export const OVERDUE_GRACE_DAYS = 7;

const DAY = 86_400_000;
function toDay(iso: string): number { return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`); }
function daysBetween(fromIso: string, toIso: string): number { return Math.round((toDay(toIso) - toDay(fromIso)) / DAY); }
function pct1(part: number, whole: number): number { return Math.round((part / whole) * 1000) / 10; }

export function stageReached(current: ProjectStage, target: ProjectStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

/* ── Contract ───────────────────────────────────────────────────────────────── */

export function revisedContract(contractPaise: number | null, additions: readonly { amountPaise: number }[]): number {
  return (contractPaise ?? 0) + additions.reduce((s, a) => s + a.amountPaise, 0);
}

export function gstOf(amountPaise: number, gstPct: number): number {
  return Math.round((amountPaise * gstPct) / 100);
}

/* ── Milestones ─────────────────────────────────────────────────────────────── */

export type MilestoneStatus = 'paid' | 'part_paid' | 'overdue' | 'due' | 'upcoming';

export interface MilestoneInput {
  pctOfTotal: number;
  /** Stored amount — authoritative once the milestone is paid. */
  amountPaise: number;
  triggerStage: ProjectStage | null;
  dueOn: string | null;
  dueSince: string | null;
  paymentStatus: 'pending' | 'link_sent' | 'paid' | 'overdue';
  /** Sum of payment allocations to this milestone (incl. GST share). */
  receivedPaise: number;
}

export interface MilestoneView {
  amountPaise: number;
  gstPaise: number;
  totalPaise: number;
  receivedPaise: number;
  balancePaise: number;
  isDue: boolean;
  /** The day it fell due (or will, for a dated upcoming milestone); null if it waits on a stage. */
  dueDate: string | null;
  daysOverdue: number;
  status: MilestoneStatus;
}

export function milestoneState(
  m: MilestoneInput, project: { stage: ProjectStage; gstPct: number }, revisedPaise: number, today: string,
): MilestoneView {
  const amountPaise = m.paymentStatus === 'paid' && m.amountPaise > 0
    ? m.amountPaise
    : Math.round((revisedPaise * m.pctOfTotal) / 100);
  const gstPaise = gstOf(amountPaise, project.gstPct);
  const totalPaise = amountPaise + gstPaise;

  let isDue: boolean;
  let dueDate: string | null;
  if (m.dueSince) { isDue = true; dueDate = m.dueSince; }
  else if (m.dueOn) { isDue = m.dueOn <= today; dueDate = m.dueOn; }
  else if (m.triggerStage) { isDue = stageReached(project.stage, m.triggerStage); dueDate = isDue ? today : null; }
  else { isDue = true; dueDate = today; }

  const balancePaise = Math.max(0, totalPaise - m.receivedPaise);
  const sinceDue = isDue && dueDate ? daysBetween(dueDate, today) : 0;

  let status: MilestoneStatus;
  if (totalPaise > 0 && balancePaise === 0) status = 'paid';
  else if (isDue && sinceDue > OVERDUE_GRACE_DAYS) status = 'overdue';
  else if (m.receivedPaise > 0) status = 'part_paid';
  else status = isDue ? 'due' : 'upcoming';

  return {
    amountPaise, gstPaise, totalPaise, receivedPaise: m.receivedPaise, balancePaise, isDue, dueDate,
    daysOverdue: status === 'overdue' ? sinceDue : 0, status,
  };
}

/* ── Costs ──────────────────────────────────────────────────────────────────── */

/**
 * Expenses excluding GST. Vendor bills (raised against a PO) store the net amount;
 * everything logged through the expense form stores the gross, with GST alongside.
 */
export function expenseNetPaise(e: { amountPaise: number; gstAmountPaise: number; poId: string | null }): number {
  return e.poId ? e.amountPaise : Math.max(0, e.amountPaise - e.gstAmountPaise);
}

/** A purchase order's value from its lines (stored line totals; qty × rate for older rows). */
export function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as Record<string, unknown>[]).reduce((sum, l) => {
    if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
    const qty = typeof l.qty === 'number' ? l.qty : 0;
    const rate = typeof l.unitRatePaise === 'number' ? l.unitRatePaise : 0;
    return sum + qty * rate;
  }, 0);
}

/** What is still committed on a PO: its value less what has been billed against it (never negative). */
export function poCommittedPaise(po: { linesJson: unknown; status: string }, billedPaise: number): number {
  if (po.status === 'cancelled') return 0;
  return Math.max(0, poTotalPaise(po.linesJson) - billedPaise);
}

export interface CostBreakdown {
  materialPaise: number;
  contractLabourPaise: number;
  staffLabourPaise: number;
  otherPaise: number;
  totalPaise: number;
  /** Purchase orders not billed yet — forecast only, not in total. */
  committedPaise: number;
}

export function costBreakdown(
  expenses: readonly { category: string; amountPaise: number; gstAmountPaise: number; poId: string | null; voidedAt: Date | string | null }[],
  staffLabourPaise: number,
  committedPaise: number,
): CostBreakdown {
  let materialPaise = 0, contractLabourPaise = 0, otherPaise = 0;
  for (const e of expenses) {
    if (e.voidedAt) continue;
    const net = expenseNetPaise(e);
    if (e.category === 'material') materialPaise += net;
    else if (e.category === 'labour') contractLabourPaise += net;
    else otherPaise += net;
  }
  return {
    materialPaise, contractLabourPaise, staffLabourPaise, otherPaise,
    totalPaise: materialPaise + contractLabourPaise + staffLabourPaise + otherPaise,
    committedPaise,
  };
}

export function profitView(revisedPaise: number, actualCostPaise: number, committedPaise: number) {
  const profitPaise = revisedPaise - actualCostPaise;
  const expectedProfitPaise = revisedPaise - actualCostPaise - committedPaise;
  return {
    profitPaise,
    marginPct: revisedPaise > 0 ? pct1(profitPaise, revisedPaise) : null,
    expectedProfitPaise,
    expectedMarginPct: revisedPaise > 0 ? pct1(expectedProfitPaise, revisedPaise) : null,
  };
}

/* ── Duration ───────────────────────────────────────────────────────────────── */

export function durationView(
  d: { startedAt: string | null; expectedEndAt: string | null; handoverAt: string | null }, today: string,
) {
  const end = d.handoverAt ? d.handoverAt.slice(0, 10) : today;
  const elapsedDays = d.startedAt ? Math.max(0, daysBetween(d.startedAt, end)) : null;
  const plannedDays = d.startedAt && d.expectedEndAt ? Math.max(1, daysBetween(d.startedAt, d.expectedEndAt)) : null;
  const daysLeft = d.expectedEndAt ? daysBetween(end, d.expectedEndAt) : null;
  const timeUsedPct = elapsedDays !== null && plannedDays ? Math.round((elapsedDays / plannedDays) * 100) : null;
  return { elapsedDays, plannedDays, daysLeft, timeUsedPct, finished: !!d.handoverAt };
}

/* ── Payments ───────────────────────────────────────────────────────────────── */

/**
 * Spread a payment over milestones: due ones first, oldest first; then upcoming
 * ones in order. Anything left over is an advance, kept unallocated.
 */
export function allocateOldestFirst(
  amountPaise: number,
  milestones: readonly { id: string; balancePaise: number; isDue: boolean; order: number }[],
): { allocations: { milestoneId: string; amountPaise: number }[]; unallocatedPaise: number } {
  const queue = [...milestones]
    .filter(m => m.balancePaise > 0)
    .sort((a, b) => Number(b.isDue) - Number(a.isDue) || a.order - b.order);
  let left = amountPaise;
  const allocations: { milestoneId: string; amountPaise: number }[] = [];
  for (const m of queue) {
    if (left <= 0) break;
    const take = Math.min(left, m.balancePaise);
    allocations.push({ milestoneId: m.id, amountPaise: take });
    left -= take;
  }
  return { allocations, unallocatedPaise: left };
}

/* ── Ledger ─────────────────────────────────────────────────────────────────── */

export type LedgerKind = 'due' | 'payment' | 'discount' | 'refund' | 'write_off';

export interface LedgerEntry {
  date: string;
  kind: LedgerKind;
  /** Increases what the client owes. */
  owedPaise: number;
  /** Reduces what the client owes. */
  paidPaise: number;
  label: string;
}

const SAME_DAY_ORDER: Record<LedgerKind, number> = { due: 0, refund: 1, payment: 2, discount: 3, write_off: 4 };

export function ledgerWithBalance<T extends LedgerEntry>(entries: readonly T[]): (T & { balancePaise: number })[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || SAME_DAY_ORDER[a.kind] - SAME_DAY_ORDER[b.kind]);
  let balance = 0;
  return sorted.map(e => {
    balance += e.owedPaise - e.paidPaise;
    return { ...e, balancePaise: balance };
  });
}
