// ─── Accounts & Finance types ────────────────────────────────────────────────
// All monetary values are in PAISE (integers). Display layer divides by 100.

export type ExpenseCategory =
  | 'petty_cash'
  | 'transport'
  | 'labour'
  | 'material'
  | 'other';

export interface Invoice {
  id: string;
  tenantId: string;
  projectId: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date string (yyyy-mm-dd)
  status: 'draft' | 'issued' | 'part_paid' | 'paid' | 'void';
  issuedAt: string | null;
  dueDate: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  placeOfSupply: string | null;
  isInterstate: boolean;
  irn: string | null;
  qrCodeUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  // joined
  projectName?: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  projectId: string;
  category: ExpenseCategory;
  amountPaise: number;
  description: string | null;
  receiptUrl: string | null;
  loggedBy: string | null;
  loggedVia: string;
  approvedBy: string | null;
  approvedAt: string | null;
  vendorName: string | null;
  vendorId: string | null;
  gstPct: number;
  gstAmountPaise: number;
  expenseNumber: string | null;
  dueDate: string | null;
  paidAt: string | null;
  paymentMode: string | null;
  payeeType: string | null;
  poId: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface VendorBillPayment {
  id: string;
  expenseId: string | null;
  purchaseOrderId: string | null;
  amountPaise: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  paidAt: string;
  createdAt: string;
}

export interface PnLSummary {
  projectId: string;
  totalClientPaise: number;   // sum(clientRatePaise * qty) across approved quote lines
  totalCostPaise: number;     // sum(costRatePaise * qty) across approved quote lines
  totalMarginPaise: number;   // sum(marginPaise) across approved quote lines
  totalPaidPaise: number;     // sum(payments.amountPaise) where status='captured'
  totalExpensesPaise: number; // sum(expenses.amountPaise) for project
  receivablePaise: number;    // totalClientPaise - totalPaidPaise
  actualMarginPaise: number;  // totalPaidPaise - totalExpensesPaise
}

export interface InvoicePayment {
  id: string;
  tenantId: string;
  invoiceId: string;
  razorpayLinkId: string | null;
  razorpayPaymentId: string | null;
  amountPaise: number;
  status: string;
  reconciledAt: string | null;
  manualOverrideBy: string | null;
  manualOverrideNote: string | null;
  createdAt: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  payments: InvoicePayment[];
  project?: { id: string; name: string; clientName?: string | null; clientPhone?: string | null } | null;
  sourceMilestone?: { id: string; projectId: string; label: string } | null;
}

export interface ReceivableItem {
  id: string;                 // milestone id
  projectId: string;
  projectName: string;
  label: string;
  amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue';
  createdAt: string;
  daysSinceCreation: number;
}
