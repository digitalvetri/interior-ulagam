import { describe, it, expect } from 'vitest';
import {
  revisedContract, gstOf, milestoneState, expenseNetPaise, costBreakdown, profitView,
  durationView, allocateOldestFirst, ledgerWithBalance, stageReached,
} from '@/lib/project-money/calc';

const TODAY = '2026-10-04';
const project = { stage: 'execution' as const, gstPct: 18 };

describe('contract', () => {
  it('adds extra work to the typed contract', () => {
    expect(revisedContract(1_000_000_00, [{ amountPaise: 40_000_00 }])).toBe(1_040_000_00);
    expect(revisedContract(null, [])).toBe(0);
  });
  it('works out GST on top', () => {
    expect(gstOf(104_000_00, 18)).toBe(18_720_00);
    expect(gstOf(104_000_00, 0)).toBe(0);
  });
});

describe('milestoneState', () => {
  const base = { pctOfTotal: 40, amountPaise: 0, triggerStage: null, dueOn: null, dueSince: null, paymentStatus: 'pending' as const };

  it('takes its share of the revised contract plus GST', () => {
    const s = milestoneState({ ...base, dueOn: '2026-11-01', receivedPaise: 0 }, project, 1_040_000_00, TODAY);
    expect(s).toMatchObject({ amountPaise: 416_000_00, gstPaise: 74_880_00, totalPaise: 490_880_00, status: 'upcoming', isDue: false });
  });

  it('falls due when its stage is reached', () => {
    expect(stageReached('execution', 'procurement')).toBe(true);
    expect(stageReached('procurement', 'handover')).toBe(false);
    const s = milestoneState({ ...base, triggerStage: 'procurement', dueSince: '2026-10-01', receivedPaise: 0 }, project, 1_040_000_00, TODAY);
    expect(s.isDue).toBe(true);
    expect(s.dueDate).toBe('2026-10-01');
    expect(s.status).toBe('due');
  });

  it('is overdue more than 7 days after it fell due, and counts the days', () => {
    const s = milestoneState({ ...base, dueOn: '2026-09-25', receivedPaise: 268_160_00 }, project, 1_040_000_00, TODAY);
    expect(s.status).toBe('overdue');
    expect(s.daysOverdue).toBe(9);
    expect(s.balancePaise).toBe(222_720_00);
  });

  it('is part paid, then paid', () => {
    expect(milestoneState({ ...base, dueOn: '2026-10-01', receivedPaise: 100 }, project, 1_040_000_00, TODAY).status).toBe('part_paid');
    expect(milestoneState({ ...base, dueOn: '2026-10-01', receivedPaise: 490_880_00 }, project, 1_040_000_00, TODAY).status).toBe('paid');
  });

  it('keeps the stored amount once paid, even if the contract changes later', () => {
    const s = milestoneState({ ...base, amountPaise: 400_000_00, paymentStatus: 'paid', dueOn: '2026-08-01', receivedPaise: 472_000_00 }, project, 1_040_000_00, TODAY);
    expect(s.amountPaise).toBe(400_000_00);
    expect(s.status).toBe('paid');
  });

  it('with no stage and no date it is due from the day it was created', () => {
    const s = milestoneState({ ...base, receivedPaise: 0 }, project, 1_000_00, TODAY);
    expect(s.isDue).toBe(true);
  });
});

describe('costs', () => {
  it('reads PO bills as net and other expenses as gross minus GST', () => {
    expect(expenseNetPaise({ amountPaise: 100_000, gstAmountPaise: 18_000, poId: 'po-1' })).toBe(100_000);
    expect(expenseNetPaise({ amountPaise: 118_000, gstAmountPaise: 18_000, poId: null })).toBe(100_000);
  });

  it('groups expenses and adds staff labour, ignoring cancelled ones', () => {
    const c = costBreakdown([
      { category: 'material', amountPaise: 300_000_00, gstAmountPaise: 0, poId: 'po', voidedAt: null },
      { category: 'material', amountPaise: 118_000, gstAmountPaise: 18_000, poId: null, voidedAt: null },
      { category: 'labour', amountPaise: 50_000_00, gstAmountPaise: 0, poId: null, voidedAt: null },
      { category: 'transport', amountPaise: 2_000_00, gstAmountPaise: 0, poId: null, voidedAt: null },
      { category: 'petty_cash', amountPaise: 999_99, gstAmountPaise: 0, poId: null, voidedAt: new Date() },
    ], 91_000_00, 85_000_00);
    expect(c).toEqual({
      materialPaise: 301_000_00, contractLabourPaise: 50_000_00, staffLabourPaise: 91_000_00, otherPaise: 2_000_00,
      totalPaise: 444_000_00, committedPaise: 85_000_00,
    });
  });
});

