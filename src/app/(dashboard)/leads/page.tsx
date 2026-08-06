'use client';

import { useEffect, useState, useCallback, useMemo, memo, useDeferredValue, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Phone, MessageCircle, Calendar, MapPin, Home, User, Clock,
  Users, Filter, ChevronDown, BarChart2, ChevronUp, AlertTriangle, TrendingUp,
  MoreVertical, Trash2, Archive, Edit2, BellRing,
} from 'lucide-react';
import { Lead, LeadStage, LeadPriority, LeadSource, STAGE_LABELS, PRIORITY_CONFIG } from '@/types/leads';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { FollowUpModal } from '@/components/leads/FollowUpModal';
import { LeadViewModal } from '@/components/leads/LeadViewModal';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

/* ── Types ──────────────────────────────────────────────────────────────────── */
type FilterKey = LeadStage | 'all' | 'follow_up';
type SortKey   = 'latest' | 'followup' | 'budget' | 'name' | 'score';
type RottingStatus = 'fresh' | 'stale' | 'rotting';

/* ── Status chip config ─────────────────────────────────────────────────────── */
const STATUS_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all',                  label: 'All' },
  { key: 'new',                  label: 'New' },
  { key: 'follow_up',            label: 'Follow-up' },
  { key: 'site_visit_scheduled', label: 'Site Visit' },
  { key: 'consultation_done',    label: 'Consultation' },
  { key: 'proposal_sent',        label: 'Quotation' },
  { key: 'won',                  label: 'Won' },
  { key: 'lost',                 label: 'Lost' },
];

