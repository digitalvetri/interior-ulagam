// Studio spend — one list of every rupee going out, on the same basis as the
// project money engine (src/lib/project-money), so Accounts and project costs
// reconcile:
//   • every non-voided `expenses` row is booked spend — manual/site expenses
//     store the gross (GST inside), vendor bills (po_id set) store the net with
//     GST alongside;
//   • the part of a purchase order not billed yet is "committed" — shown as a
//     PO row but never added to booked spend (the engine keeps it out of cost too);
//   • vendor payments only settle bills/POs (paid / unpaid) — they are never spend
//     on their own, so a bill and its payment are counted once.
// Pure: no database, no clock. All amounts are integer paise.

import { expenseNetPaise, poCommittedPaise } from '@/lib/project-money/calc';
import { istDateOf } from '@/lib/dates/ist';

export type SpendSource = 'expense' | 'vendor_bill' | 'po';
export type SpendPayStatus = 'paid' | 'partial' | 'unpaid';

export interface SpendExpenseInput {
  id: string;
  expenseNumber: string | null;
  projectId: string;
  poId: string | null;
  vendorId: string | null;
  vendorName: string | null;
  category: string;
  description: string | null;
  amountPaise: number;
  gstPct: number;
  gstAmountPaise: number;
  paidAt: Date | string | null;
  voidedAt: Date | string | null;
  createdAt: Date | string;
}

export interface SpendPoInput {
  id: string;
  poNumber: string;
  projectId: string;
  vendorId: string | null;
  vendorName: string | null;
  linesJson: unknown;
  status: string;
  createdAt: Date | string;
}

export interface SpendVendorPaymentInput {
  purchaseOrderId: string | null;
  expenseId: string | null;
  amountPaise: number;
}

export interface SpendRow {
  /** Unique across sources: `${source}:${id}`. */
  key: string;
  id: string;
  source: SpendSource;
  /** IST calendar date, yyyy-mm-dd. */
  date: string;
  ref: string | null;
  description: string;
  projectId: string;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  category: string;
  /** What leaves the bank, GST included (PO rows: order value still to bill, GST not known yet). */
  amountPaise: number;
  /** Excluding GST — the basis project costs use. */
  netPaise: number;
  gstPct: number;
  gstPaise: number;
  /** Booked spend. False for PO rows — those are committed only. */
  booked: boolean;
  paidPaise: number;
  payStatus: SpendPayStatus;
  poId: string | null;
}

function toIstDate(d: Date | string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return istDateOf(typeof d === 'string' ? new Date(d) : d);
}

function payStatusOf(totalPaise: number, paidPaise: number): SpendPayStatus {
  if (paidPaise >= totalPaise && totalPaise > 0) return 'paid';
  return paidPaise > 0 ? 'partial' : 'unpaid';
}

