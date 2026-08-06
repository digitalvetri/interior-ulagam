export type CustomerSource =
  | 'referral' | 'instagram' | 'whatsapp' | 'website' | 'walk_in' | 'imported' | 'other';

export type CustomerStage = 'lead' | 'opportunity' | 'client' | 'past_client';

export type CustomerHealthStatus = 'hot' | 'healthy' | 'at_risk' | 'inactive';

export type CustomerActivityType =
  | 'call' | 'whatsapp' | 'note' | 'site_visit' | 'meeting'
  | 'stage_change' | 'project_created' | 'payment_received' | 'quote_sent' | 'follow_up';

export interface Customer {
  id: string;
  tenantId: string;
  ownerId: string | null;
  leadId: string | null;
  fullName: string;
  email: string | null;
  phone: string;
  company: string | null;
  city: string | null;
  address: string | null;
  source: CustomerSource;
  stage: CustomerStage;
  tags: string[];
  notes: string | null;
  lastContactedAt: string | null;
  healthScore: number | null;
  healthStatus: CustomerHealthStatus | null;
  healthUpdatedAt: string | null;
  createdAt: string;
  // Joined from leads — most recently active (non-terminal) lead for this customer
  activeLeadId: string | null;
  activeLeadStage: string | null;
}

export const LEAD_STAGE_LABEL: Record<string, string> = {
  new:                  'New enquiry',
  site_visit_scheduled: 'Site visit scheduled',
  consultation_done:    'Consultation done',
  proposal_sent:        'Proposal sent',
  negotiation:          'Negotiation',
  won:                  'Won',
  lost:                 'Lost',
};

export interface CustomerActivity {
  id: string;
  tenantId: string;
  customerId: string;
  type: CustomerActivityType;
  title: string;
  body: string | null;
  metadataJson: Record<string, unknown> | null;
  scheduledAt: string | null;
  completedAt: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  projectCount: number;
  totalContractPaise: number;
  projects: Array<{
    id: string;
    name: string;
    lifecycleStage: string;
    totalContractPaise: number | null;
    leadId: string | null;
    siteAddress: string | null;
    createdAt: string;
  }>;
  leads: Array<{
    id: string;
    stage: string;
    projectName: string | null;
    projectLocation: string | null;
    budgetBand: string | null;
    source: string;
    createdAt: string;
  }>;
}
