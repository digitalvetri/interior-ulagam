'use client';

import { useEffect, useState, useCallback, useMemo, memo, useDeferredValue, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Phone, MessageCircle, Calendar, MapPin, Home, User, Clock,
  Users, Filter, ChevronDown, BarChart2, ChevronUp, AlertTriangle, TrendingUp,
  MoreVertical, Trash2, Archive, Edit2, BellRing, LayoutList, Table2,
} from 'lucide-react';
import { Lead, LeadStage, LeadPriority, LeadSource, STAGE_LABELS, PRIORITY_CONFIG } from '@/types/leads';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { FollowUpModal } from '@/components/leads/FollowUpModal';
import { LeadViewModal } from '@/components/leads/LeadViewModal';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupees } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────────────────── */
type FilterKey = LeadStage | 'all' | 'follow_up' | 'in_progress';
type SortKey   = 'latest' | 'followup' | 'budget' | 'name' | 'score';
type RottingStatus = 'fresh' | 'stale' | 'rotting';

const IN_PROGRESS_STAGES: LeadStage[] = ['contacted', 'qualified', 'site_visit', 'measurement', 'quotation', 'negotiation'];

/* ── Status chip config ─────────────────────────────────────────────────────── */
const STATUS_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'new',         label: 'New' },
  { key: 'follow_up',   label: 'Follow Up Due' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'won',         label: 'Won' },
  { key: 'lost',        label: 'Lost' },
];

