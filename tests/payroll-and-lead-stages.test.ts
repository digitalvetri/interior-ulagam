import { describe, it, expect } from 'vitest';
import { calcPayslip, monthBounds, isAllowedRunTransition } from '@/lib/payroll/calculate';
import { stageAfterVisitCompleted, EARLY_STAGES } from '@/lib/leads/stage-utils';

describe('calcPayslip — total employer cost', () => {
  it('is gross + employer PF + employer ESI (not net + employer)', () => {
    // ₹20,000 salary, full attendance → ESI applies (gross ≤ ₹21,000)
    const att = Array.from({ length: 26 }, (_, i) => ({
      userId: 'u1', date: `2026-09-${String(i + 1).padStart(2, '0')}`, status: 'present' as const,
    }));
    const p = calcPayslip({ id: 'u1', salaryPaise: 2_000_000 }, 26, att, []);
    expect(p.grossPaise).toBe(2_000_000);
    expect(p.employeePFPaise).toBe(180_000);           // capped
    expect(p.employeeESIPaise).toBe(15_000);           // 0.75%
    expect(p.netPaise).toBe(2_000_000 - 180_000 - 15_000);
    expect(p.employerPFPaise).toBe(180_000);
    expect(p.employerESIPaise).toBe(65_000);           // 3.25%
    expect(p.totalCostPaise).toBe(2_000_000 + 180_000 + 65_000);
    expect(Number.isInteger(p.totalCostPaise)).toBe(true);
  });

  it('is 0 for an employee with no salary', () => {
    const p = calcPayslip({ id: 'u2', salaryPaise: null }, 26, [], []);
    expect(p.grossPaise).toBe(0);
    expect(p.totalCostPaise).toBe(0);
  });

  it('counts approved paid leave days', () => {
    const att = [
      { userId: 'u3', date: '2026-09-01', status: 'present' as const },
      { userId: 'u3', date: '2026-09-02', status: 'leave' as const },
    ];
    const leaves = [{ userId: 'u3', fromDate: '2026-09-02', toDate: '2026-09-02', leaveType: 'casual', status: 'approved' }];
    expect(calcPayslip({ id: 'u3', salaryPaise: 2_600_000 }, 26, att, leaves).daysPresent).toBe(2);
  });
});

describe('monthBounds', () => {
  it('returns calendar bounds independent of server TZ', () => {
    expect(monthBounds('2026-02')).toEqual({ firstDay: '2026-02-01', lastDay: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ firstDay: '2028-02-01', lastDay: '2028-02-29' });
    expect(monthBounds('2026-12')).toEqual({ firstDay: '2026-12-01', lastDay: '2026-12-31' });
    expect(monthBounds('2026-09')).toEqual({ firstDay: '2026-09-01', lastDay: '2026-09-30' });
  });
});

describe('payroll run transitions', () => {
  it('allows only draft→approved→paid, one step at a time', () => {
    expect(isAllowedRunTransition('draft', 'approved')).toBe(true);
    expect(isAllowedRunTransition('approved', 'paid')).toBe(true);
    expect(isAllowedRunTransition('draft', 'paid')).toBe(false);
    expect(isAllowedRunTransition('paid', 'approved')).toBe(false);
    expect(isAllowedRunTransition('approved', 'approved')).toBe(false);
  });
});

describe('stageAfterVisitCompleted', () => {
  it('advances early and site-visit stages to measurement', () => {
    for (const s of [...EARLY_STAGES, 'site_visit', 'site_visit_scheduled']) {
      expect(stageAfterVisitCompleted(s)).toBe('measurement');
    }
  });

  it('never moves later-stage or closed leads backwards', () => {
    for (const s of ['measurement', 'measured', 'quotation', 'negotiation', 'booked', 'won', 'lost', 'proposal_sent']) {
      expect(stageAfterVisitCompleted(s)).toBeNull();
    }
    expect(stageAfterVisitCompleted(null)).toBeNull();
  });
});
