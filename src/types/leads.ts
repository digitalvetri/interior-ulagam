export type LeadStage =
  | 'new'
  | 'site_visit_scheduled'
  | 'consultation_done'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadSource =
  | 'instagram'
  | 'whatsapp'
  | 'referral'
  | 'website'
  | 'walk_in'
  | 'other';

export interface Lead {
  id: string;
  tenantId: string;
  contactName: string;
  contactPhone: string;
  source: LeadSource;
  stage: LeadStage;
  ownerId?: string;
  budgetBand?: string;
  notes?: string;
  lostReason?: string;
  firstTouchAt: string;
  lastActivityAt: string;
  createdAt: string;
}

export const STAGE_ORDER: LeadStage[] = [
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
];

export const ACTIVE_STAGES: LeadStage[] = [
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  site_visit_scheduled: 'Site Visit',
  consultation_done: 'Consultation Done',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: 'bg-blue-100 text-blue-800',
  site_visit_scheduled: 'bg-yellow-100 text-yellow-800',
  consultation_done: 'bg-orange-100 text-orange-800',
  proposal_sent: 'bg-indigo-100 text-indigo-800',
  negotiation: 'bg-pink-100 text-pink-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
};