/* ── Stage badge style ──────────────────────────────────────────────────────── */
const STAGE_STYLE: Record<LeadStage, { bg: string; color: string }> = {
  new:         { bg: 'var(--accent-soft)', color: 'var(--accent-text)' },
  contacted:   { bg: '#E0F2FE', color: '#0369A1' },
  qualified:   { bg: '#CCFBF1', color: '#0F766E' },
  site_visit:  { bg: '#FEF9C3', color: '#854D0E' },
  measurement: { bg: 'var(--warning-soft)', color: '#C2410C' },
  quotation:   { bg: '#EEF2FF', color: '#4338CA' },
  negotiation: { bg: 'var(--accent-soft)', color: 'var(--accent-base)' },
  won:         { bg: 'var(--success-soft)', color: 'var(--success-text)' },
  lost:        { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  // legacy
  site_visit_scheduled: { bg: '#FEF9C3', color: '#854D0E' },
  consultation_done:    { bg: 'var(--warning-soft)', color: '#C2410C' },
  proposal_sent:        { bg: '#EEF2FF', color: '#4338CA' },
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function followUpState(dateIso?: string | null): 'overdue' | 'today' | 'upcoming' | null {
  if (!dateIso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fd = new Date(dateIso); fd.setHours(0, 0, 0, 0);
  if (fd < today)  return 'overdue';
  if (fd.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

function getRottingStatus(lastActivityAt: string): RottingStatus {
  const d = daysSince(lastActivityAt);
  if (d <= 7)  return 'fresh';
  if (d <= 14) return 'stale';
  return 'rotting';
}

const FU_STYLE = {
  overdue:  { bg: 'var(--danger-soft)', color: 'var(--danger)' },
  today:    { bg: 'var(--warning-soft)', color: 'var(--warning)' },
  upcoming: { bg: 'var(--success-soft)', color: 'var(--success-text)' },
};

const ROTTING_BORDER: Record<RottingStatus, string> = {
  fresh:   'var(--border-subtle)',
  stale:   'var(--warning)',
  rotting: 'var(--danger)',
};

const SOURCE_META: Record<string, { label: string; dot: string; color: string }> = {
  instagram: { label: 'Instagram', dot: '#E1306C',              color: '#E1306C'              },
  whatsapp:  { label: 'WhatsApp',  dot: '#25D366',              color: '#16A34A'              },
  referral:  { label: 'Referral',  dot: 'var(--accent-base)',   color: 'var(--accent-text)'   },
  website:   { label: 'Website',   dot: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
  walk_in:   { label: 'Walk-in',   dot: '#F97316',              color: '#EA580C'              },
  other:     { label: 'Other',     dot: 'var(--text-tertiary)', color: 'var(--text-tertiary)' },
};

/* ── Lead list card ──────────────────────────────────────────────────────────── */
const LeadListCard = memo(function LeadListCard({
  lead,
  onDelete,
  onArchive,
  onFollowUp,
  onViewFollowUps,
  destinationHref,
}: {
  lead: Lead;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onFollowUp: (lead: Lead) => void;
  onViewFollowUps: (lead: Lead) => void;
  destinationHref?: string;
}) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);
  const stageStyle = STAGE_STYLE[lead.stage];
  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const fuState = followUpState(lead.followUpDate);
  const age = daysSince(lead.lastActivityAt);
  const rotting = getRottingStatus(lead.lastActivityAt);
  const borderColor = ROTTING_BORDER[rotting];

  const waHref = `https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`;

  return (
    <div
      className="rounded-xl p-3.5 cursor-pointer transition-all duration-150 hover:shadow-md hover:translate-y-[-1px]"
      style={{
        background: 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: rotting === 'rotting'
          ? '0 0 0 1px var(--danger), 0 1px 3px rgba(0,0,0,0.05)'
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
      onClick={() => router.push(destinationHref ?? `/leads/${lead.id}`)}
    >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white select-none flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #9B8AFB 100%)' }}
          >
            {lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: name + badges + action icons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--text-heading)] truncate">
                  {lead.contactName}
                </h3>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
                  style={{ background: stageStyle.bg, color: stageStyle.color }}
                >
                  {STAGE_LABELS[lead.stage]}
                </span>
                {priorityCfg && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0"
                    style={{ background: priorityCfg.bg, color: priorityCfg.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                    {priorityCfg.label}
                  </span>
                )}
                {rotting === 'rotting' && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                    Rotting
                  </span>
                )}
                {rotting === 'stale' && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0" style={{ background: '#FFF3CD', color: 'var(--warning-text)' }}>
                    Stale
                  </span>
                )}
              </div>

              {/* Quick action icons + 3-dot menu */}
              <div
                className="flex items-center gap-0.5 flex-shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <a
                  href={`tel:${lead.contactPhone}`}
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
                  style={{ background: 'rgba(59,130,246,0.12)' }}
                  title="Call"
                >
                  <Phone className="h-4 w-4" style={{ color: '#3B82F6' }} />
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:scale-105"
                  style={{ background: 'rgba(37,211,102,0.12)' }}
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" style={{ color: '#16A34A' }} />
                </a>
                {/* 3-dot context menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    suppressHydrationWarning
                    title="More actions"
                    onClick={() => setShowMenu(v => !v)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <MoreVertical className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 w-40 rounded-xl shadow-xl z-30 overflow-hidden"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
                    >
                      <button
                        type="button"
                    suppressHydrationWarning
                        onClick={() => { setShowMenu(false); router.push(`/leads/${lead.id}`); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--violet-primary)' }} /> Edit Lead
                      </button>
                      <button
                        type="button"
                    suppressHydrationWarning
                        onClick={() => { setShowMenu(false); onViewFollowUps(lead); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-violet-50 transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <BellRing className="h-3.5 w-3.5" style={{ color: 'var(--violet-primary)' }} /> Follow-up History
                      </button>
                      <button
                        type="button"
                    suppressHydrationWarning
                        onClick={() => { setShowMenu(false); onArchive(lead.id); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-amber-50 transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Archive className="h-3.5 w-3.5 text-amber-500" /> Archive
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
                    suppressHydrationWarning
                          onClick={() => { setShowMenu(false); onDelete(lead.id); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-red-50 transition-colors text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: contact info */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                <Phone className="h-3 w-3 flex-shrink-0" />
                {lead.contactPhone}
              </span>
              {lead.contactEmail && (
                <span className="text-[12px] text-[var(--text-secondary)] truncate max-w-[180px]">
                  {lead.contactEmail}
                </span>
              )}
              {lead.contactCity && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {lead.contactCity}
                </span>
              )}
              {lead.source && SOURCE_META[lead.source] && (
                <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: SOURCE_META[lead.source].color }}>
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: SOURCE_META[lead.source].dot }} />
                  {SOURCE_META[lead.source].label}
                </span>
              )}
            </div>

            {/* Row 3: last activity + follow-up flag */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: rotting === 'rotting' ? 'var(--danger)' : rotting === 'stale' ? 'var(--warning)' : 'var(--text-tertiary)' }}
              >
                <Clock className="h-3 w-3 flex-shrink-0" />
                {age === 0 ? 'Today' : `${age}d ago`}
              </span>
              {fuState && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5"
                  style={{ background: FU_STYLE[fuState].bg, color: FU_STYLE[fuState].color }}
                >
                  <BellRing className="h-2.5 w-2.5 flex-shrink-0" />
                  {fuState === 'overdue' ? 'F/U Overdue' : fuState === 'today' ? 'F/U Today' : 'F/U Scheduled'}
                </span>
              )}
            </div>
          </div>
        </div>
    </div>
  );
});

