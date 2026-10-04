import { describe, it, expect } from 'vitest';
import { jobCost, profitOf, COUNTED_STATUSES } from '@/lib/civil/profit';

describe('jobCost', () => {
  it('adds entered line costs and unbilled costs, and counts lines with no cost yet', () => {
    expect(jobCost(
      [{ costPaise: 80_000 }, { costPaise: null }, { costPaise: 0 }],
      [{ amountPaise: 30_000 }],
    )).toEqual({ costPaise: 110_000, linesWithoutCost: 1 });
  });

  it('is zero with nothing entered', () => {
    expect(jobCost([], [])).toEqual({ costPaise: 0, linesWithoutCost: 0 });
  });
});

describe('profitOf', () => {
  it('gives profit and margin on the billed value', () => {
    // Labour billed 1000, really cost 800.
    expect(profitOf(100_000, 80_000)).toEqual({ profitPaise: 20_000, marginPct: 20 });
  });

  it('shows a loss as a negative profit', () => {
    expect(profitOf(100_000, 125_000)).toEqual({ profitPaise: -25_000, marginPct: -25 });
  });

  it('has no margin when nothing was billed', () => {
    expect(profitOf(0, 5_000)).toEqual({ profitPaise: -5_000, marginPct: null });
  });

  it('rounds margin to one decimal', () => {
    expect(profitOf(300_000, 200_000).marginPct).toBe(33.3);
  });
});

describe('COUNTED_STATUSES', () => {
  it('counts every job (all are finished work)', () => {
    expect(COUNTED_STATUSES).toEqual(['done', 'billed', 'paid']);
  });
});
