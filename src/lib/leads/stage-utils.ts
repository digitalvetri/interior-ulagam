import type { LeadStage } from '@/types/leads';

export type CanonicalStage = 'new' | 'site_visit' | 'won' | 'lost';

export const STAGE_CANONICAL: Partial<Record<LeadStage, CanonicalStage>> = {
  contacted:            'new',
  qualified:            'new',
  measurement:          'site_visit',
  measured:             'site_visit',
  booked:               'site_visit',
  quotation:            'site_visit',
  negotiation:          'site_visit',
  site_visit_scheduled: 'site_visit',
  consultation_done:    'site_visit',
  proposal_sent:        'site_visit',
};

export function canonicalStage(stage: string): CanonicalStage {
  return (STAGE_CANONICAL[stage as LeadStage] ?? stage) as CanonicalStage;
}

export const STAGE_STYLE: Record<CanonicalStage, { bg: string; color: string; label: string }> = {
  new:        { bg: 'rgba(124,58,237,0.12)',  color: '#7C3AED', label: 'New Enquiry' },
  site_visit: { bg: 'rgba(245,158,11,0.14)',  color: '#D97706', label: 'Site Visit'  },
  won:        { bg: 'rgba(16,185,129,0.14)',   color: '#059669', label: 'Won'         },
  lost:       { bg: 'rgba(239,68,68,0.12)',    color: '#DC2626', label: 'Lost'        },
};

export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  referral:  'Referral',
  website:   'Website',
  walk_in:   'Walk-in',
  other:     'Other',
};

export const SOURCE_META: Record<string, { label: string; dot: string; color: string }> = {
  instagram: { label: 'Instagram', dot: '#E1306C',              color: '#E1306C'              },
  whatsapp:  { label: 'WhatsApp',  dot: '#25D366',              color: '#16A34A'              },
  referral:  { label: 'Referral',  dot: 'var(--accent-base)',   color: 'var(--accent-text)'   },
  website:   { label: 'Website',   dot: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
  walk_in:   { label: 'Walk-in',   dot: '#F97316',              color: '#EA580C'              },
  other:     { label: 'Other',     dot: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
};

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function fmtBudgetBand(band: string): string {
  if (!band) return '';
  const fmtNum = (s: string) =>
    s.replace(/(\d+(?:\.\d+)?)cr/i, '$1 Cr').replace(/(\d+(?:\.\d+)?)l/i, '$1L');
  if (band.startsWith('above_')) return `Above ${fmtNum(band.slice(6))}`;
  if (band.startsWith('below_')) return `Below ${fmtNum(band.slice(6))}`;
  const parts = band.split('_');
  if (parts.length === 2 && parts[0] && parts[1]) return `${fmtNum(parts[0])} – ${fmtNum(parts[1])}`;
  return band.replace(/_/g, ' ');
}

export function fmtFollowUpDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  const d = new Date(normalized);
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === tomorrow.getTime())  return 'Tomorrow';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