/** Merge expenses, vendor bills and unbilled POs into one list, newest first. */
export function combineSpend(input: {
  expenses: readonly SpendExpenseInput[];
  purchaseOrders: readonly SpendPoInput[];
  vendorPayments: readonly SpendVendorPaymentInput[];
  projectNames?: ReadonlyMap<string, string>;
}): SpendRow[] {
  const projectName = (id: string) => input.projectNames?.get(id) ?? null;

  const paidByBill = new Map<string, number>();
  const advanceByPo = new Map<string, number>();
  for (const p of input.vendorPayments) {
    if (p.expenseId) paidByBill.set(p.expenseId, (paidByBill.get(p.expenseId) ?? 0) + p.amountPaise);
    else if (p.purchaseOrderId) advanceByPo.set(p.purchaseOrderId, (advanceByPo.get(p.purchaseOrderId) ?? 0) + p.amountPaise);
  }

  const poById = new Map(input.purchaseOrders.map(po => [po.id, po]));
  const billedByPo = new Map<string, number>();
  const rows: SpendRow[] = [];

  for (const e of input.expenses) {
    if (e.voidedAt) continue;
    const isBill = !!e.poId;
    const netPaise = expenseNetPaise(e);
    const amountPaise = isBill ? e.amountPaise + e.gstAmountPaise : e.amountPaise;
    if (e.poId) billedByPo.set(e.poId, (billedByPo.get(e.poId) ?? 0) + e.amountPaise);

    // A bill is settled by vendor payments; a plain expense by its paid date.
    const paidPaise = isBill
      ? (e.paidAt ? amountPaise : Math.min(amountPaise, paidByBill.get(e.id) ?? 0))
      : (e.paidAt ? amountPaise : 0);
    const po = e.poId ? poById.get(e.poId) : undefined;

    rows.push({
      key: `${isBill ? 'vendor_bill' : 'expense'}:${e.id}`,
      id: e.id,
      source: isBill ? 'vendor_bill' : 'expense',
      date: toIstDate(e.createdAt),
      ref: e.expenseNumber,
      description: e.description?.trim() || (po ? `Vendor bill for ${po.poNumber}` : 'Expense'),
      projectId: e.projectId,
      projectName: projectName(e.projectId),
      vendorId: e.vendorId ?? po?.vendorId ?? null,
      vendorName: e.vendorName ?? po?.vendorName ?? null,
      category: e.category,
      amountPaise,
      netPaise,
      gstPct: e.gstPct,
      gstPaise: amountPaise - netPaise,
      booked: true,
      paidPaise,
      payStatus: payStatusOf(amountPaise, paidPaise),
      poId: e.poId,
    });
  }

  for (const po of input.purchaseOrders) {
    const committed = poCommittedPaise(po, billedByPo.get(po.id) ?? 0);
    if (committed <= 0) continue;
    const advance = Math.min(committed, advanceByPo.get(po.id) ?? 0);
    rows.push({
      key: `po:${po.id}`,
      id: po.id,
      source: 'po',
      date: toIstDate(po.createdAt),
      ref: po.poNumber,
      description: billedByPo.has(po.id) ? `${po.poNumber} — balance not billed yet` : `${po.poNumber} — not billed yet`,
      projectId: po.projectId,
      projectName: projectName(po.projectId),
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      category: 'material',
      amountPaise: committed,
      netPaise: committed,
      gstPct: 0,
      gstPaise: 0,
      booked: false,
      paidPaise: advance,
      payStatus: payStatusOf(committed, advance),
      poId: po.id,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

export interface SpendFilters {
  projectId?: string | null;
  vendor?: string | null;
  category?: string | null;
  source?: SpendSource | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
}

/** Vendor filter key: the vendor id, or the typed name for one-off payees. */
export function spendVendorKey(r: Pick<SpendRow, 'vendorId' | 'vendorName'>): string | null {
  if (r.vendorId) return r.vendorId;
  const name = r.vendorName?.trim().toLowerCase();
  return name ? `name:${name}` : null;
}

export function filterSpend(rows: readonly SpendRow[], f: SpendFilters): SpendRow[] {
  const q = f.search?.trim().toLowerCase() ?? '';
  return rows.filter(r => {
    if (f.projectId && r.projectId !== f.projectId) return false;
    if (f.vendor && spendVendorKey(r) !== f.vendor) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (q) {
      const hay = [r.description, r.vendorName, r.projectName, r.ref].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface SpendTotals {
  /** Booked spend incl. GST. */
  totalPaise: number;
  /** Booked spend excl. GST — equals the sum of project costs (before staff labour). */
  totalNetPaise: number;
  /** Booked spend this IST month, incl. GST. */
  thisMonthPaise: number;
  /** Booked spend not yet paid. */
  unpaidPaise: number;
  /** Purchase orders not billed yet — forecast only. */
  committedPaise: number;
  topCategory: { category: string; amountPaise: number } | null;
  byCategory: { category: string; amountPaise: number }[];
  vendorCount: number;
  bookedCount: number;
}

/** Totals over booked rows; PO rows only feed `committedPaise`. `today` is the IST yyyy-mm-dd. */
export function spendTotals(rows: readonly SpendRow[], today: string): SpendTotals {
  const month = today.slice(0, 7);
  const byCat = new Map<string, number>();
  const vendors = new Set<string>();
  let totalPaise = 0, totalNetPaise = 0, thisMonthPaise = 0, unpaidPaise = 0, committedPaise = 0, bookedCount = 0;

  for (const r of rows) {
    const vk = spendVendorKey(r);
    if (vk) vendors.add(vk);
    if (!r.booked) { committedPaise += r.amountPaise; continue; }
    bookedCount += 1;
    totalPaise += r.amountPaise;
    totalNetPaise += r.netPaise;
    unpaidPaise += Math.max(0, r.amountPaise - r.paidPaise);
    if (r.date.slice(0, 7) === month) thisMonthPaise += r.amountPaise;
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amountPaise);
  }

  const byCategory = [...byCat.entries()]
    .map(([category, amountPaise]) => ({ category, amountPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);

  return {
    totalPaise, totalNetPaise, thisMonthPaise, unpaidPaise, committedPaise,
    topCategory: byCategory[0] ?? null, byCategory, vendorCount: vendors.size, bookedCount,
  };
}