/* ── KPI Stats Bar ───────────────────────────────────────────────────────────── */
function KpiBar({ leads }: { leads: Lead[] }) {
  const now = new Date();
  const newCount     = leads.filter(l => l.stage === 'new').length;
  const fuToday      = leads.filter(l => followUpState(l.followUpDate) === 'today').length;
  const goingCold    = leads.filter(l => {
    const d = daysSince(l.lastActivityAt);
    return d > 7 && !['won', 'lost'].includes(l.stage);
  }).length;
  const wonThisMonth = leads.filter(l => {
    if (l.stage !== 'won') return false;
    const d = new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: 'New leads',            value: newCount,     icon: Users,         accent: 'var(--accent-base)', bg: 'var(--accent-soft)',  title: undefined },
    { label: 'Follow-up due today',  value: fuToday,      icon: BellRing,      accent: 'var(--warning)',     bg: 'var(--warning-soft)', title: undefined },
    { label: 'Going cold',           value: goingCold,    icon: AlertTriangle, accent: 'var(--danger)',      bg: 'var(--danger-soft)',  title: 'Leads with no activity in 7–14 days' },
    { label: 'Converted this month', value: wonThisMonth, icon: TrendingUp,    accent: 'var(--success)',     bg: 'var(--success-soft)', title: undefined },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, accent, bg, title }) => (
        <div
          key={label}
          title={title}
          className="rounded-xl p-4 flex items-start justify-between gap-2"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: title ? 'help' : 'default' }}
        >
          <div className="min-w-0">
            <p className="text-[12px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-[28px] font-bold leading-tight mt-1" style={{ color: accent }}>{value}</p>
          </div>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bg }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Pipeline Intelligence Panel ────────────────────────────────────────────── */
interface StageStats { count: number; valuePaise: number }

const PIPELINE_STAGES: LeadStage[] = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement', 'quotation', 'negotiation',
];

