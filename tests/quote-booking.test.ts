import { describe, it, expect } from 'vitest';
import { contractFromQuote, splitMilestones, DEFAULT_MILESTONE_PLAN } from '@/lib/projects/booking';
import { completionOutstanding, designApproved, secondMilestonePaid } from '@/lib/projects/gate-rules';
import { gstOf } from '@/lib/project-money/calc';
import { quoteNumberOf } from '@/lib/quotes/number';
import { isAcceptedQuoteStatus } from '@/lib/quotes/status';

describe('contractFromQuote (C3: contract is ex-GST)', () => {
  it('uses subtotal − discount, never the GST-inclusive total', () => {
    // subtotal 10,00,000, discount 50,000 → total incl 18% GST would be 11,21,000
    expect(contractFromQuote({ subtotalPaise: 100_000_000, discountPaise: 5_000_000 })).toBe(95_000_000);
  });

  it('adding GST on the contract reproduces the quote total exactly once', () => {
    const subtotalPaise = 100_000_000;
    const discountPaise = 5_000_000;
    const quoteGst = Math.round(((subtotalPaise - discountPaise) * 18) / 100);
    const quoteTotal = subtotalPaise - discountPaise + quoteGst;
    const contract = contractFromQuote({ subtotalPaise, discountPaise });
    expect(contract + gstOf(contract, 18)).toBe(quoteTotal);
  });

  it('never goes negative', () => {
    expect(contractFromQuote({ subtotalPaise: 100, discountPaise: 500 })).toBe(0);
  });
});

describe('splitMilestones', () => {
  it('defaults to 10/40/40/10', () => {
    expect(splitMilestones(100_000).map(m => m.pctOfTotal)).toEqual([10, 40, 40, 10]);
    expect(DEFAULT_MILESTONE_PLAN).toHaveLength(4);
  });

  it.each([1, 3, 7, 99_999, 123_456_789, 95_000_000])('sums exactly to the contract (%i paise)', (contract) => {
    const ms = splitMilestones(contract);
    expect(ms.reduce((s, m) => s + m.amountPaise, 0)).toBe(contract);
    for (const m of ms) expect(Number.isInteger(m.amountPaise)).toBe(true);
  });

  it('assigns sequential sort orders', () => {
    expect(splitMilestones(1000).map(m => m.sortOrder)).toEqual([0, 1, 2, 3]);
  });
});

describe('secondMilestonePaid (procurement gate)', () => {
  const ms = (statuses: string[]) => statuses.map((paymentStatus, i) => ({
    sortOrder: i, createdAt: new Date(2026, 0, 1 + i), paymentStatus,
  }));

  it('blocks when only the advance is paid', () => {
    expect(secondMilestonePaid(ms(['paid', 'pending', 'pending', 'pending']))).toBe(false);
  });

  it('passes when milestone 2 is paid', () => {
    expect(secondMilestonePaid(ms(['paid', 'paid', 'pending', 'pending']))).toBe(true);
  });

  it('orders by sortOrder, then creation date', () => {
    const rows = [
      { sortOrder: 0, createdAt: new Date(2026, 0, 5), paymentStatus: 'pending' },
      { sortOrder: 0, createdAt: new Date(2026, 0, 1), paymentStatus: 'paid' },
      { sortOrder: 1, createdAt: new Date(2026, 0, 2), paymentStatus: 'paid' },
    ];
    // 2nd in order is the sortOrder-0 row created on the 5th, which is unpaid.
    expect(secondMilestonePaid(rows)).toBe(false);
  });

  it('blocks with no milestones', () => {
    expect(secondMilestonePaid([])).toBe(false);
  });
});

describe('designApproved', () => {
  it('blocks while any deliverable is unapproved', () => {
    expect(designApproved(['approved', 'shared'])).toEqual({ ok: false, pending: 1, total: 2 });
  });
  it('passes when all are approved', () => {
    expect(designApproved(['approved', 'approved']).ok).toBe(true);
  });
  it('does not block a project with no deliverables', () => {
    expect(designApproved([]).ok).toBe(true);
  });
});

describe('completionOutstanding (complete gate)', () => {
  it('counts GST and additions via the engine total', () => {
    expect(completionOutstanding({ totalWithGstPaise: 118_000, receivedPaise: 100_000, adjustments: [] })).toBe(18_000);
  });
  it('discounts and write-offs reduce what is owed; refunds add back', () => {
    expect(completionOutstanding({
      totalWithGstPaise: 118_000, receivedPaise: 100_000,
      adjustments: [{ kind: 'discount', amountPaise: 10_000 }, { kind: 'write_off', amountPaise: 8_000 }],
    })).toBe(0);
    expect(completionOutstanding({
      totalWithGstPaise: 118_000, receivedPaise: 118_000,
      adjustments: [{ kind: 'refund', amountPaise: 5_000 }],
    })).toBe(5_000);
  });
  it('never negative on overpayment', () => {
    expect(completionOutstanding({ totalWithGstPaise: 100, receivedPaise: 500, adjustments: [] })).toBe(0);
  });
});

describe('quote helpers', () => {
  it('quoteNumberOf prefers the stored number', () => {
    expect(quoteNumberOf({ id: '11111111-2222-4333-8444-555555abcdef', quoteNumber: 'KD-Q-0042' })).toBe('KD-Q-0042');
  });
  it('quoteNumberOf derives a stable label from the id', () => {
    expect(quoteNumberOf({ id: '11111111-2222-4333-8444-555555abcdef', quoteNumber: null })).toBe('QUO-ABCDEF');
    expect(quoteNumberOf({ id: '11111111-2222-4333-8444-555555abcdef', quoteNumber: '  ' })).toBe('QUO-ABCDEF');
  });
  it('treats accepted and legacy approved as accepted', () => {
    expect(isAcceptedQuoteStatus('accepted')).toBe(true);
    expect(isAcceptedQuoteStatus('approved')).toBe(true);
    expect(isAcceptedQuoteStatus('sent')).toBe(false);
    expect(isAcceptedQuoteStatus('revised')).toBe(false);
  });
});
