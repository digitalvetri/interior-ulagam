import { PAYMENT_SETTLED } from './constants';

// ─── Input types (raw DB row shapes passed in from the API) ───────────────────

export interface MilestoneRow {
  id: string;
  amountPaise: number;
  paymentStatus: string;
  invoiceId: string | null;
  invoiceStatus: string | null;   // invoice.status after migration
  invoiceDueDate: string | null;  // ISO date string
  settledPaise: number;           // sum of captured payments linked to this milestone's invoice
}

export interface PaymentRow {
  amountPaise: number;
  status: string;
  receivedAt: string | null;      // ISO timestamp
  reconciledAt: string | null;
  createdAt: string;
}

export interface ExpenseRow {
  amountPaise: number;
  gstPct: number;
  gstAmountPaise: number;
  paidAt: string | null;
  createdAt: string;
}

export interface PoRow {
  totalPaise: number;
  paidPaise: number;
  status: string;
}

export interface InvoiceGstRow {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  issuedAt: string | null;
  status: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface FinanceKPIs {
  toCollectPaise: number;
  overduePaise: number;
  notYetInvoicedPaise: number;
  receivedPaise: number;
  toPayVendorPaise: number;
  toPayExpensePaise: number;
  toPayTotalPaise: number;
  gstOutput: number;
  gstInput: number;
  gstNet: number;
  gstCgst: number;
  gstSgst: number;
  gstIgst: number;
}

// ─── To collect ───────────────────────────────────────────────────────────────

/**
 * A milestone is collectible only when its invoice.status ∈ {issued, part_paid}.
 * Returns { toCollectPaise, overduePaise, notYetInvoicedPaise }.
 */
export function calcCollect(
  milestones: MilestoneRow[],
  today = new Date().toISOString().split('T')[0],
): { toCollectPaise: number; overduePaise: number; notYetInvoicedPaise: number } {
  let toCollectPaise = 0;
  let overduePaise = 0;
  let notYetInvoicedPaise = 0;

  for (const m of milestones) {
    if (m.paymentStatus === 'paid') continue;

    const invStatus = m.invoiceStatus ?? null;
    const isCollectible = invStatus === 'issued' || invStatus === 'part_paid';
    const balance = Math.max(0, m.amountPaise - m.settledPaise);

    if (isCollectible) {
      toCollectPaise += balance;
      if (m.invoiceDueDate && m.invoiceDueDate < today) {
        overduePaise += balance;
      }
    } else {
      // No invoice, draft, or void — show in "Not yet invoiced" section
      notYetInvoicedPaise += m.amountPaise;
    }
  }

  return { toCollectPaise, overduePaise, notYetInvoicedPaise };
}

// ─── Received ─────────────────────────────────────────────────────────────────

export function calcReceived(
  payments: PaymentRow[],
  periodStart: string,
  periodEnd: string,
): number {
  return payments
    .filter((p) => {
      if (p.status !== PAYMENT_SETTLED) return false;
      const ts = p.receivedAt ?? p.reconciledAt ?? p.createdAt;
      return ts >= periodStart && ts <= periodEnd;
    })
    .reduce((s, p) => s + p.amountPaise, 0);
}

// ─── To pay ───────────────────────────────────────────────────────────────────

export function calcToPayVendor(pos: PoRow[]): number {
  return pos
    .filter((po) => po.status !== 'cancelled')
    .reduce((s, po) => s + Math.max(0, po.totalPaise - po.paidPaise), 0);
}

export function calcToPayExpenses(expenses: ExpenseRow[]): number {
  return expenses
    .filter((e) => e.paidAt === null)
    .reduce((s, e) => s + e.amountPaise, 0);
}

// ─── GST ──────────────────────────────────────────────────────────────────────

export function calcGstOutput(
  invoices: InvoiceGstRow[],
  monthStart: string,
  monthEnd: string,
): { total: number; cgst: number; sgst: number; igst: number } {
  let cgst = 0, sgst = 0, igst = 0;
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'void') continue;
    const ts = inv.issuedAt ?? '';
    if (!ts || ts < monthStart || ts > monthEnd) continue;
    cgst += inv.cgstPaise;
    sgst += inv.sgstPaise;
    igst += inv.igstPaise;
  }
  return { total: cgst + sgst + igst, cgst, sgst, igst };
}

export function calcGstInput(
  expenses: ExpenseRow[],
  monthStart: string,
  monthEnd: string,
): number {
  return expenses
    .filter((e) => {
      if (e.gstPct <= 0) return false;
      // Use paidAt if set, else createdAt
      const ts = e.paidAt ?? e.createdAt;
      return ts >= monthStart && ts <= monthEnd;
    })
    .reduce((s, e) => s + e.gstAmountPaise, 0);
}

// ─── Combined ─────────────────────────────────────────────────────────────────

export function calcFinanceKPIs(params: {
  milestones: MilestoneRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  pos: PoRow[];
  invoices: InvoiceGstRow[];
  periodStart: string;
  periodEnd: string;
  monthStart: string;
  monthEnd: string;
  today?: string;
}): FinanceKPIs {
  const { toCollectPaise, overduePaise, notYetInvoicedPaise } = calcCollect(
    params.milestones,
    params.today,
  );
  const receivedPaise = calcReceived(params.payments, params.periodStart, params.periodEnd);
  const toPayVendorPaise  = calcToPayVendor(params.pos);
  const toPayExpensePaise = calcToPayExpenses(
    params.expenses.filter((e) => e.paidAt === null),
  );
  const gstOut = calcGstOutput(params.invoices, params.monthStart, params.monthEnd);
  const gstInput = calcGstInput(params.expenses, params.monthStart, params.monthEnd);

  return {
    toCollectPaise,
    overduePaise,
    notYetInvoicedPaise,
    receivedPaise,
    toPayVendorPaise,
    toPayExpensePaise,
    toPayTotalPaise: toPayVendorPaise + toPayExpensePaise,
    gstOutput: gstOut.total,
    gstInput,
    gstNet: gstOut.total - gstInput,
    gstCgst: gstOut.cgst,
    gstSgst: gstOut.sgst,
    gstIgst: gstOut.igst,
  };
}
