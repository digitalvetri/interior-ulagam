export type MilestonePaymentStatus = 'pending' | 'link_sent' | 'paid' | 'overdue';

export type ProjectStage =
  | 'design_pending'
  | 'design_in_progress'
  | 'design_approved'
  | 'procurement'
  | 'execution'
  | 'snagging'
  | 'handover'
  | 'complete';

export interface Milestone {
  id: string;
  projectId: string;
  label: string;
  pctOfTotal: number;
  amountPaise: number;
  triggerStage: ProjectStage | null;
  invoiceId: string | null;
  paymentStatus: MilestonePaymentStatus;
  paidAt: string | null;
  razorpayLinkId: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  projectId: string;
  invoiceNumber: string;
  invoiceDate: string;
  hsnSacLinesJson: unknown[];
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
}

export interface Payment {
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