describe('profitView', () => {
  it('gives profit so far and expected final', () => {
    expect(profitView(1_040_000_00, 692_500_00, 85_000_00)).toEqual({
      profitPaise: 347_500_00, marginPct: 33.4, expectedProfitPaise: 262_500_00, expectedMarginPct: 25.2,
    });
  });
  it('has no margin without a contract', () => {
    expect(profitView(0, 1000, 0).marginPct).toBeNull();
  });
});

describe('durationView', () => {
  it('counts elapsed and remaining days and time used', () => {
    expect(durationView({ startedAt: '2026-07-01', expectedEndAt: '2026-10-30', handoverAt: null }, TODAY)).toEqual({
      elapsedDays: 95, plannedDays: 121, daysLeft: 26, timeUsedPct: 79, finished: false,
    });
  });
  it('shows late projects as negative days left', () => {
    expect(durationView({ startedAt: '2026-07-01', expectedEndAt: '2026-09-30', handoverAt: null }, TODAY).daysLeft).toBe(-4);
  });
  it('stops the clock at handover', () => {
    const d = durationView({ startedAt: '2026-07-01', expectedEndAt: '2026-10-30', handoverAt: '2026-10-10' }, '2026-12-01');
    expect(d).toMatchObject({ elapsedDays: 101, finished: true, daysLeft: 20 });
  });
  it('copes with missing dates', () => {
    expect(durationView({ startedAt: null, expectedEndAt: null, handoverAt: null }, TODAY)).toEqual({
      elapsedDays: null, plannedDays: null, daysLeft: null, timeUsedPct: null, finished: false,
    });
  });
});

describe('allocateOldestFirst', () => {
  const ms = [
    { id: 'a', balancePaise: 22_720_00, isDue: true, order: 2 },
    { id: 'b', balancePaise: 222_720_00, isDue: true, order: 3 },
    { id: 'c', balancePaise: 122_720_00, isDue: false, order: 4 },
    { id: 'z', balancePaise: 0, isDue: true, order: 1 },
  ];
  it('fills due milestones oldest first, then upcoming ones', () => {
    expect(allocateOldestFirst(100_000_00, ms)).toEqual({
      allocations: [{ milestoneId: 'a', amountPaise: 22_720_00 }, { milestoneId: 'b', amountPaise: 77_280_00 }],
      unallocatedPaise: 0,
    });
    expect(allocateOldestFirst(400_000_00, ms).allocations.map(a => a.milestoneId)).toEqual(['a', 'b', 'c']);
  });
  it('keeps any extra as an advance', () => {
    expect(allocateOldestFirst(400_000_00, ms).unallocatedPaise).toBe(400_000_00 - 368_160_00);
  });
});

describe('ledgerWithBalance', () => {
  it('sorts by date (owed before paid on the same day) and keeps a running balance', () => {
    const rows = ledgerWithBalance([
      { date: '2026-07-02', kind: 'payment', owedPaise: 0, paidPaise: 122_720_00, label: 'UPI' },
      { date: '2026-07-01', kind: 'due', owedPaise: 122_720_00, paidPaise: 0, label: 'Booking' },
      { date: '2026-08-05', kind: 'due', owedPaise: 490_880_00, paidPaise: 0, label: 'Design' },
      { date: '2026-08-05', kind: 'payment', owedPaise: 0, paidPaise: 100_000_00, label: 'Cash' },
      { date: '2026-08-06', kind: 'discount', owedPaise: 0, paidPaise: 10_000_00, label: 'Goodwill' },
    ]);
    expect(rows.map(r => r.label)).toEqual(['Booking', 'UPI', 'Design', 'Cash', 'Goodwill']);
    expect(rows.map(r => r.balancePaise)).toEqual([122_720_00, 0, 490_880_00, 390_880_00, 380_880_00]);
  });
});
