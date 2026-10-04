import { describe, it, expect } from 'vitest';
import { combineSpend, filterSpend, spendTotals } from '../spend';
import type { SpendExpenseInput, SpendPoInput } from '../spend';
import { costBreakdown } from '@/lib/project-money/calc';

const P1 = 'proj-1';
const P2 = 'proj-2';

function exp(over: Partial<SpendExpenseInput> & { id: string }): SpendExpenseInput {
  return {
    expenseNumber: null, projectId: P1, poId: null, vendorId: null, vendorName: null, category: 'other',
    description: null, amountPaise: 0, gstPct: 0, gstAmountPaise: 0, paidAt: null, voidedAt: null,
    createdAt: '2026-10-02T06:00:00Z', ...over,
  };
}

const PO: SpendPoInput = {
  id: 'po-1', poNumber: 'PO-0001', projectId: P1, vendorId: 'v-1', vendorName: 'Raj Plywood',
  // ₹1,00,000 ordered
  linesJson: [{ qty: 10, unitRatePaise: 500_000 }, { totalPaise: 5_000_000 }],
  status: 'sent', createdAt: '2026-09-20T06:00:00Z',
};

const EXPENSES: SpendExpenseInput[] = [
  // Site expense, gross ₹1,180 incl. ₹180 GST, paid.
  exp({ id: 'e-1', category: 'transport', amountPaise: 118_000, gstPct: 18, gstAmountPaise: 18_000, paidAt: '2026-10-02T07:00:00Z' }),
  // Vendor bill against PO-0001: ₹60,000 net + ₹10,800 GST, part paid.
  exp({ id: 'b-1', poId: 'po-1', vendorId: 'v-1', vendorName: 'Raj Plywood', category: 'material',
    amountPaise: 6_000_000, gstPct: 18, gstAmountPaise: 1_080_000, createdAt: '2026-09-25T06:00:00Z' }),
  // Voided expense — never counted.
  exp({ id: 'e-void', amountPaise: 999_999, voidedAt: '2026-10-01T00:00:00Z' }),
  // Labour on another project, unpaid; created 23:30 IST on 30 Sep (18:00 UTC).
  exp({ id: 'e-2', projectId: P2, category: 'labour', vendorName: 'Mani', amountPaise: 2_000_000, createdAt: '2026-09-30T18:00:00Z' }),
];

const PAYMENTS = [
  { purchaseOrderId: 'po-1', expenseId: 'b-1', amountPaise: 3_000_000 },
  { purchaseOrderId: 'po-1', expenseId: null, amountPaise: 500_000 }, // advance on the PO
];

const rows = combineSpend({
  expenses: EXPENSES, purchaseOrders: [PO], vendorPayments: PAYMENTS,
  projectNames: new Map([[P1, 'Villa'], [P2, 'Flat']]),
});

describe('combineSpend', () => {
  it('lists expenses, vendor bills and the unbilled PO balance once each, skipping voided rows', () => {
    expect(rows.map(r => r.key).sort()).toEqual(['expense:e-1', 'expense:e-2', 'po:po-1', 'vendor_bill:b-1']);
  });

  it('shows amounts incl. GST, keeping net on the project-cost basis', () => {
    const site = rows.find(r => r.id === 'e-1')!;
    expect(site).toMatchObject({ amountPaise: 118_000, netPaise: 100_000, gstPaise: 18_000, payStatus: 'paid', projectName: 'Villa' });
    const bill = rows.find(r => r.id === 'b-1')!;
    expect(bill).toMatchObject({ source: 'vendor_bill', amountPaise: 7_080_000, netPaise: 6_000_000, paidPaise: 3_000_000, payStatus: 'partial' });
    expect(bill.description).toBe('Vendor bill for PO-0001');
  });

  it('keeps only the unbilled part of a PO, as committed (not booked)', () => {
    const po = rows.find(r => r.source === 'po')!;
    expect(po).toMatchObject({ amountPaise: 4_000_000, booked: false, paidPaise: 500_000, payStatus: 'partial' });
  });

  it('drops a PO once it is fully billed, and ignores cancelled POs', () => {
    const fully = combineSpend({
      expenses: [exp({ id: 'b-2', poId: 'po-1', amountPaise: 10_000_000 })], purchaseOrders: [PO], vendorPayments: [],
    });
    expect(fully.some(r => r.source === 'po')).toBe(false);
    const cancelled = combineSpend({ expenses: [], purchaseOrders: [{ ...PO, status: 'cancelled' }], vendorPayments: [] });
    expect(cancelled).toHaveLength(0);
  });

  it('dates rows in IST', () => {
    expect(rows.find(r => r.id === 'e-2')!.date).toBe('2026-09-30');
    const late = combineSpend({ expenses: [exp({ id: 'x', createdAt: '2026-09-30T19:00:00Z' })], purchaseOrders: [], vendorPayments: [] });
    expect(late[0].date).toBe('2026-10-01');
  });
});

describe('spendTotals', () => {
  const t = spendTotals(rows, '2026-10-05');

  it('totals booked spend only — a bill and its payment count once, POs stay committed', () => {
    expect(t.totalPaise).toBe(118_000 + 7_080_000 + 2_000_000);
    expect(t.committedPaise).toBe(4_000_000);
    expect(t.bookedCount).toBe(3);
    expect(t.unpaidPaise).toBe(0 + 4_080_000 + 2_000_000);
  });

  it('net total reconciles with the project money cost engine', () => {
    const engineTotal = [P1, P2].reduce((s, pid) => s + costBreakdown(
      EXPENSES.filter(e => e.projectId === pid), 0, 0,
    ).totalPaise, 0);
    expect(t.totalNetPaise).toBe(engineTotal);
  });

  it('this month uses the IST month, top category and vendors from the same rows', () => {
    expect(t.thisMonthPaise).toBe(118_000);
    expect(t.topCategory).toEqual({ category: 'material', amountPaise: 7_080_000 });
    expect(t.vendorCount).toBe(2); // Raj Plywood (id) + Mani (typed name)
  });
});

describe('filterSpend', () => {
  it('filters by project, vendor, category, source, date range and search', () => {
    expect(filterSpend(rows, { projectId: P2 }).map(r => r.id)).toEqual(['e-2']);
    expect(filterSpend(rows, { vendor: 'v-1' }).map(r => r.source).sort()).toEqual(['po', 'vendor_bill']);
    expect(filterSpend(rows, { vendor: 'name:mani' }).map(r => r.id)).toEqual(['e-2']);
    expect(filterSpend(rows, { category: 'transport' }).map(r => r.id)).toEqual(['e-1']);
    expect(filterSpend(rows, { source: 'po' }).map(r => r.id)).toEqual(['po-1']);
    expect(filterSpend(rows, { from: '2026-09-26', to: '2026-09-30' }).map(r => r.id)).toEqual(['e-2']);
    expect(filterSpend(rows, { search: 'villa' })).toHaveLength(3);
    expect(filterSpend(rows, { search: 'po-0001' }).map(r => r.id).sort()).toEqual(['b-1', 'po-1']);
  });
});
