// Types for Purchase Orders, GRNs, and BOQ summary

export type POStatus = 'draft' | 'sent' | 'acknowledged' | 'partial' | 'complete' | 'cancelled';

export interface POLine {
  id: string;
  materialId?: string;
  description: string;
  qty: number;
  unit: string;
  unitRatePaise: number;
  totalPaise: number;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  projectId: string;
  vendorId: string | null;
  poNumber: string;
  linesJson: POLine[];
  status: POStatus;
  advancePaidPaise: number;
  expectedDeliveryAt: string | null;
  pdfUrl: string | null;
  waMessageId: string | null;
  createdAt: string;
}

export interface GRN {
  id: string;
  tenantId: string;
  poId: string;
  lineId: string | null;
  deliveredQty: number;
  photoProof: string[];
  receivedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface BOQQuotedSummary {
  totalClientPaise: number;
  totalCostPaise: number;
  totalMarginPaise: number;
}

export interface BOQSummary {
  quoted: BOQQuotedSummary;
  poCount: number;
  grnCount: number;
}
