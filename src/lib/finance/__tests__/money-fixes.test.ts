import { describe, expect, it } from 'vitest';
import { nextInSequence, receiptPrefix } from '../receipt-number';
import { invoiceStatusFor, milestoneLinkAmounts, splitGst } from '../gst';
import { shouldMarkOverdue } from '../overdue';
import { milestoneState } from '@/lib/project-money/calc';

describe('receipt numbering', () => {
  it('continues from the highest number, not the row count', () => {
    // Gaps (a pending Razorpay row numbered later, a deleted row) must not cause reuse.
    expect(nextInSequence('RCT-2610-', ['RCT-2610-0001', 'RCT-2610-0007', 'RCT-2610-0003'])).toBe('RCT-2610-0008');
  });

  it('starts at 0001 and ignores other months, nulls and hand-typed numbers', () => {
    expect(nextInSequence('RCT-2610-', [])).toBe('RCT-2610-0001');
    expect(nextInSequence('RCT-2610-', ['RCT-2609-0042', null, 'RCT-2610-ABC', 'misc'])).toBe('RCT-2610-0001');
  });

  it('grows past four digits', () => {
    expect(nextInSequence('RCT-2610-', ['RCT-2610-9999'])).toBe('RCT-2610-10000');
  });

  it('uses the IST month', () => {
    // 2026-09-30 20:00 UTC is already 1 Oct in India.
    expect(receiptPrefix(new Date('2026-09-30T20:00:00Z'))).toBe('RCT-2610-');
  });
});

describe('GST split', () => {
  it('CGST + SGST always add up to the rounded GST', () => {
    for (const sub of [1, 3, 99, 101, 12_345, 1_000_001, 7_77_777]) {
      for (const pct of [5, 12, 18, 28]) {
        const s = splitGst(sub, pct, { isInterstate: false });
        expect(s.cgstPaise + s.sgstPaise).toBe(Math.round((sub * pct) / 100));
        expect(Math.abs(s.cgstPaise - s.sgstPaise)).toBeLessThanOrEqual(1);
        expect(s.igstPaise).toBe(0);
      }
    }
  });

  it('inter-state is all IGST; no GST is zero', () => {
    expect(splitGst(10_000, 18, { isInterstate: true })).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800 });
    expect(splitGst(10_000, 18, { isInterstate: false, noGst: true })).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 0 });
    expect(splitGst(10_000, 0, { isInterstate: false })).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 0 });
  });

  it('uses the project rate, not a fixed 18%', () => {
    expect(splitGst(10_000, 12, { isInterstate: true }).igstPaise).toBe(1_200);
  });
});

describe('payment link amount', () => {
  it('charges the invoice total incl. GST', () => {
    const a = milestoneLinkAmounts(1_00_000_00, 18, false, 1_18_000_00);
    expect(a.invoiceTotalPaise).toBe(1_18_000_00);
    expect(a.linkAmountPaise).toBe(1_18_000_00);
  });

  it('only collects what is still owed on a part-paid milestone', () => {
    const a = milestoneLinkAmounts(1_00_000_00, 18, true, 18_000_00);
    expect(a.invoiceTotalPaise).toBe(1_18_000_00);
    expect(a.linkAmountPaise).toBe(18_000_00);
  });
});

describe('invoice status from receipts', () => {
  it('paid / part-paid / issued', () => {
    expect(invoiceStatusFor(1_000, 1_000)).toBe('paid');
    expect(invoiceStatusFor(1_000, 400)).toBe('part_paid');
    expect(invoiceStatusFor(1_000, 0)).toBe('issued');
  });
});

describe('overdue escalation decision', () => {
  const project = { stage: 'design_pending' as const, gstPct: 18 };
  const base = { pctOfTotal: 10, amountPaise: 0, triggerStage: null, dueSince: null, receivedPaise: 0 };

  it('does not flag a milestone just because it is a few days old', () => {
    // Waits on a stage the project has not reached → upcoming, never overdue.
    const v = milestoneState({ ...base, triggerStage: 'execution', dueOn: null, paymentStatus: 'link_sent' }, project, 10_00_000_00, '2026-10-05');
    expect(shouldMarkOverdue(v, 'link_sent')).toBe(false);
  });

  it('does not flag inside the grace period', () => {
    const v = milestoneState({ ...base, dueOn: '2026-10-01', paymentStatus: 'pending' }, project, 10_00_000_00, '2026-10-05');
    expect(shouldMarkOverdue(v, 'pending')).toBe(false);
  });

  it('flags a milestone past due + grace with a balance', () => {
    const v = milestoneState({ ...base, dueOn: '2026-09-01', paymentStatus: 'pending' }, project, 10_00_000_00, '2026-10-05');
    expect(shouldMarkOverdue(v, 'pending')).toBe(true);
  });

  it('never flags a fully paid milestone', () => {
    const total = Math.round(10_00_000_00 * 0.1 * 1.18);
    const v = milestoneState({ ...base, dueOn: '2026-09-01', paymentStatus: 'pending', receivedPaise: total }, project, 10_00_000_00, '2026-10-05');
    expect(shouldMarkOverdue(v, 'pending')).toBe(false);
    expect(shouldMarkOverdue(v, 'paid')).toBe(false);
  });
});
