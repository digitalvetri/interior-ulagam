export interface SiteVisit {
  id: string;
  tenantId: string;
  leadId: string;
  designerId?: string;
  scheduledAt: string;
  completedAt?: string;
  locationJson?: { address?: string; [key: string]: unknown };
  photos: string[];
  voiceNotes: string[];
  notes?: string;
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
