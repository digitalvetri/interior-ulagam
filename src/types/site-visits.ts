export type SiteVisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type SiteVisitPurpose =
  | 'initial'
  | 'measurement'
  | 'design_review'
  | 'site_inspection'
  | 'material_inspection'
  | 'final_inspection'
  | 'other';

export const VISIT_PURPOSE_LABELS: Record<SiteVisitPurpose, string> = {
  initial:              'Initial visit',
  measurement:          'Measurement',
  design_review:        'Design review',
  site_inspection:      'Site inspection',
  material_inspection:  'Material inspection',
  final_inspection:     'Final inspection',
  other:                'Other',
};

export interface SiteVisit {
  id: string;
  tenantId: string;
  leadId: string;
  designerId?: string;
  status: SiteVisitStatus;
  purpose?: SiteVisitPurpose | null;
  visitNumber?: string | null;
  scheduledAt: string;
  completedAt?: string | null;
  locationJson?: { address?: string; [key: string]: unknown };
  photos: string[];
  voiceNotes: string[];
  notes?: string | null;
  createdAt: string;
}

export interface RoomEntry {
  name: string;
  stylePreference?: string;
  budgetBandPaise?: number;
  notes?: string;
}

export interface RequirementRow {
  id: string;
  tenantId: string;
  leadId: string;
  roomsJson: RoomEntry[];
  styleTags: string[];
  budgetBand?: string;
  moodboardUrls: string[];
  totalAreaSqft?: number;
  notes?: string;
  createdAt: string;
}