function PipelinePanel({ leads }: { leads: Lead[] }) {

  const stageStats = useMemo(() => {
    const map: Record<string, StageStats> = {};
    for (const s of PIPELINE_STAGES) map[s] = { count: 0, valuePaise: 0 };
    for (const l of leads) {
      if (map[l.stage]) {
        map[l.stage].count++;
        map[l.stage].valuePaise += l.projectValuePaise ?? 0;
      }
    }
    return map;
  }, [leads]);

  const maxCount = Math.max(1, ...Object.values(stageStats).map(s => s.count));
  const totalPipeline = leads
    .filter(l => PIPELINE_STAGES.includes(l.stage as LeadStage))
    .reduce((sum, l) => sum + (l.projectValuePaise ?? 0), 0);
  const rottingCount = leads.filter(l => daysSince(l.lastActivityAt) > 14 && !['won','lost'].includes(l.stage)).length;
  const overdueCount = leads.filter(l => followUpState(l.followUpDate) === 'overdue').length;
  const wonCount     = leads.filter(l => l.stage === 'won').length;
  const convRate     = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0;

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* KPI chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: 'var(--purple-soft)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--violet-primary)' }}>Pipeline Value</p>
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--violet-primary)' }}>
            ₹{(totalPipeline / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'var(--success-soft)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--success)' }}>Win Rate</p>
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--success-text)' }}>{convRate}%</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: rottingCount > 0 ? 'var(--danger-soft)' : 'var(--surface-muted)' }}>
          <p className="text-[11px] font-medium" style={{ color: rottingCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
            <span className="flex items-center justify-center gap-1">
              {rottingCount > 0 && <AlertTriangle className="h-3 w-3" />}
              Rotting
            </span>
          </p>
          <p className="text-base font-bold mt-0.5" style={{ color: rottingCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{rottingCount}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: overdueCount > 0 ? 'var(--warning-soft)' : 'var(--surface-muted)' }}>
          <p className="text-[11px] font-medium" style={{ color: overdueCount > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>Overdue F/U</p>
          <p className="text-base font-bold mt-0.5" style={{ color: overdueCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{overdueCount}</p>
        </div>
      </div>

      {/* Stage bars */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>STAGE BREAKDOWN</p>
        {PIPELINE_STAGES.map(stage => {
          const s = stageStats[stage];
          const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-[11px] w-28 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {STAGE_LABELS[stage]}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: 'var(--violet-primary)' }}
                />
              </div>
              <span className="text-[11px] font-semibold w-6 text-right" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
              {s.valuePaise > 0 && (
                <span className="text-[10px] w-24 text-right flex-shrink-0" style={{ color: 'var(--text-gold)' }}>
                  ₹{(s.valuePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Inline confirmation for list-level delete / archive ─────────────────────── */
function ListConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            style={{ background: danger ? 'var(--danger)' : 'var(--violet-primary)', color: '#fff' }}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const deferredSearch              = useDeferredValue(search);
  const [activeChip, setActiveChip] = useState<FilterKey>(() => {
    const s = searchParams.get('stage');
    if (!s || s === 'all') return 'all';
    return s as FilterKey;
  });
  const [sortBy, setSortBy]         = useState<SortKey>('latest');
  const [viewMode, setViewMode]         = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters]   = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');
  const [filterSource, setFilterSource]     = useState<LeadSource | 'all'>('all');

  // List-level delete / archive
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'archive'; id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Follow-up modals
  const [followUpLead, setFollowUpLead]         = useState<Lead | null>(null);
  const [viewFollowUpsLead, setViewFollowUpsLead] = useState<Lead | null>(null);

  const handleFollowUp = useCallback((lead: Lead) => setFollowUpLead(lead), []);
  const handleViewFollowUps = useCallback((lead: Lead) => setViewFollowUpsLead(lead), []);

  const refetch = useCallback(() => {
    fetch('/api/v1/leads')
      .then(r => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { refetch(); }, [refetch]);

  // Real-time: instant push from Supabase + 30s polling fallback
  useRealtimeSync(['leads'], refetch);

  const handleLeadCreated = useCallback((lead: Lead) => {
    router.push(`/leads/${lead.id}`);
  }, [router]);

  const handleDeleteFromList = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    if (lead) setPendingAction({ type: 'delete', id, name: lead.contactName });
  }, [leads]);

  const handleArchiveFromList = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    if (lead) setPendingAction({ type: 'archive', id, name: lead.contactName });
  }, [leads]);

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === 'delete') {
        await fetch(`/api/v1/leads/${pendingAction.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/v1/leads/${pendingAction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archive: true }),
        });
      }
      setLeads(prev => prev.filter(l => l.id !== pendingAction.id));
      setPendingAction(null);
    } catch {
      // silent – leave the dialog open so user can retry
    } finally {
      setActionLoading(false);
    }
  }

  /* Count per chip key */
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach(l => {
      counts[l.stage] = (counts[l.stage] ?? 0) + 1;
      if (IN_PROGRESS_STAGES.includes(l.stage)) {
        counts['in_progress'] = (counts['in_progress'] ?? 0) + 1;
      }
      const fuState = followUpState(l.followUpDate);
      if (fuState === 'overdue' || fuState === 'today') {
        counts['follow_up'] = (counts['follow_up'] ?? 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;

    /* Stage / chip filter */
    if (activeChip === 'follow_up') {
      result = result.filter(l => {
        const s = followUpState(l.followUpDate);
        return s === 'overdue' || s === 'today';
      });
    } else if (activeChip === 'in_progress') {
      result = result.filter(l => IN_PROGRESS_STAGES.includes(l.stage));
    } else if (activeChip !== 'all') {
      result = result.filter(l => l.stage === activeChip);
    }

    /* Priority + source (behind filter button) */
    if (filterPriority !== 'all') result = result.filter(l => l.priority === filterPriority);
    if (filterSource !== 'all')   result = result.filter(l => l.source === filterSource);

    /* Text search — uses deferred value so typing stays instant */
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(l =>
        l.contactName.toLowerCase().includes(q) ||
        l.contactPhone.includes(q) ||
        (l.contactEmail ?? '').toLowerCase().includes(q) ||
        (l.projectLocation ?? '').toLowerCase().includes(q),
      );
    }

    /* Sort */
    if (sortBy === 'followup') {
      result = [...result].sort((a, b) => {
        if (!a.followUpDate) return 1;
        if (!b.followUpDate) return -1;
        return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime();
      });
    } else if (sortBy === 'budget') {
      result = [...result].sort((a, b) => (b.projectValuePaise ?? 0) - (a.projectValuePaise ?? 0));
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.contactName.localeCompare(b.contactName));
    } else if (sortBy === 'score') {
      result = [...result].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return result;
  }, [leads, activeChip, filterPriority, filterSource, deferredSearch, sortBy]);

  /* Group filtered leads by customer — one card per customer on the list */
  const grouped = useMemo(() => {
    const map = new Map<string, { groupKey: string; customerId: string | null; primaryLead: Lead; count: number }>();
    for (const lead of filtered) {
      const key = lead.customerId ?? `__phone__${lead.contactPhone}`;
      if (!map.has(key)) {
        map.set(key, { groupKey: key, customerId: lead.customerId ?? null, primaryLead: lead, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  return (
    <div className="p-4 lg:p-6">

      {/* Follow-up modals */}
      {followUpLead && (
        <FollowUpModal
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onSaved={() => { setFollowUpLead(null); refetch(); }}
        />
      )}
      {viewFollowUpsLead && (
        <LeadViewModal
          lead={viewFollowUpsLead}
          onClose={() => setViewFollowUpsLead(null)}
        />
      )}

      {/* List-level delete/archive confirmation */}
      <ListConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.type === 'delete' ? 'Delete lead?' : 'Archive lead?'}
        message={
          pendingAction?.type === 'delete'
            ? `"${pendingAction.name}" will be permanently deleted. This cannot be undone.`
            : `"${pendingAction?.name}" will be moved to the archive and hidden from the pipeline.`
        }
        confirmLabel={pendingAction?.type === 'delete' ? 'Delete' : 'Archive'}
        danger={pendingAction?.type === 'delete'}
        loading={actionLoading}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <div className="pb-6 space-y-3">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Leads</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {grouped.length} customer{grouped.length !== 1 ? 's' : ''} · {filtered.length} lead{filtered.length !== 1 ? 's' : ''} shown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/leads/analytics"
              className="flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] text-[13px] font-medium transition-colors"
              style={{
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border-subtle)',
                textDecoration: 'none',
              }}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <button
              type="button"
              className="flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] text-[13px] font-medium transition-colors"
              style={{
                background: showPipeline ? 'var(--purple-soft)' : 'var(--surface-card)',
                color: showPipeline ? 'var(--violet-primary)' : 'var(--text-primary)',
                border: showPipeline ? '1.5px solid var(--accent-soft)' : '1.5px solid var(--border-subtle)',
              }}
              onClick={() => setShowPipeline(v => !v)}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pipeline</span>
              {showPipeline
                ? <ChevronUp className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3" />}
            </button>
            {/* Board / Table toggle */}
            <div className="flex rounded-[10px] overflow-hidden" style={{ border: '1.5px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className="flex items-center gap-1.5 h-[34px] px-3 text-[13px] font-medium transition-colors"
                style={{
                  background: viewMode === 'cards' ? 'var(--purple-soft)' : 'var(--surface-card)',
                  color: viewMode === 'cards' ? 'var(--violet-primary)' : 'var(--text-primary)',
                }}
                title="Card view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className="flex items-center gap-1.5 h-[34px] px-3 text-[13px] font-medium transition-colors"
                style={{
                  background: viewMode === 'table' ? 'var(--purple-soft)' : 'var(--surface-card)',
                  color: viewMode === 'table' ? 'var(--violet-primary)' : 'var(--text-primary)',
                  borderLeft: '1.5px solid var(--border-subtle)',
                }}
                title="Table view"
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <NewLeadDialog onSuccess={handleLeadCreated} defaultOpen={searchParams.get('new') === '1'} />
          </div>
        </div>

        {/* ── KPI Stats Bar ──────────────────────────────────────────────── */}
        {!loading && <KpiBar leads={leads} />}

        {/* ── Pipeline Intelligence Panel ─────────────────────────────── */}
        {showPipeline && !loading && (
          <PipelinePanel leads={leads} />
        )}

        {/* ── Search + sort ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-[400px]">
            <Search className="studio-search-icon" style={{ width: 14, height: 14 }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, city…"
              className="studio-input w-full text-[13px] h-[38px]"
              style={{ paddingLeft: '2.25rem' }}
              suppressHydrationWarning
            />
          </div>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="studio-input h-[38px] text-[13px] pl-3 pr-8 cursor-pointer appearance-none min-w-[140px]"
              style={{ color: 'var(--text-primary)' }}
              suppressHydrationWarning
            >
              <option value="latest">Latest First</option>
              <option value="score">By Score</option>
              <option value="followup">By Follow-up</option>
              <option value="budget">By Budget</option>
              <option value="name">By Name</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>


        {/* ── Status filter chips ─────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap" style={{ scrollbarWidth: 'none' }}>
          {STATUS_CHIPS.map(chip => {
            const count = chipCounts[chip.key] ?? 0;
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveChip(chip.key)}
                suppressHydrationWarning
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-all"
                style={isActive ? {
                  background: 'var(--violet-primary)',
                  color: 'var(--surface-card)',
                  boxShadow: '0 2px 6px rgba(124,92,252,0.3)',
                } : {
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-subtle)',
                }}
              >
                {chip.label}
                <span
                  className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-muted)',
                    color:      isActive ? 'var(--surface-card)' : 'var(--text-secondary)',
                    opacity:    count === 0 && !isActive ? 0.4 : 1,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>


        {/* ── Lead list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse"
                style={{ height: 78, background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-[16px] flex flex-col items-center justify-center gap-3 py-16"
            style={{ background: 'var(--surface-card)', border: '1.5px dashed var(--border-subtle)' }}
          >
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--purple-soft)' }}
            >
              <Users className="h-6 w-6" style={{ color: 'var(--violet-primary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {search || activeChip !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </p>
            {!search && activeChip === 'all' && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Capture your first enquiry to get started</p>
                <NewLeadDialog onSuccess={handleLeadCreated} triggerLabel="+ Add New Lead" />
              </>
            )}
          </div>
        ) : viewMode === 'table' ? (() => {
          const leadColumns: Column<Lead>[] = [
            {
              key: 'name',
              header: 'Name',
              sortable: true,
              render: (l) => (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #9B8AFB 100%)' }}>
                    {l.contactName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>{l.contactName}</span>
                </div>
              ),
            },
            {
              key: 'phone',
              header: 'Phone',
              render: (l) => <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{l.contactPhone}</span>,
            },
            {
              key: 'stage',
              header: 'Stage',
              render: (l) => <StatusBadge module="leads" status={l.stage} />,
            },
            {
              key: 'score',
              header: 'Score',
              align: 'right',
              sortable: true,
              render: (l) => (
                <span className="font-semibold tabular-nums text-sm" style={{ color: 'var(--text-heading)' }}>{l.score}</span>
              ),
            },
            {
              key: 'followup',
              header: 'Follow-up',
              render: (l) => {
                if (!l.followUpDate) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                const state = followUpState(l.followUpDate);
                const colorMap = { overdue: 'var(--danger)', today: 'var(--warning)', upcoming: 'var(--success-text)' };
                return (
                  <span className="text-xs" style={{ color: state ? colorMap[state] : 'var(--text-secondary)' }}>
                    {new Date(l.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                );
              },
            },
            {
              key: 'budget',
              header: 'Budget',
              align: 'right',
              render: (l) => l.projectValuePaise
                ? <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatRupees(l.projectValuePaise)}</span>
                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (l) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Schedule follow-up"
                    onClick={(e) => { e.stopPropagation(); handleFollowUp(l); }}
                    className="rounded-lg p-1.5 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--accent-base)' }}>
                    <BellRing className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Delete lead"
                    onClick={(e) => { e.stopPropagation(); handleDeleteFromList(l.id); }}
                    className="rounded-lg p-1.5 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--danger)' }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
            },
          ];
          return (
            <DataTable
              columns={leadColumns}
              rows={filtered}
              getRowKey={(l) => l.id}
              onRowClick={(l) => router.push(`/leads/${l.id}`)}
            />
          );
        })() : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {grouped.map(({ groupKey, customerId, primaryLead, count }) => {
                const destination = count === 1
                  ? `/leads/${primaryLead.id}`
                  : customerId
                    ? `/leads/customer/${customerId}`
                    : `/leads/customer/p/${encodeURIComponent(primaryLead.contactPhone)}`;
                return (
                  <motion.div
                    key={groupKey}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    <LeadListCard
                      lead={primaryLead}
                      onDelete={handleDeleteFromList}
                      onArchive={handleArchiveFromList}
                      onFollowUp={handleFollowUp}
                      onViewFollowUps={handleViewFollowUps}
                      destinationHref={destination}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