/* ── Stage badge style ──────────────────────────────────────────────────────── */
const STAGE_STYLE: Record<LeadStage, { bg: string; color: string }> = {
  new:                  { bg: 'var(--accent-soft)', color: 'var(--accent-text)' },
  site_visit_scheduled: { bg: '#FEF9C3', color: '#854D0E' },
  consultation_done:    { bg: 'var(--warning-soft)', color: '#C2410C' },
  proposal_sent:        { bg: '#EEF2FF', color: '#4338CA' },
  negotiation:          { bg: 'var(--accent-soft)', color: 'var(--accent-base)' },
  won:                  { bg: 'var(--success-soft)', color: 'var(--success-text)' },
  lost:                 { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
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

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--text-tertiary)';
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

/* ── Lead list card ──────────────────────────────────────────────────────────── */
const LeadListCard = memo(function LeadListCard({
  lead,
  onDelete,
  onArchive,
  onFollowUp,
  onViewFollowUps,
}: {
  lead: Lead;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onFollowUp: (lead: Lead) => void;
  onViewFollowUps: (lead: Lead) => void;
}) {
  const router = useRouter();
  const [showScorePop, setShowScorePop] = useState(false);
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
  const score = lead.score ?? 0;
  const sColor = scoreColor(score);

  const waHref = `https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`;

  return (
    <div
      className="rounded-[16px] p-5 cursor-pointer transition-shadow duration-200 hover:shadow-md"
      style={{
        background: 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: rotting === 'rotting'
          ? '0 0 0 1px var(--danger), 0 1px 4px rgba(0,0,0,0.06)'
          : '0 1px 4px rgba(0,0,0,0.06)',
      }}
      onClick={() => router.push(`/leads/${lead.id}`)}
    >
        <div className="flex items-start gap-4">
          {/* Avatar + Score */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white select-none"
              style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #9B8AFB 100%)' }}
            >
              {lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            {/* Score badge with breakdown popover */}
            <div
              className="relative"
              onMouseEnter={() => setShowScorePop(true)}
              onMouseLeave={() => setShowScorePop(false)}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="rounded-full text-white text-[9px] font-bold px-1.5 py-0.5 leading-none cursor-default select-none"
                style={{ background: sColor, minWidth: 22, textAlign: 'center' }}
              >
                {score}
              </div>
              {showScorePop && lead.scoreBreakdown && (
                <div
                  className="absolute z-50 top-full left-1/2 mt-1.5 w-44 rounded-xl p-3 shadow-xl"
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', transform: 'translateX(-50%)' }}
                >
                  <p className="text-[10px] font-bold mb-2 tracking-wider" style={{ color: 'var(--violet-primary)' }}>
                    SCORE BREAKDOWN
                  </p>
                  {(
                    [
                      { label: 'Recency',      val: lead.scoreBreakdown.recency,      max: 30 },
                      { label: 'Value',        val: lead.scoreBreakdown.value,        max: 25 },
                      { label: 'Completeness', val: lead.scoreBreakdown.completeness, max: 20 },
                      { label: 'Source',       val: lead.scoreBreakdown.source,       max: 15 },
                      { label: 'Engagement',   val: lead.scoreBreakdown.engagement,   max: 10 },
                    ] as { label: string; val: number; max: number }[]
                  ).map(({ label, val, max }) => (
                    <div key={label} className="mb-1.5">
                      <div className="flex justify-between mb-0.5" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span>{label}</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{val}/{max}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: 'var(--surface-muted)' }}>
                        <div
                          className="h-1 rounded-full"
                          style={{ width: `${(val / max) * 100}%`, background: sColor }}
                        />
                      </div>
                    </div>
                  ))}
                  {lead.scoreBreakdown.engagement < 4 && (
                    <p className="text-[9px] mt-2 pt-2" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                      Tip: add a note or call to boost engagement
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: name + badges + action icons */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--text-heading)] truncate">
                  {lead.contactName}
                </h3>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  style={{ background: stageStyle.bg, color: stageStyle.color }}
                >
                  {STAGE_LABELS[lead.stage]}
                </span>
                {priorityCfg && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0"
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
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-blue-50"
                  title="Call"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-500" />
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-green-50"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </a>
                <button
                  type="button"
                  onClick={() => onFollowUp(lead)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-violet-50"
                  title={
                    fuState === 'overdue'  ? 'Overdue follow-up — add update'
                    : fuState === 'today' ? "Today's follow-up — add update"
                    : fuState === 'upcoming' ? 'Upcoming follow-up — add update'
                    : 'Add follow-up'
                  }
                  aria-label="Add follow-up"
                >
                  <BellRing
                    className="h-3.5 w-3.5"
                    style={{
                      color: fuState === 'overdue'  ? 'var(--danger)'
                           : fuState === 'today'    ? 'var(--warning)'
                           : fuState === 'upcoming' ? 'var(--accent-base)'
                           : 'var(--text-tertiary)',
                    }}
                  />
                </button>
                {/* 3-dot context menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
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
                        onClick={() => { setShowMenu(false); router.push(`/leads/${lead.id}`); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--violet-primary)' }} /> Edit Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); onViewFollowUps(lead); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-violet-50 transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <BellRing className="h-3.5 w-3.5" style={{ color: 'var(--violet-primary)' }} /> Follow-up History
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); onArchive(lead.id); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-amber-50 transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Archive className="h-3.5 w-3.5 text-amber-500" /> Archive
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
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

            {/* Row 2: phone, project type, location, budget */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.contactPhone}
              </span>
              {lead.propertyType && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Home className="h-3.5 w-3.5 flex-shrink-0" />
                  {lead.propertyType}
                </span>
              )}
              {lead.projectLocation && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  {lead.projectLocation}
                </span>
              )}
              {(lead.projectValuePaise ?? 0) > 0 && (
                <span className="text-sm font-medium" style={{ color: 'var(--text-gold)' }}>
                  ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>

            {/* Row 3: assigned, follow-up, last updated */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {lead.designerName && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  {lead.designerName}
                </span>
              )}
              {fuState && lead.followUpDate && (
                <span
                  className="flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5"
                  style={FU_STYLE[fuState]}
                >
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  {fuState === 'overdue' ? 'Overdue · ' : fuState === 'today' ? 'Today · ' : ''}
                  {fmtDate(lead.followUpDate)}
                </span>
              )}
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: rotting === 'rotting' ? 'var(--danger)' : rotting === 'stale' ? 'var(--warning)' : 'var(--text-secondary)' }}
              >
                <Clock className="h-3 w-3 flex-shrink-0" />
                {age === 0 ? 'Today' : `${age}d ago`}
              </span>
            </div>
          </div>
        </div>
    </div>
  );
});

/* ── Pipeline Intelligence Panel ────────────────────────────────────────────── */
interface StageStats { count: number; valuePaise: number }

const PIPELINE_STAGES: LeadStage[] = [
  'new', 'site_visit_scheduled', 'consultation_done', 'proposal_sent', 'negotiation',
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
  const searchParams = useSearchParams();
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const deferredSearch              = useDeferredValue(search);
  const [activeChip, setActiveChip] = useState<FilterKey>('all');
  const [sortBy, setSortBy]         = useState<SortKey>('latest');
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

  const handleLeadCreated = useCallback(() => {
    refetch();
  }, [refetch]);

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
      if (l.followUpDate) counts['follow_up'] = (counts['follow_up'] ?? 0) + 1;
    });
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;

    /* Stage / chip filter */
    if (activeChip === 'follow_up') {
      result = result.filter(l => !!l.followUpDate);
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

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

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

      <div className="px-6 pt-6 pb-8 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Leads</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {leads.length} total · {filtered.length} shown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/leads/analytics"
              className="flex items-center gap-2 h-[40px] px-4 rounded-[12px] text-sm font-medium transition-colors"
              style={{
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border-subtle)',
                textDecoration: 'none',
              }}
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 h-[40px] px-4 rounded-[12px] text-sm font-medium transition-colors"
              style={{
                background: showPipeline ? 'var(--purple-soft)' : 'var(--surface-card)',
                color: showPipeline ? 'var(--violet-primary)' : 'var(--text-primary)',
                border: showPipeline ? '1.5px solid var(--accent-soft)' : '1.5px solid var(--border-subtle)',
              }}
              onClick={() => setShowPipeline(v => !v)}
            >
              <BarChart2 className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline</span>
              {showPipeline
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <NewLeadDialog onSuccess={handleLeadCreated} defaultOpen={searchParams.get('new') === '1'} />
          </div>
        </div>

        {/* ── Pipeline Intelligence Panel ─────────────────────────────── */}
        {showPipeline && !loading && (
          <PipelinePanel leads={leads} />
        )}

        {/* ── Search + sort + filter ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="studio-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, location…"
              className="studio-input w-full text-sm h-[48px]"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="studio-input h-[48px] text-sm pl-4 pr-8 cursor-pointer appearance-none"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="latest">Latest First</option>
              <option value="score">By Score</option>
              <option value="followup">By Follow-up</option>
              <option value="budget">By Budget</option>
              <option value="name">By Name</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            className="flex items-center gap-2 h-[48px] px-4 rounded-[12px] text-sm font-medium transition-colors"
            style={{
              background: showFilters ? 'var(--purple-soft)' : 'var(--surface-card)',
              color: showFilters ? 'var(--violet-primary)' : 'var(--text-primary)',
              border: showFilters ? '1.5px solid var(--accent-soft)' : '1.5px solid var(--border-subtle)',
            }}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        {/* ── Expanded filter row ─────────────────────────────────────────── */}
        {showFilters && (
          <div
            className="flex gap-3 flex-wrap p-4 rounded-[12px]"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="relative">
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value as LeadPriority | 'all')}
                className="studio-input text-sm h-[40px] pl-3 pr-7 cursor-pointer appearance-none"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="all">All Priority</option>
                <option value="hot">🔴 Hot</option>
                <option value="warm">🟠 Warm</option>
                <option value="cold">🔵 Cold</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="relative">
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value as LeadSource | 'all')}
                className="studio-input text-sm h-[40px] pl-3 pr-7 cursor-pointer appearance-none"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="all">All Sources</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            </div>
            {(filterPriority !== 'all' || filterSource !== 'all') && (
              <button
                type="button"
                className="text-xs px-3"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => { setFilterPriority('all'); setFilterSource('all'); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Status filter chips ─────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
          {STATUS_CHIPS.map(chip => {
            const count = chipCounts[chip.key] ?? 0;
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveChip(chip.key)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all"
                style={isActive ? {
                  background: 'var(--violet-primary)',
                  color: 'var(--surface-card)',
                  boxShadow: '0 2px 8px rgba(124,92,252,0.35)',
                } : {
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-subtle)',
                }}
              >
                {chip.label}
                {count > 0 && (
                  <span
                    className="text-[11px] rounded-full px-1.5 py-0.5 font-semibold"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-muted)',
                      color:      isActive ? 'var(--surface-card)' : 'var(--text-secondary)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Lead list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-[16px] animate-pulse"
                style={{ height: 100, background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
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
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Add your first lead to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((lead) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  <LeadListCard
                    lead={lead}
                    onDelete={handleDeleteFromList}
                    onArchive={handleArchiveFromList}
                    onFollowUp={handleFollowUp}
                    onViewFollowUps={handleViewFollowUps}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
