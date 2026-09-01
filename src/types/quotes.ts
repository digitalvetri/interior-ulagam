export interface QuoteLine {
  id: string;
  quoteId: string;
  room: string;
  item: string;
  description?: string;
  qty: number;
  unit: string;
  clientRatePaise: number;
  costRatePaise: number;
  marginPaise: number;
  hsnSac?: string;
  materialId?: string;
  createdAt: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'revised' | 'accepted' | 'rejected' | 'approved';

export interface Quote {
  id: string;
  tenantId: string;
  projectId: string | null;
  projectName?: string | null;
  leadId?: string | null;
  leadContactName?: string | null;
  leadContactPhone?: string | null;
  leadStage?: string | null;
  leadBudgetBand?: string | null;
  parentQuoteId?: string | null;
  version: number;
  status: QuoteStatus;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  pdfUrl?: string;
  sentAt?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  lines?: QuoteLine[];
}

export type ProjectStage =
  | 'design_pending'
  | 'design_in_progress'
  | 'design_approved'
  | 'procurement'
  | 'execution'
  | 'snagging'
  | 'handover'
  | 'complete';

export interface Project {
  id: string;
  tenantId: string;
  leadId?: string;
  clientId?: string;
  name: string;
  designerIds: string[];
  totalContractPaise?: number;
  lifecycleStage: ProjectStage;
  startedAt?: string;
  expectedEndAt?: string;
  createdAt: string;
}
