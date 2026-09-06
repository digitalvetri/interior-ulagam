export type SnagStatus = 'open' | 'in_progress' | 'resolved' | 'client_confirmed';

export interface SnagItem {
  id: string;
  projectId: string;
  description: string;
  photoUrl: string | null;
  assigneeId: string | null;
  status: SnagStatus;
  clientConfirmedAt: string | null;
  waMessageId: string | null;
  createdAt: string;
}

export interface ClientMilestone {
  id: string;
  projectId: string;
  label: string;
  pctOfTotal: number;
  amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'paid' | 'overdue';
  paidAt: string | null;
  razorpayLinkId: string | null;
  createdAt: string;
}

export interface ClientDesignDeliverable {
  id: string;
  type: string;
  title: string;
  status: 'draft' | 'shared' | 'changes_requested' | 'approved';
  latestFileUrl: string | null;
  approvedAt: string | null;
}

export interface ClientDeliverable {
  id: string;
  projectId: string;
  type: '2d_plan' | '3d_render' | 'color_palette' | 'working_drawings' | 'bom';
  status: 'approved';
  latestFileUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ClientSiteLog {
  id: string;
  projectId: string;
  logDate: string;
  photos: string[];
  progressPct: number | null;
  createdAt: string;
}

export interface ClientProjectSnapshot {
  project: {
    name: string;
    lifecycleStage:
      | 'design_pending'
      | 'design_in_progress'
      | 'design_approved'
      | 'procurement'
      | 'execution'
      | 'snagging'
      | 'handover'
      | 'complete';
    expectedEndAt: string | null;
  };
  milestones: ClientMilestone[];
  deliverables: ClientDeliverable[];
  pendingDesignDeliverables: ClientDesignDeliverable[];
  recentSiteLogs: ClientSiteLog[];
  snagItems: SnagItem[];
}
