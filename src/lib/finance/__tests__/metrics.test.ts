import { describe, it, expect } from 'vitest';
import {
  calcCollect, calcReceived, calcToPayVendor, calcToPayExpenses,
  calcGstOutput, calcGstInput,
} from '../metrics';
import type { MilestoneRow, PaymentRow, ExpenseRow, PoRow, InvoiceGstRow } from '../metrics';

const TODAY = '2026-09-18';

// ─── calcCollect ─────────────────────────────────────────────────────────────

describe('calcCollect', () => {
  it('counts only issued/part_paid milestones', () => {
    const rows: MilestoneRow[] = [
      { id: '1', amountPaise: 50000, paymentStatus: 'pending', invoiceId: 'inv1', invoiceStatus: 'issued',    invoiceDueDate: '2026-09-30', settledPaise: 0 },
      { id: '2', amountPaise: 25000, paymentStatus: 'pending', invoiceId: 'inv2', invoiceStatus: 'draft',     invoiceDueDate: null,         settledPaise: 0 },
      { id: '3', amountPaise: 10000, paymentStatus: 'paid',    invoiceId: 'inv3', invoiceStatus: 'paid',      invoiceDueDate: null,         settledPaise: 10000 },
      { id: '4', amountPaise: 30000, paymentStatus: 'pending', invoiceId: null,   invoiceStatus: null,        invoiceDueDate: null,         settledPaise: 0 },
    ];
    const r = calcCollect(rows, TODAY);
    expect(r.toCollectPaise).toBe(50000);
    expect(r.notYetInvoicedPaise).toBe(25000 + 30000); // draft + no invoice
    expect(r.overduePaise).toBe(0); // due date is future
  });

  it('marks overdue when dueDate is in the past', () => {
    const rows: MilestoneRow[] = [
      { id: '1', amountPaise: 40000, paymentStatus: 'pending', invoiceId: 'inv1', invoiceStatus: 'issued', invoiceDueDate: '2026-09-01', settledPaise: 0 },
    ];
    const r = calcCollect(rows, TODAY);
    expect(r.toCollectPaise).toBe(40000);
    expect(r.overduePaise).toBe(40000);
  });

  it('deducts settled paise from balance', () => {
    const rows: MilestoneRow[] = [
      { id: '1', amountPaise: 50000, paymentStatus: 'pending', invoiceId: 'inv1', invoiceStatus: 'part_paid', invoiceDueDate: '2026-09-30', settledPaise: 20000 },
    ];
    const r = calcCollect(rows, TODAY);
    expect(r.toCollectPaise).toBe(30000);
  });

  it('excludes void invoices from to-collect', () => {
    const rows: MilestoneRow[] = [
      { id: '1', amountPaise: 15000, paymentStatus: 'pending', invoiceId: 'inv1', invoiceStatus: 'void', invoiceDueDate: null, settledPaise: 0 },
    ];
    const r = calcCollect(rows, TODAY);
    expect(r.toCollectPaise).toBe(0);
    expect(r.notYetInvoicedPaise).toBe(15000);
  });
});

// ─── calcReceived ─────────────────────────────────────────────────────────────

describe('calcReceived', () => {
  const payments: PaymentRow[] = [
    { amountPaise: 50000, status: 'captured', receivedAt: '2026-09-15T10:00:00Z', reconciledAt: null, createdAt: '2026-09-15T10:00:00Z' },
    { amountPaise: 25000, status: 'captured', receivedAt: '2026-08-20T10:00:00Z', reconciledAt: null, createdAt: '2026-08-20T10:00:00Z' },
    { amountPaise: 10000, status: 'pending',  receivedAt: null, reconciledAt: null, createdAt: '2026-09-10T10:00:00Z' },
  ];

  it('sums captured payments within period', () => {
    const result = calcReceived(payments, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
    expect(result).toBe(50000);
  });

  it('excludes pending status', () => {
    const result = calcReceived(payments, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
    expect(result).not.toContain(10000);
  });

  it('falls back to createdAt when receivedAt is null', () => {
    const p: PaymentRow[] = [
      { amountPaise: 7000, status: 'captured', receivedAt: null, reconciledAt: null, createdAt: '2026-09-05T10:00:00Z' },
    ];
    expect(calcReceived(p, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z')).toBe(7000);
  });
});

// ─── calcToPayVendor ─────────────────────────────────────────────────────────

describe('calcToPayVendor', () => {
  const pos: PoRow[] = [
    { totalPaise: 50000, paidPaise: 20000, status: 'partial'   },
    { totalPaise: 30000, paidPaise: 30000, status: 'complete'  },
    { totalPaise: 15000, paidPaise: 0,     status: 'cancelled' },
  ];

  it('sums outstanding balances, excludes cancelled', () => {
    expect(calcToPayVendor(pos)).toBe(30000); // only first PO has balance
  });
});

// ─── calcToPayExpenses ────────────────────────────────────────────────────────

describe('calcToPayExpenses', () => {
  const expenses: ExpenseRow[] = [
    { amountPaise: 8000, gstPct: 0, gstAmountPaise: 0, paidAt: null, createdAt: '2026-09-01' },
    { amountPaise: 5000, gstPct: 0, gstAmountPaise: 0, paidAt: '2026-09-10', createdAt: '2026-09-01' },
  ];

  it('sums only unpaid expenses', () => {
    expect(calcToPayExpenses(expenses)).toBe(8000);
  });
});

// ─── GST ──────────────────────────────────────────────────────────────────────

describe('calcGstOutput', () => {
  const invoices: InvoiceGstRow[] = [
    { cgstPaise: 4500, sgstPaise: 4500, igstPaise: 0,    issuedAt: '2026-09-05T10:00:00Z', status: 'issued' },
    { cgstPaise: 2000, sgstPaise: 2000, igstPaise: 0,    issuedAt: '2026-08-15T10:00:00Z', status: 'issued' }, // out of month
    { cgstPaise: 1000, sgstPaise: 1000, igstPaise: 0,    issuedAt: '2026-09-10T10:00:00Z', status: 'void'   }, // excluded
    { cgstPaise: 3600, sgstPaise: 3600, igstPaise: 7200, issuedAt: '2026-09-18T10:00:00Z', status: 'paid'   },
  ];

  it('sums non-void/draft invoices within month', () => {
    const r = calcGstOutput(invoices, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
    expect(r.cgst).toBe(4500 + 3600);
    expect(r.sgst).toBe(4500 + 3600);
    expect(r.igst).toBe(7200);
    expect(r.total).toBe(8100 + 8100 + 7200);
  });
});

describe('calcGstInput', () => {
  const expenses: ExpenseRow[] = [
    { amountPaise: 10000, gstPct: 18, gstAmountPaise: 1800, paidAt: '2026-09-10T10:00:00Z', createdAt: '2026-09-01' },
    { amountPaise: 5000,  gstPct: 0,  gstAmountPaise: 0,    paidAt: null,                    createdAt: '2026-09-05' },
    { amountPaise: 8000,  gstPct: 18, gstAmountPaise: 1440, paidAt: null,                    createdAt: '2026-08-20' }, // out of month
  ];

  it('sums GST from expenses with gstPct > 0, using paidAt or createdAt', () => {
    const result = calcGstInput(expenses, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
    expect(result).toBe(1800); // only first expense qualifies
  });
});
