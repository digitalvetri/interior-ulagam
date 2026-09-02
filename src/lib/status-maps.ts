export interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  dot?: string;
}

export type StatusMap = Record<string, StatusConfig>;

export const LEAD_STATUS_MAP: StatusMap = {
  new:         { label: 'New',         bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
  contacted:   { label: 'Contacted',   bg: '#E0F2FE',              color: '#0369A1' },
  qualified:   { label: 'Qualified',   bg: '#CCFBF1',              color: '#0F766E' },
  site_visit:  { label: 'Site Visit',  bg: '#FEF9C3',              color: '#854D0E' },
  measurement: { label: 'Measurement', bg: 'var(--warning-soft)',  color: '#C2410C' },
  quotation:   { label: 'Quotation',   bg: '#EEF2FF',              color: '#4338CA' },
  negotiation: { label: 'Negotiation', bg: 'var(--accent-soft)',   color: 'var(--accent-base)' },
  won:         { label: 'Won',         bg: 'var(--success-soft)',  color: 'var(--success-text)' },
  lost:        { label: 'Lost',        bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  // legacy
  site_visit_scheduled: { label: 'Site Visit',         bg: '#FEF9C3',             color: '#854D0E' },
  consultation_done:    { label: 'Consultation Done',   bg: 'var(--warning-soft)', color: '#C2410C' },
  proposal_sent:        { label: 'Proposal Sent',       bg: '#EEF2FF',             color: '#4338CA' },
};

export const QUOTE_STATUS_MAP: StatusMap = {
  draft:    { label: 'Draft',    bg: '#F1F5F9',             color: '#64748B' },
  sent:     { label: 'Sent',     bg: '#FEF9C3',             color: '#854D0E' },
  revised:  { label: 'Revised',  bg: 'var(--warning-soft)', color: '#92400E' },
  accepted: { label: 'Accepted', bg: 'var(--success-soft)', color: 'var(--success-text)' },
  approved: { label: 'Accepted', bg: 'var(--success-soft)', color: 'var(--success-text)' }, // legacy alias
  rejected: { label: 'Rejected', bg: 'var(--danger-soft)',  color: 'var(--danger)' },
};

export const MILESTONE_STATUS_MAP: StatusMap = {
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-primary)',  dot: 'var(--text-tertiary)' },
  link_sent: { label: 'Link Sent', bg: 'var(--accent-soft)',   color: 'var(--accent-text)',   dot: 'var(--accent-base)' },
  paid:      { label: 'Paid',      bg: 'var(--success-soft)',  color: 'var(--success-text)',  dot: 'var(--success)' },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',   color: 'var(--danger)',        dot: 'var(--danger)' },
};

export const DELIVERABLE_STATUS_MAP: StatusMap = {
  pending:     { label: 'Pending',         bg: 'var(--surface-muted)', color: 'var(--text-primary)',  dot: 'var(--text-tertiary)' },
  in_progress: { label: 'In Progress',     bg: 'var(--accent-soft)',   color: 'var(--accent-text)',   dot: 'var(--accent-base)' },
  in_review:   { label: 'In Review',       bg: 'var(--warning-soft)',  color: 'var(--warning-text)',  dot: 'var(--warning)' },
  approved:    { label: 'Approved',        bg: 'var(--success-soft)',  color: 'var(--success-text)',  dot: 'var(--success)' },
  rejected:    { label: 'Rejected',        bg: 'var(--danger-soft)',   color: 'var(--danger)',        dot: 'var(--danger)' },
};

export const SNAG_STATUS_MAP: StatusMap = {
  open:             { label: 'Open',             bg: 'var(--danger-soft)',  color: 'var(--danger)',       dot: 'var(--danger)' },
  in_progress:      { label: 'In Progress',      bg: 'var(--warning-soft)', color: 'var(--warning-text)', dot: 'var(--warning)' },
  resolved:         { label: 'Resolved',         bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
  client_confirmed: { label: 'Client Confirmed', bg: 'var(--accent-soft)',  color: 'var(--accent-text)',  dot: 'var(--accent-base)' },
};

export const PO_STATUS_MAP: StatusMap = {
  draft:        { label: 'Draft',        bg: 'var(--surface-muted)',    color: 'var(--text-secondary)' },
  sent:         { label: 'Sent',         bg: 'var(--accent-blue-bg)',   color: 'var(--accent-blue)' },
  acknowledged: { label: 'Acknowledged', bg: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' },
  partial:      { label: 'Partial',      bg: 'var(--accent-orange-bg)', color: 'var(--accent-orange)' },
  complete:     { label: 'Complete',     bg: 'var(--success-soft)',     color: 'var(--success-text)' },
  cancelled:    { label: 'Cancelled',    bg: '#FEE2E2',                 color: '#B91C1C' },
};

export type StatusModule = 'leads' | 'quotes' | 'milestones' | 'deliverables' | 'snags' | 'pos';

export const STATUS_MAPS: Record<StatusModule, StatusMap> = {
  leads:       LEAD_STATUS_MAP,
  quotes:      QUOTE_STATUS_MAP,
  milestones:  MILESTONE_STATUS_MAP,
  deliverables: DELIVERABLE_STATUS_MAP,
  snags:       SNAG_STATUS_MAP,
  pos:         PO_STATUS_MAP,
};
