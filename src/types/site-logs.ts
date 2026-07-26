export type SiteLogSource = 'whatsapp' | 'manual';

export interface SiteLog {
  id: string;
  tenantId: string;
  projectId: string;
  logDate: string; // ISO date string (YYYY-MM-DD)
  photos: string[];
  voiceNoteUrl?: string;
  transcript?: string;
  progressPct?: number; // 0-100 integer
  stage?: string;
  delayFlag: boolean;
  labourCount?: number;
  blockersJson?: unknown;
  aiParsedJson?: unknown;
  source: SiteLogSource;
  createdAt: string;
}
