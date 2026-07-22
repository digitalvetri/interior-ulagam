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
