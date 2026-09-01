export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'site_visit'
  | 'measurement'
  | 'quotation'
  | 'negotiation'
  | 'won'
  | 'lost'
  // legacy — kept for display compat until data is migrated
  | 'site_visit_scheduled'
  | 'consultation_done'
  | 'proposal_sent';

export type LeadSource =
  | 'instagram'
  | 'whatsapp'
  | 'referral'
  | 'website'
  | 'walk_in'
  | 'other';

export type LeadPriority = 'hot' | 'warm' | 'cold';

export type FollowUpStatus = 'pending' | 'completed' | 'overdue' | 'rescheduled' | 'cancelled';

export interface ScoreBreakdown {
  recency: number;      // 0–30
  value: number;        // 0–25
  completeness: number; // 0–20
  source: number;       // 0–15
  engagement: number;   // 0–10
}

export interface Lead {
  id: string;
  tenantId: string;
  contactName: string;
  contactPhone: string;
  alternatePhone?: string | null;
  contactEmail?: string | null;
  contactCity?: string | null;
  pincode?: string | null;
  source: LeadSource;
  stage: LeadStage;
  priority?: LeadPriority;
  ownerId?: string | null;
  designerName?: string | null;
  propertyType?: string | null;
  projectName?: string | null;
  projectLocation?: string | null;
  budgetBand?: string | null;
  projectValuePaise?: number | null;
  followUpDate?: string | null;
  notes?: string | null;
  lostReason?: string | null;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  firstTouchAt: string;
  lastActivityAt: string;
  archivedAt?: string | null;
  createdAt: string;
  customerId?: string | null;
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

export interface MeasurementDimensions {
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  unit: 'ft' | 'm' | 'sqft' | 'sqm';
  notes?: string;
}

export interface MeasurementItem {
  id: string;
  roundId: string;
  room: string;
  itemName: string;
  dimensionsJson: MeasurementDimensions;
  qty: number;
  unit: string;
  notes?: string;
  createdAt: string;
}

export interface MeasurementRound {
  id: string;
  leadId: string;
  roundName: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  notes?: string | null;
  createdAt: string;
  items?: MeasurementItem[];
}

export type FollowUpType = 'call' | 'whatsapp' | 'meeting' | 'email';

export interface LeadFollowUp {
  id: string;
  leadId: string;
  followUpDate?: string | null;
  followUpType?: FollowUpType | null;
  stage: string;
  clientStatus: string;
  comments?: string | null;
  completedAt?: string | null;
  rescheduledFromId?: string | null;
  rescheduledNotes?: string | null;
  addToCalendar: boolean;
  createdByName?: string | null;
  createdAt: string;
}

export const STAGE_ORDER: LeadStage[] = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement',
  'quotation', 'negotiation', 'won', 'lost',
];

export const ACTIVE_STAGES: LeadStage[] = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement',
  'quotation', 'negotiation',
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new:         'New Inquiry',
  contacted:   'Contacted',
  qualified:   'Qualified',
  site_visit:  'Site Visit',
  measurement: 'Measurement',
  quotation:   'Quotation',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
  // legacy
  site_visit_scheduled: 'Site Visit',
  consultation_done:    'Consultation',
  proposal_sent:        'Quotation',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new:         'bg-blue-100 text-blue-800',
  contacted:   'bg-sky-100 text-sky-800',
  qualified:   'bg-teal-100 text-teal-800',
  site_visit:  'bg-amber-100 text-amber-800',
  measurement: 'bg-orange-100 text-orange-800',
  quotation:   'bg-indigo-100 text-indigo-800',
  negotiation: 'bg-purple-100 text-purple-800',
  won:         'bg-green-100 text-green-800',
  lost:        'bg-gray-100 text-gray-600',
  // legacy
  site_visit_scheduled: 'bg-amber-100 text-amber-800',
  consultation_done:    'bg-orange-100 text-orange-800',
  proposal_sent:        'bg-indigo-100 text-indigo-800',
};

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; bg: string; color: string; dot: string }> = {
  hot:  { label: 'Hot',  bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  warm: { label: 'Warm', bg: '#FFF7ED', color: '#EA580C', dot: '#F97316' },
  cold: { label: 'Cold', bg: '#EFF6FF', color: '#2563EB', dot: '#3B82F6' },
};
