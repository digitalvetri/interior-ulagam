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

export type LeadPriority = 'hot' | 'warm' | 'cold';

export type FollowUpStatus = 'pending' | 'completed' | 'overdue' | 'rescheduled' | 'cancelled';

export interface Lead {
  id: string;
  tenantId: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  source: LeadSource;
  stage: LeadStage;
  priority?: LeadPriority;
  ownerId?: string;
  designerName?: string;
  propertyType?: string;
  projectLocation?: string;
  budgetBand?: string;
  projectValuePaise?: number;
  followUpDate?: string;
  notes?: string;
  lostReason?: string;
  firstTouchAt: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'whatsapp' | 'note' | 'site_visit' | 'meeting' | 'stage_change' | 'follow_up';
  title: string;
  description?: string;
  scheduledAt?: string;
  completedAt?: string;
  status?: FollowUpStatus;
  createdBy?: string;
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
  new: 'New Inquiry',
  site_visit_scheduled: 'Site Visit',
  consultation_done: 'Consultation',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: 'bg-blue-100 text-blue-800',
  site_visit_scheduled: 'bg-amber-100 text-amber-800',
  consultation_done: 'bg-orange-100 text-orange-800',
  proposal_sent: 'bg-indigo-100 text-indigo-800',
  negotiation: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; bg: string; color: string; dot: string }> = {
  hot:  { label: 'Hot',  bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  warm: { label: 'Warm', bg: '#FFF7ED', color: '#EA580C', dot: '#F97316' },
  cold: { label: 'Cold', bg: '#EFF6FF', color: '#2563EB', dot: '#3B82F6' },
};
