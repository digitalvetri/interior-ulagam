import { describe, it, expect } from 'vitest';
import { planStatusChange, canEditLines } from '@/lib/civil/status';

const done = { status: 'done' as const, billNo: null, billDate: null, paidDate: null };
const billed  = { status: 'billed'  as const, billNo: 'B-118', billDate: '2026-09-30', paidDate: null };
const paid    = { status: 'paid'    as const, billNo: 'B-118', billDate: '2026-09-30', paidDate: '2026-10-10' };

describe('planStatusChange', () => {
  it('refuses billed without a bill number and date', () => {
    const r = planStatusChange(done, 'billed', { billNo: 'B-1' });
    expect(r.ok).toBe(false);
  });

  it('records bill number and date when billing', () => {
    const r = planStatusChange(done, 'billed', { billNo: ' B-119 ', billDate: '2026-10-01' });
    expect(r).toEqual({ ok: true, patch: { status: 'billed', billNo: 'B-119', billDate: '2026-10-01', paidDate: null } });
  });

  it('refuses paid without a paid date', () => {
    expect(planStatusChange(billed, 'paid', {}).ok).toBe(false);
  });

  it('refuses paid when the job was never billed and no bill info is given', () => {
    expect(planStatusChange(done, 'paid', { paidDate: '2026-10-10' }).ok).toBe(false);
  });

  it('keeps existing bill info when marking paid', () => {
    expect(planStatusChange(billed, 'paid', { paidDate: '2026-10-10' })).toEqual({
      ok: true, patch: { status: 'paid', billNo: 'B-118', billDate: '2026-09-30', paidDate: '2026-10-10' },
    });
  });

  it('never overwrites an existing bill when marking paid (bulk dialog sends one bill no. for many jobs)', () => {
    expect(planStatusChange(billed, 'paid', { billNo: 'B-999', billDate: '2026-10-05', paidDate: '2026-10-10' })).toEqual({
      ok: true, patch: { status: 'paid', billNo: 'B-118', billDate: '2026-09-30', paidDate: '2026-10-10' },
    });
  });

  it('uses the given bill info when a done job is marked paid directly', () => {
    expect(planStatusChange(done, 'paid', { billNo: 'B-5', billDate: '2026-10-01', paidDate: '2026-10-10' })).toEqual({
      ok: true, patch: { status: 'paid', billNo: 'B-5', billDate: '2026-10-01', paidDate: '2026-10-10' },
    });
  });

  it('clears the fields of stages it leaves when moving back', () => {
    expect(planStatusChange(paid, 'billed', {})).toEqual({
      ok: true, patch: { status: 'billed', billNo: 'B-118', billDate: '2026-09-30', paidDate: null },
    });
    expect(planStatusChange(paid, 'done', {})).toEqual({
      ok: true, patch: { status: 'done', billNo: null, billDate: null, paidDate: null },
    });
  });

  it('refuses a no-op change', () => {
    expect(planStatusChange(billed, 'billed', { billNo: 'X', billDate: '2026-10-01' }).ok).toBe(false);
  });
});

describe('canEditLines', () => {
  it('allows only done', () => {
    expect(canEditLines('done')).toBe(true);
    expect(canEditLines('billed')).toBe(false);
    expect(canEditLines('paid')).toBe(false);
  });
});
