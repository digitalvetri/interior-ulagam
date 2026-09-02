'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Phone, Mail, MessageCircle, Calendar, FileText, Home,
  User, Users, MapPin, CheckCircle2, AlertCircle, Check,
  Plus, FolderKanban, ChevronDown, ChevronUp,
  Sparkles, Zap, ShieldAlert, Mic, MicOff,
  Edit2, Trash2, Archive, MoreVertical,
  Upload, ExternalLink, X, StickyNote, BellRing, Download,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity, MeasurementRound, MeasurementItem, LeadFollowUp } from '@/types/leads';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ScheduleSiteVisitModal } from '@/components/leads/ScheduleSiteVisitModal';
import { MarkContactedModal } from '@/components/leads/MarkContactedModal';
import { QualifyLeadModal } from '@/components/leads/QualifyLeadModal';
import { WonFlowModal } from '@/components/leads/WonFlowModal';
import type { Quote } from '@/types/quotes';
import type { DocumentRow } from '@/types/documents';
import type { SiteVisit } from '@/types/site-visits';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type LeadDocument = DocumentRow & { downloadUrl: string | null };

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  createdAt: string;
}

/* ── Helpers ───────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function followUpUrgency(dateIso: string): 'overdue' | 'today' | 'upcoming' {
  // Normalise to midnight local time — avoids IST/UTC offset false-positives.
  const dateStr = dateIso.length === 10 ? dateIso : dateIso.split('T')[0];
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}
function fmtFollowUpDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === tomorrow.getTime())  return 'Tomorrow';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral',
  website: 'Website', walk_in: 'Walk-in', other: 'Other',
};

/* ── Pipeline ──────────────────────────────────────────────── */
const PIPELINE_STEPS = [
  { key: 'new',         label: 'New' },
  { key: 'contacted',   label: 'Contacted' },
  { key: 'qualified',   label: 'Qualified' },
  { key: 'site_visit',  label: 'Site Visit' },
  { key: 'measurement', label: 'Measurement' },
  { key: 'quotation',   label: 'Quotation' },
  { key: 'won',         label: 'Won' },
];
const LEGACY_STAGE_MAP: Record<string, string> = {
  site_visit_scheduled: 'site_visit',
  consultation_done:    'measurement',
  proposal_sent:        'quotation',
};

// Contextual next-stage action for each mid-pipeline stage.
// terminal=true means use the /stage endpoint (won/lost), not the regular PATCH.
const NEXT_STAGE_MAP: Record<string, { label: string; targetStage: string; terminal?: boolean }> = {
  new:         { label: 'Mark as Contacted',  targetStage: 'contacted' },
  contacted:   { label: 'Qualify Lead',        targetStage: 'qualified' },
  qualified:   { label: 'Schedule Site Visit', targetStage: 'site_visit' },
  site_visit:  { label: 'Record Measurements', targetStage: 'measurement' },
  measurement: { label: 'Move to Quotation',   targetStage: 'quotation' },
  quotation:   { label: 'Mark as Won',         targetStage: 'won', terminal: true },
  // negotiation is legacy — kept for backward compat with existing data
  negotiation: { label: 'Mark as Won',         targetStage: 'won', terminal: true },
};

function PipelineBar({ stage, isLost, onStepClick, disabled = false }: {
  stage: string; isLost: boolean; onStepClick?: (stepKey: string) => void; disabled?: boolean;
}) {
  if (isLost) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <div className="h-1 rounded-full" style={{ width: '100%', background: 'var(--danger)' }} />
        </div>
        <span className="text-xs font-bold flex items-center gap-1.5 flex-shrink-0" style={{ color: 'var(--danger)' }}>
          <X className="h-3 w-3" /> Lost
        </span>
      </div>
    );
  }

  const normalised = LEGACY_STAGE_MAP[stage] ?? stage;
  const ci = PIPELINE_STEPS.findIndex(s => s.key === normalised);

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-1">
      <div className="flex items-start min-w-max">
        {PIPELINE_STEPS.map((step, i) => {
          const done      = ci >= 0 && i < ci;
          const active    = i === ci;
          const last      = i === PIPELINE_STEPS.length - 1;
          const clickable = i > ci && !!onStepClick && !disabled;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center" style={{ minWidth: 52 }}>
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  title={clickable ? `Move to ${step.label}` : undefined}
                  onClick={clickable ? () => onStepClick(step.key) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step.key); } : undefined}
                  className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-violet-300 hover:scale-110' : ''}`}
                  style={{
                    background: (done || active) ? 'var(--accent-base)' : 'var(--surface-muted)',
                    border: active ? '2px solid var(--accent-base)' : done ? 'none' : '1.5px solid var(--border-subtle)',
                    boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.18)' : 'none',
                    transform: active ? 'scale(1.18)' : 'scale(1)',
                  }}
                >
                  {done   && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  {active && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <span
                  onClick={clickable ? () => onStepClick(step.key) : undefined}
                  className={`text-[10px] mt-1.5 text-center leading-tight ${clickable ? 'cursor-pointer' : ''}`}
                  style={{
                    maxWidth: 48,
                    color:      active ? 'var(--accent-base)' : done ? 'var(--text-secondary)' : clickable ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
              {!last && (
                <div
                  className="h-0.5 flex-shrink-0 mt-3"
                  style={{ width: 20, background: done ? 'var(--accent-base)' : 'var(--border-subtle)' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-card inside an InfoCard ───────────────────────────── */
function LabelRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-[11px] w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-sm flex-1 font-medium" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  );
}

/* ── Section (collapsible) ─────────────────────────────────── */
function Section({ title, defaultOpen = true, action, children }: {
  title: string; defaultOpen?: boolean; action?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}>
        <button type="button" className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setOpen(v => !v)}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</span>
          {open
            ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />}
        </button>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}


/* ── MarkLostDialog ────────────────────────────────────────── */
function MarkLostDialog({ open, value, onChange, onConfirm, onCancel, loading }: {
  open: boolean; value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Mark Lead as Lost</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Provide a reason to help improve the team&apos;s close rate.</p>
        <textarea rows={3} className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-heading)' }}
          placeholder="e.g. Budget exceeded, chose a competitor, project postponed…"
          value={value} onChange={e => onChange(e.target.value)}
          autoFocus />
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading || !value.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: 'var(--danger)', color: '#fff' }}>
            {loading ? 'Marking Lost…' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Activity timeline entry ───────────────────────────────── */
const ACTIVITY_STYLE: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  note:         { Icon: StickyNote,    bg: '#EEF2FF',             color: '#4338CA' },
  call:         { Icon: Phone,         bg: '#EFF6FF',             color: '#2563EB' },
  whatsapp:     { Icon: MessageCircle, bg: '#F0FDF4',             color: '#16A34A' },
  meeting:      { Icon: Users,         bg: '#FFF7ED',             color: '#D97706' },
  follow_up:    { Icon: BellRing,      bg: '#FFFBEB',             color: '#D97706' },
  stage_change: { Icon: Zap,           bg: 'var(--accent-soft)',  color: 'var(--accent-base)' },
  site_visit:   { Icon: Home,          bg: 'var(--success-soft)', color: 'var(--success-text)' },
};

function TimelineEntry({ activity, isLast }: { activity: LeadActivity; isLast: boolean }) {
  const s = ACTIVITY_STYLE[activity.type] ?? ACTIVITY_STYLE.note;
  const { Icon } = s;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: s.bg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border-subtle)', minHeight: 16 }} />}
      </div>
      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{activity.title}</p>
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {relDate(activity.createdAt)} · {fmtTime(activity.createdAt)}
          </span>
        </div>
        {activity.description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: '1.55' }}>{activity.description}</p>
        )}
      </div>
    </div>
  );
}

/* ── MeasurementsTabContent ────────────────────────────────── */
function MeasurementsTabContent({ leadId, initialRounds, onRoundAdded }: {
  leadId: string;
  initialRounds: MeasurementRound[];
  onRoundAdded: (round: MeasurementRound) => void;
}) {
  const [rounds, setRounds]           = useState<MeasurementRound[]>(initialRounds);
  const [showAddRound, setShowAddRound] = useState(false);
  const [roundName, setRoundName]     = useState('');
  const [savingRound, setSavingRound] = useState(false);
  const [roundErr, setRoundErr]       = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [addingTo, setAddingTo]       = useState<string | null>(null);
  const [iRoom, setIRoom]   = useState('');
  const [iItem, setIItem]   = useState('');
  const [iLen, setILen]     = useState('');
  const [iWid, setIWid]     = useState('');
  const [iArea, setIArea]   = useState('');
  const [iQty, setIQty]     = useState('1');
  const [iUnit, setIUnit]   = useState('sqft');
  const [iNotes, setINotes] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [itemErr, setItemErr]       = useState<string | null>(null);

  async function createRound() {
    if (!roundName.trim()) return;
    setSavingRound(true); setRoundErr(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundName: roundName.trim() }),
      });
      const json = await res.json() as { data?: MeasurementRound; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      const newRound: MeasurementRound = { ...json.data!, items: [] };
      setRounds(prev => [...prev, newRound]);
      onRoundAdded(newRound);
      setRoundName(''); setShowAddRound(false); setExpandedId(newRound.id);
    } catch (e) { setRoundErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingRound(false); }
  }

  function clearItemForm() {
    setIRoom(''); setIItem(''); setILen(''); setIWid(''); setIArea('');
    setIQty('1'); setIUnit('sqft'); setINotes(''); setItemErr(null);
  }

  async function addItem(roundId: string) {
    if (!iRoom.trim() || !iItem.trim()) { setItemErr('Room and item name are required'); return; }
    setSavingItem(true); setItemErr(null);
    const dimensionsJson: Record<string, unknown> = { unit: iUnit };
    if (iLen)  dimensionsJson['length'] = parseFloat(iLen);
    if (iWid)  dimensionsJson['width']  = parseFloat(iWid);
    if (iArea) dimensionsJson['area']   = parseFloat(iArea);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements/${roundId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: iRoom.trim(), itemName: iItem.trim(), dimensionsJson,
          qty: parseInt(iQty) || 1, unit: iUnit, notes: iNotes.trim() || null,
        }),
      });
      const json = await res.json() as { data?: MeasurementItem; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setRounds(prev => prev.map(r =>
        r.id === roundId ? { ...r, items: [...(r.items ?? []), json.data!] } : r,
      ));
      clearItemForm(); setAddingTo(null);
    } catch (e) { setItemErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingItem(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {rounds.length} Round{rounds.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          {rounds.length > 0 && (
            <a
              href={`/api/v1/leads/${leadId}/measurements/pdf`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          <button type="button" onClick={() => setShowAddRound(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--violet-primary)', color: '#fff' }}>
            <Plus className="h-3.5 w-3.5" /> Add Round
          </button>
        </div>
      </div>

      {showAddRound && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
          <input value={roundName} onChange={e => setRoundName(e.target.value)}
            placeholder="Round name — e.g. Initial Measurement"
            className="studio-input w-full text-sm" />
          {roundErr && <p className="text-xs text-red-600">{roundErr}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={createRound} disabled={savingRound || !roundName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}>
              {savingRound ? 'Creating…' : 'Create Round'}
            </button>
            <button type="button" onClick={() => { setShowAddRound(false); setRoundName(''); setRoundErr(null); }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {rounds.length === 0 && !showAddRound && (
        <div className="text-center py-10">
          <Home className="h-9 w-9 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>No measurement rounds yet</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Create a round to capture room dimensions for BOQ</p>
        </div>
      )}

      {rounds.map(round => (
        <div key={round.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <button type="button"
            onClick={() => setExpandedId(prev => prev === round.id ? null : round.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-muted)] transition-colors">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{round.roundName}</span>
              {round.completedAt && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>DONE</span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {(round.items?.length ?? 0)} item{(round.items?.length ?? 0) !== 1 ? 's' : ''}
              </span>
              {round.scheduledAt && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(round.scheduledAt)}</span>
              )}
            </div>
            {expandedId === round.id
              ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            }
          </button>

          {expandedId === round.id && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {(round.items ?? []).length > 0 && (
                <div>
                  {(round.items ?? []).map((item, idx) => (
                    <div key={item.id} className="px-4 py-3" style={{ borderBottom: idx < (round.items ?? []).length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                        {item.room} — {item.itemName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {item.dimensionsJson.length && item.dimensionsJson.width
                          ? `${item.dimensionsJson.length} × ${item.dimensionsJson.width} ${item.dimensionsJson.unit}`
                          : item.dimensionsJson.area
                          ? `${item.dimensionsJson.area} ${item.dimensionsJson.unit}`
                          : '—'
                        }{' · '}qty {item.qty} {item.unit}
                      </p>
                      {item.notes && (
                        <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-tertiary)' }}>{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 space-y-2" style={{ background: 'var(--surface-muted)' }}>
                {addingTo !== round.id ? (
                  <button type="button" onClick={() => { setAddingTo(round.id); clearItemForm(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--violet-primary)' }}>
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={iRoom} onChange={e => setIRoom(e.target.value)} placeholder="Room" className="studio-input text-sm" />
                      <input value={iItem} onChange={e => setIItem(e.target.value)} placeholder="Item / Work" className="studio-input text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={iLen}  onChange={e => setILen(e.target.value)}  placeholder="L (ft)" type="number" min="0" step="0.01" className="studio-input text-sm" />
                      <input value={iWid}  onChange={e => setIWid(e.target.value)}  placeholder="W (ft)" type="number" min="0" step="0.01" className="studio-input text-sm" />
                      <input value={iArea} onChange={e => setIArea(e.target.value)} placeholder="Area"   type="number" min="0" step="0.01" className="studio-input text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={iQty} onChange={e => setIQty(e.target.value)} placeholder="Qty" type="number" min="1" className="studio-input text-sm" />
                      <select value={iUnit} onChange={e => setIUnit(e.target.value)} className="studio-input text-sm col-span-2">
                        {['sqft', 'sqm', 'ft', 'm', 'rft', 'nos', 'lot'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <input value={iNotes} onChange={e => setINotes(e.target.value)} placeholder="Notes (optional)" className="studio-input w-full text-sm" />
                    {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addItem(round.id)} disabled={savingItem}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                        {savingItem ? 'Saving…' : 'Save Item'}
                      </button>
                      <button type="button" onClick={() => { setAddingTo(null); clearItemForm(); }}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;
  const followUpRef = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  const scrollToFollowUp = useCallback(() => {
    followUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const [lead, setLead]                   = useState<Lead | null>(null);
  const [activities, setActivities]       = useState<LeadActivity[]>([]);
  const [customerId, setCustomerId]       = useState<string | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; lifecycleStage: string } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);

  const [leadQuotes, setLeadQuotes]       = useState<Quote[]>([]);
  const [leadDocs, setLeadDocs]           = useState<LeadDocument[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [uploadingDoc, setUploadingDoc]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity log
  type ActivityLogType = 'call' | 'whatsapp' | 'meeting' | 'note';
  const [activityType, setActivityType] = useState<ActivityLogType>('note');
  const [noteText, setNoteText]     = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError]   = useState<string | null>(null);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpError, setFUError]     = useState<string | null>(null);
  const [savingFU, setSavingFU]         = useState(false);
  const [clearingFU, setClearingFU]     = useState(false);
  const [fuSuccess, setFUSuccess]       = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  // Menus / dialogs
  const [showActionsMenu, setShowActionsMenu]       = useState(false);
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Stage actions
  const [advancingStage, setAdvancingStage]           = useState(false);
  const [markingWon, setMarkingWon]                   = useState(false);
  const [markingLost, setMarkingLost]                 = useState(false);
  const [reopening, setReopening]                     = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog]   = useState(false);
  const [lostReasonInput, setLostReasonInput]         = useState('');
  const [stageError, setStageError]                   = useState<string | null>(null);

  // Customer conversion
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Site visit modal
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);

  // Stage-action modals
  const [showMarkContactedModal, setShowMarkContactedModal] = useState(false);
  const [showQualifyModal, setShowQualifyModal]             = useState(false);
  const [showWonFlowModal, setShowWonFlowModal]             = useState(false);

  // Tabs
  type TabKey = 'overview' | 'activity' | 'followups' | 'sitevisits' | 'measurements' | 'quotations' | 'documents';
  const [activeTab, setActiveTab]           = useState<TabKey>('overview');
  const [siteVisitsData, setSiteVisitsData] = useState<SiteVisit[]>([]);
  const [measurementsData, setMeasurementsData] = useState<MeasurementRound[]>([]);
  const [followUpsData, setFollowUpsData]   = useState<LeadFollowUp[]>([]);
  const [tabLoaded, setTabLoaded]           = useState<Set<TabKey>>(new Set(['overview', 'activity', 'quotations', 'documents']));

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // AI Brief
  type BriefData = { summary: string; nextBestAction: string; riskFlags: string[]; sentiment: 'hot' | 'warm' | 'cold' | 'lost' };
  const [brief, setBrief]               = useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError]     = useState<string | null>(null);

  // Voice recording
  const [recording, setRecording]               = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing]         = useState(false);
  const [userRole, setUserRole]                 = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowActionsMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  useEffect(() => {
    if (!recording) return;
    const timerId = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    return () => clearInterval(timerId);
  }, [recording]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
      fetch(`/api/v1/leads/${id}/quotes`).catch(() => null),
      fetch(`/api/v1/leads/${id}/documents`).catch(() => null),
      fetch('/api/v1/me').catch(() => null),
      fetch(`/api/v1/site-visits?leadId=${id}`).catch(() => null),
      fetch(`/api/v1/leads/${id}/measurements`).catch(() => null),
    ]).then(async ([leadRes, actRes, quotesRes, docsRes, meRes, svRes, mrRes]) => {
      if (leadRes.status === 404) { setNotFound(true); setLoading(false); return; }
      const { data: leadData } = await leadRes.json() as {
        data: Lead & {
          recentMessages?: WaMessage[];
          customerId?: string | null;
          linkedProject?: { id: string; name: string; lifecycleStage: string } | null;
        }
      };
      setCustomerId(leadData.customerId ?? null);
      setLinkedProject(leadData.linkedProject ?? null);
      setLead(leadData);
      if (actRes?.ok) {
        const { data: actData } = await actRes.json() as { data: LeadActivity[] };
        setActivities(actData ?? []);
      }
      if (quotesRes?.ok) {
        const { data: qData } = await quotesRes.json() as { data: Quote[] };
        setLeadQuotes(qData ?? []);
      }
      if (docsRes?.ok) {
        const { data: dData } = await docsRes.json() as { data: LeadDocument[] };
        setLeadDocs(dData ?? []);
      }
      if (meRes?.ok) {
        const meJson = await meRes.json() as { data?: { role?: string } };
        setUserRole(meJson.data?.role ?? '');
      }
      if (svRes?.ok) {
        const svJson = await svRes.json() as { data: SiteVisit[] };
        setSiteVisitsData(svJson.data ?? []);
      }
      if (mrRes?.ok) {
        const mrJson = await mrRes.json() as { data: MeasurementRound[] };
        setMeasurementsData(mrJson.data ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true); setNoteError(null);
    const titleMap: Record<ActivityLogType, string> = {
      call:     `Call — ${lead?.contactName ?? 'client'}`,
      whatsapp: 'WhatsApp message',
      meeting:  `Meeting — ${lead?.contactName ?? 'client'}`,
      note:     'Note',
    };
    try {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activityType, title: titleMap[activityType], description: noteText.trim() }),
      });
      const json = await res.json().catch(() => ({})) as { data?: LeadActivity; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setActivities(prev => [json.data!, ...prev]);
      setNoteText('');
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSavingNote(false); }
  }

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    setSavingFU(true); setFUError(null); setFUSuccess(false);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
      if (followUpNote.trim()) {
        const dueDateLabel = new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const actRes = await fetch(`/api/v1/leads/${id}/activities`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'follow_up', title: `Follow-up — ${dueDateLabel}`, description: followUpNote.trim(), scheduledAt: new Date(followUpDate + 'T00:00:00').toISOString(), status: 'pending' }),
        });
        if (actRes.ok) {
          const actJson = await actRes.json() as { data?: LeadActivity };
          if (actJson.data) setActivities(prev => [actJson.data!, ...prev]);
        }
      }
      setFollowUpDate(''); setFollowUpNote('');
      setFUSuccess(true); setTimeout(() => setFUSuccess(false), 3000);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule');
    } finally { setSavingFU(false); }
  }

  async function clearFollowUp() {
    setClearingFU(true); setFUError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: null }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
      setShowReschedule(false);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to clear');
    } finally { setClearingFU(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Delete failed');
      }
      router.push('/leads');
    } catch (e) {
      setShowDeleteConfirm(false);
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const body = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Archive failed');
      router.push('/leads');
    } catch (e) {
      setShowArchiveConfirm(false);
      alert(e instanceof Error ? e.message : 'Archive failed');
    } finally { setArchiving(false); }
  }

  // Mid-pipeline stage advance (new → contacted → … → negotiation).
  // Uses the regular PATCH endpoint; refetches activities to surface the auto-logged stage_change.
  async function advanceStage(targetStage: string) {
    setAdvancingStage(true); setStageError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
      const actRes = await fetch(`/api/v1/leads/${id}/activities`).catch(() => null);
      if (actRes?.ok) {
        const { data } = await actRes.json() as { data: LeadActivity[] };
        setActivities(data ?? []);
      }
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Stage change failed');
    } finally { setAdvancingStage(false); }
  }

  // Terminal transitions (won / lost / reopen). Uses the /stage endpoint.
  async function changeStage(targetStage: string, lostReason?: string) {
    const isWonTarget  = targetStage === 'won';
    const isLostTarget = targetStage === 'lost';
    if (isWonTarget) setMarkingWon(true);
    else if (isLostTarget) setMarkingLost(true);
    else setReopening(true);
    setStageError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/stage`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage, ...(lostReason ? { lostReason } : {}) }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!); setShowMarkLostDialog(false); setLostReasonInput('');
      if (isWonTarget) {
        const refreshRes = await fetch(`/api/v1/leads/${id}`);
        if (refreshRes.ok) {
          const { data } = await refreshRes.json() as { data: Lead & { linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
          if (data.linkedProject) setLinkedProject(data.linkedProject);
        }
      }
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Stage change failed');
    } finally { setMarkingWon(false); setMarkingLost(false); setReopening(false); }
  }

  async function generateBrief() {
    setBriefLoading(true); setBriefError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/brief`, { method: 'POST' });
      const json = await res.json() as { data?: BriefData; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setBrief(json.data!);
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : 'Unable to generate brief');
    } finally { setBriefLoading(false); }
  }

  async function startRecording() {
    setNoteError(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setNoteError('Microphone access denied. Allow mic permission in your browser settings and try again.'); return; }
    const mimeType = (
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
      MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : null
    );
    let recorder: MediaRecorder;
    try { recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
    catch (e) { stream.getTracks().forEach(t => t.stop()); setNoteError(e instanceof Error ? e.message : 'Your browser does not support audio recording. Try Chrome or Edge.'); return; }
    audioChunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const ext = (mimeType ?? '').includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType ?? 'audio/webm' });
      if (blob.size === 0) { setNoteError('Recording was empty. Please try again.'); return; }
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', blob, `voice-note.${ext}`);
        const res = await fetch(`/api/v1/leads/${id}/voice-note`, { method: 'POST', body: form });
        const json = await res.json() as { data?: { transcript: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
        setNoteText(prev => (prev ? prev + '\n' : '') + json.data!.transcript);
      } catch (e) { setNoteError(e instanceof Error ? e.message : 'Transcription failed'); }
      finally { setTranscribing(false); }
    };
    recorder.start(); mediaRecorderRef.current = recorder; setRecording(true);
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); setRecording(false); setRecordingSeconds(0); }

  async function createQuote() {
    setCreatingQuote(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}/quotes`, { method: 'POST' });
      const json = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create quote');
      router.push(`/quotes/${json.data!.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to create quotation'); setCreatingQuote(false); }
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file); form.append('leadId', id);
      const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: form });
      const json = await res.json() as { data?: LeadDocument; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setLeadDocs(prev => [{ ...json.data!, downloadUrl: null }, ...prev]);
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingDoc(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function convertToCustomer() {
    setConverting(true); setConvertError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/convert-to-customer`, { method: 'POST' });
      const json = await res.json() as { data?: { customerId: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Conversion failed');
      setCustomerId(json.data!.customerId);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Conversion failed');
    } finally { setConverting(false); }
  }

  // Lazy-load follow-ups on first visit to that tab
  useEffect(() => {
    if (activeTab !== 'followups' || tabLoaded.has('followups') || !id) return;
    fetch(`/api/v1/leads/${id}/follow-ups`)
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: LeadFollowUp[] } | null) => {
        setFollowUpsData(json?.data ?? []);
        setTabLoaded(prev => new Set([...prev, 'followups']));
      })
      .catch(() => setTabLoaded(prev => new Set([...prev, 'followups'])));
  }, [activeTab, id, tabLoaded]);

  /* Loading / not-found */
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="p-6">
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Lead not found.</p>
        <button type="button" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-4 w-4" />Back to Pipeline
        </button>
      </div>
    );
  }

  /* ── Derived ─────────────────────────────────────────── */
  const priorityCfg  = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon        = lead.stage === 'won';
  const isLost       = lead.stage === 'lost';
  const isTerminal   = isWon || isLost;
  const initials     = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const fuUrgency    = lead.followUpDate ? followUpUrgency(lead.followUpDate) : null;

  const normalizedStage = LEGACY_STAGE_MAP[lead.stage] ?? lead.stage;
  const nextStageAction = !isTerminal ? (NEXT_STAGE_MAP[normalizedStage] ?? null) : null;

  const nowForTimeline = new Date();
  const upcomingActivities = [...activities]
    .filter(a => a.type === 'follow_up' && a.scheduledAt && new Date(a.scheduledAt) > nowForTimeline)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const historyActivities = [...activities]
    .filter(a => !(a.type === 'follow_up' && a.scheduledAt && new Date(a.scheduledAt) > nowForTimeline))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nextFuActivity = upcomingActivities[0] ?? null;

  const quickDates = [
    { label: 'Tomorrow', days: 1 },
    { label: '3 days',   days: 3 },
    { label: '1 week',   days: 7 },
  ];
  function applyQuickDate(days: number) {
    const d = new Date(); d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split('T')[0]);
  }

  const stageActionsDisabled = advancingStage || markingWon || markingLost || reopening;
  const waPhone = lead.contactPhone.replace(/\D/g, '').slice(-10);

  function handlePipelineStepClick(stepKey: string) {
    if (stepKey === 'contacted') { setShowMarkContactedModal(true); }
    else if (stepKey === 'qualified') { setShowQualifyModal(true); }
    else if (stepKey === 'site_visit') { setShowSiteVisitModal(true); }
    else if (stepKey === 'won') { setShowWonFlowModal(true); }
    else { void advanceStage(stepKey); }
  }

  async function handleSiteVisitSuccess() {
    // Refresh lead — API auto-advances stage to site_visit_scheduled
    const leadRes = await fetch(`/api/v1/leads/${id}`).catch(() => null);
    if (leadRes?.ok) {
      const { data } = await leadRes.json() as { data: Lead & { customerId?: string | null; linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
      setLead(data);
      setCustomerId(data.customerId ?? null);
      if (data.linkedProject) setLinkedProject(data.linkedProject);
    }
    const actRes = await fetch(`/api/v1/leads/${id}/activities`).catch(() => null);
    if (actRes?.ok) {
      const { data: actData } = await actRes.json() as { data: LeadActivity[] };
      setActivities(actData ?? []);
    }
    setToast('Site visit scheduled!');
    setTimeout(() => setToast(null), 3000);
  }

  /* ── Activity type pills ─────────────────────────────── */
  const activityPills: { type: ActivityLogType; label: string; Icon: React.ElementType }[] = [
    { type: 'call',     label: 'Call',     Icon: Phone },
    { type: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
    { type: 'meeting',  label: 'Meeting',  Icon: Users },
    { type: 'note',     label: 'Note',     Icon: StickyNote },
  ];

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete lead?"
        message={`"${lead.contactName}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" danger loading={deleting}
        onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive lead?"
        message={`"${lead.contactName}" will be moved to the archive and hidden from the active pipeline.`}
        confirmLabel="Archive" loading={archiving}
        onConfirm={handleArchive} onCancel={() => setShowArchiveConfirm(false)}
      />
      {showEditDialog && (
        <EditLeadDialog
          lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog}
          onSuccess={updated => { setLead(updated); setShowEditDialog(false); }}
        />
      )}
      <MarkLostDialog
        open={showMarkLostDialog} value={lostReasonInput} onChange={setLostReasonInput}
        loading={markingLost}
        onCancel={() => { setShowMarkLostDialog(false); setLostReasonInput(''); }}
        onConfirm={() => changeStage('lost', lostReasonInput)}
      />
      <ScheduleSiteVisitModal
        leadId={id}
        open={showSiteVisitModal}
        onOpenChange={setShowSiteVisitModal}
        defaultAddress={lead.projectLocation || [lead.contactCity, lead.pincode].filter(Boolean).join(', ')}
        onSuccess={(visit) => {
          setSiteVisitsData(prev => [visit as SiteVisit, ...prev]);
          void handleSiteVisitSuccess();
        }}
      />
      <MarkContactedModal
        leadId={id}
        contactName={lead.contactName}
        open={showMarkContactedModal}
        onClose={() => setShowMarkContactedModal(false)}
        onSuccess={(updatedLead, newActivity) => {
          setLead(updatedLead);
          setActivities(prev => [newActivity, ...prev]);
          setShowMarkContactedModal(false);
          setToast('Marked as contacted!');
          setTimeout(() => setToast(null), 3000);
        }}
      />
      <QualifyLeadModal
        leadId={id}
        lead={lead}
        open={showQualifyModal}
        onClose={() => setShowQualifyModal(false)}
        onSuccess={(updatedLead) => {
          setLead(updatedLead);
          setShowQualifyModal(false);
          setToast('Lead qualified!');
          setTimeout(() => setToast(null), 3000);
        }}
      />
      <WonFlowModal
        lead={lead}
        open={showWonFlowModal}
        onClose={() => setShowWonFlowModal(false)}
        onSuccess={(project) => {
          setLead(prev => prev ? { ...prev, stage: 'won' } : prev);
          setLinkedProject({ id: project.id, name: project.name, lifecycleStage: 'design_pending' });
          setShowWonFlowModal(false);
          setToast(`Project "${project.name}" created!`);
          setTimeout(() => setToast(null), 3000);
          router.push(`/projects/${project.id}`);
        }}
      />

      <div className="px-4 lg:px-6 pt-5 pb-28">

        {/* Back nav */}
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to Pipeline
        </Link>

        <div className="mt-4 space-y-4">

          {/* ── HEADER ──────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

            {/* Terminal banner */}
            {isTerminal && (
              <div className="flex items-center gap-2 px-5 py-3 text-sm font-medium" style={{
                background: isWon ? 'var(--success-soft)' : '#FEF2F2',
                borderBottom: `1px solid ${isWon ? '#86EFAC' : '#FCA5A5'}`,
                color: isWon ? 'var(--success-text)' : '#DC2626',
              }}>
                {isWon
                  ? <><CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Lead WON</>
                  : <><AlertCircle  className="h-4 w-4 flex-shrink-0" /> Lead Lost{lead.lostReason ? ` — ${lead.lostReason}` : ''}</>
                }
              </div>
            )}

            <div className="p-5">
              {/* Row 1: Avatar + Name + Priority + Stage + ⋯ menu */}
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #5B3FDD 100%)' }}>
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                      {lead.contactName}
                    </h1>
                    {priorityCfg && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: priorityCfg.bg, color: priorityCfg.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                        {priorityCfg.label.toUpperCase()}
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </div>

                  {/* Project name / property type subtitle */}
                  {(lead.projectName || lead.propertyType) && (
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {lead.projectName ?? lead.propertyType}
                    </p>
                  )}

                  {/* Contact meta */}
                  <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap">
                    <a href={`tel:${lead.contactPhone}`} className="flex items-center gap-1 text-[13px] hover:underline" style={{ color: 'var(--text-secondary)' }}>
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />{lead.contactPhone}
                    </a>
                    {lead.contactEmail && (
                      <a href={`mailto:${lead.contactEmail}`} className="flex items-center gap-1 text-[13px] hover:underline" style={{ color: 'var(--text-secondary)' }}>
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />{lead.contactEmail}
                      </a>
                    )}
                    {lead.contactCity && (
                      <span className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{lead.contactCity}
                      </span>
                    )}
                    {lead.designerName && (
                      <span className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                        <User className="h-3.5 w-3.5 flex-shrink-0" />{lead.designerName}
                      </span>
                    )}
                    <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      via {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                  </div>
                </div>

                {/* ⋯ menu — Edit / Archive / Delete */}
                <div className="relative flex-shrink-0" ref={menuRef}>
                  <button type="button" onClick={() => setShowActionsMenu(v => !v)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showActionsMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 overflow-hidden"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      <button type="button" onClick={() => { setShowActionsMenu(false); setShowEditDialog(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}>
                        <Edit2 className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} /> Edit Lead
                      </button>
                      <button type="button" onClick={() => { setShowActionsMenu(false); setShowArchiveConfirm(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}>
                        <Archive className="h-4 w-4 text-amber-500" /> Archive Lead
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={() => { setShowActionsMenu(false); setShowDeleteConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-red-50 transition-colors text-red-600">
                          <Trash2 className="h-4 w-4" /> Delete Lead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary action buttons */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <a href={`https://wa.me/91${waPhone}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A' }}>
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <a href={`tel:${lead.contactPhone}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB' }}>
                  <Phone className="h-4 w-4" /> Call
                </a>
                <button type="button" onClick={() => setShowEditDialog(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                  <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--violet-primary)' }} /> Edit
                </button>
              </div>

              {/* Project link — only when won */}
              {(linkedProject || isWon) && (
                <div className="mt-3">
                  {linkedProject ? (
                    <Link href={`/projects/${linkedProject.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                      style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                      <FolderKanban className="h-4 w-4" /> View Project
                    </Link>
                  ) : (
                    <Link href={`/projects?leadId=${id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                      style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                      <FolderKanban className="h-4 w-4" /> Create Project from Lead
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── PIPELINE + NEXT ACTION ───────────────────────────── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <PipelineBar
              stage={lead.stage}
              isLost={isLost}
              onStepClick={!isTerminal ? handlePipelineStepClick : undefined}
              disabled={stageActionsDisabled}
            />

            <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {/* Contextual next-action CTA */}
              {nextStageAction && (
                <button
                  type="button"
                  onClick={() => {
                    if (nextStageAction.targetStage === 'contacted') { setShowMarkContactedModal(true); }
                    else if (nextStageAction.targetStage === 'qualified') { setShowQualifyModal(true); }
                    else if (nextStageAction.targetStage === 'site_visit') { setShowSiteVisitModal(true); }
                    else if (nextStageAction.terminal) { setShowWonFlowModal(true); }
                    else { void advanceStage(nextStageAction.targetStage); }
                  }}
                  disabled={stageActionsDisabled}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity"
                  style={{ background: nextStageAction.terminal ? 'var(--success)' : 'var(--violet-primary)', color: '#fff' }}
                >
                  <ArrowRight className="h-4 w-4" />
                  {(advancingStage || (markingWon && nextStageAction.terminal)) ? 'Moving…' : nextStageAction.label}
                </button>
              )}

              {/* Reopen (lost state) */}
              {isLost && (
                <button type="button" onClick={() => changeStage('quotation')} disabled={stageActionsDisabled}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Zap className="h-4 w-4" />{reopening ? 'Reopening…' : 'Reopen Lead'}
                </button>
              )}

              {/* Mark as Won / Mark as Lost — shown for active non-terminal leads */}
              {!isTerminal && (
                <div className="flex items-center gap-2 ml-auto">
                  {/* Won */}
                  {!nextStageAction?.terminal && (
                    <button type="button" onClick={() => setShowWonFlowModal(true)} disabled={stageActionsDisabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border disabled:opacity-50"
                      style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'transparent' }}>
                      <CheckCircle2 className="h-4 w-4" />{markingWon ? 'Marking…' : 'Won'}
                    </button>
                  )}
                  {/* Lost */}
                  <button type="button" onClick={() => setShowMarkLostDialog(true)} disabled={stageActionsDisabled}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border disabled:opacity-50"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}>
                    <AlertCircle className="h-4 w-4" /> Lost
                  </button>
                </div>
              )}
            </div>
            {stageError && <p className="mt-2 text-xs text-red-600">{stageError}</p>}
          </div>

          {/* ── TABS ─────────────────────────────────────────────── */}

          {/* Tab nav */}
          <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: '2px solid var(--border-subtle)' }}>
            {(
              [
                { key: 'overview',     label: 'Overview',     count: 0 },
                { key: 'activity',     label: 'Activity',     count: activities.length },
                { key: 'followups',    label: 'Follow-ups',   count: followUpsData.length },
                { key: 'sitevisits',   label: 'Site Visits',  count: siteVisitsData.length },
                { key: 'measurements', label: 'Measurements', count: measurementsData.length },
                { key: 'quotations',   label: 'Quotations',   count: leadQuotes.length },
                { key: 'documents',    label: 'Documents',    count: leadDocs.length },
              ] as { key: TabKey; label: string; count: number }[]
            ).map(tab => (
              <button key={tab.key} type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-0.5 transition-colors"
                style={{
                  borderColor: activeTab === tab.key ? 'var(--violet-primary)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--violet-primary)' : 'var(--text-secondary)',
                  background: 'transparent',
                }}>
                {tab.label}
                {tab.count > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold"
                    style={{
                      background: activeTab === tab.key ? 'var(--violet-primary)' : 'var(--surface-muted)',
                      color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                    }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ──────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">

              {/* LEFT — Requirements + linked project + lead score */}
              <div className="space-y-4">
                <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Requirement</p>
                    <button type="button" onClick={() => setShowEditDialog(true)}
                      className="text-xs hover:underline" style={{ color: 'var(--violet-primary)' }}>
                      Edit
                    </button>
                  </div>
                  {(lead.propertyType || lead.budgetBand || lead.projectName || lead.notes || (lead.projectValuePaise ?? 0) > 0) ? (
                    <div>
                      <div className="-mt-1.5">
                        {lead.propertyType && <LabelRow label="Property Type" value={lead.propertyType} />}
                        {lead.projectName && <LabelRow label="Project Name" value={lead.projectName} />}
                        {lead.budgetBand && <LabelRow label="Budget" value={lead.budgetBand} />}
                        {(lead.projectValuePaise ?? 0) > 0 && (
                          <LabelRow label="Project Value" value={
                            <span style={{ color: 'var(--text-gold)', fontWeight: 600 }}>{fmt(lead.projectValuePaise!)}</span>
                          } />
                        )}
                      </div>
                      {lead.notes && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>NOTES</p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{lead.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>No project details yet</p>
                      <button type="button" onClick={() => setShowEditDialog(true)}
                        className="text-xs font-medium hover:underline"
                        style={{ color: 'var(--violet-primary)' }}>
                        + Add details
                      </button>
                    </div>
                  )}
                </div>{/* end Requirements card */}

                {/* Linked project — shown when won */}
                {linkedProject && (
                  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <FolderKanban className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--success-text)' }}>Linked Project</p>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{linkedProject.name}</p>
                    </div>
                    <Link href={`/projects/${linkedProject.id}`}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--success)', color: '#fff' }}>
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {/* Lead Score — owner only */}
                {userRole === 'owner' && (lead.score ?? 0) > 0 && lead.scoreBreakdown && (
                  <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Lead Score</p>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-3xl font-bold" style={{
                        color: (lead.score ?? 0) >= 70 ? 'var(--success)' : (lead.score ?? 0) >= 40 ? 'var(--warning)' : 'var(--text-secondary)',
                      }}>{lead.score}</div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>out of 100</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Updated automatically on activity</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {([
                        { label: 'Recency',       val: lead.scoreBreakdown.recency,      max: 30 },
                        { label: 'Project Value', val: lead.scoreBreakdown.value,        max: 25 },
                        { label: 'Completeness',  val: lead.scoreBreakdown.completeness, max: 20 },
                        { label: 'Source',        val: lead.scoreBreakdown.source,       max: 15 },
                        { label: 'Engagement',    val: lead.scoreBreakdown.engagement,   max: 10 },
                      ] as { label: string; val: number; max: number }[]).map(({ label, val, max }) => (
                        <div key={label}>
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                            <span>{label}</span>
                            <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{val}/{max}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-muted)' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(val / max) * 100}%`, background: 'var(--violet-primary)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>{/* end left column */}

              {/* RIGHT column — Follow-up + Customer + Site */}
              <div className="space-y-4">

                {/* NEXT FOLLOW-UP */}
                <div ref={followUpRef} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Next Follow-up</p>
                  {lead.followUpDate ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" style={{
                          color: fuUrgency === 'overdue' ? 'var(--danger)' : fuUrgency === 'today' ? 'var(--warning)' : 'var(--accent-base)',
                        }} />
                        <span className="text-base font-semibold" style={{
                          color: fuUrgency === 'overdue' ? 'var(--danger)' : 'var(--text-heading)',
                        }}>
                          {fmtFollowUpDate(lead.followUpDate)}
                        </span>
                        {fuUrgency === 'overdue' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>OVERDUE</span>
                        )}
                        {fuUrgency === 'today' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>TODAY</span>
                        )}
                      </div>
                      {nextFuActivity?.description && (
                        <p className="text-sm mb-3 ml-6" style={{ color: 'var(--text-secondary)' }}>{nextFuActivity.description}</p>
                      )}
                      {!showReschedule ? (
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={clearFollowUp} disabled={clearingFU}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                            <Check className="h-3 w-3" />{clearingFU ? 'Completing…' : 'Complete'}
                          </button>
                          <button type="button" onClick={() => setShowReschedule(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                            <Calendar className="h-3 w-3" /> Reschedule
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <div className="flex gap-1.5 flex-wrap">
                            {quickDates.map(({ label, days }) => (
                              <button key={label} type="button" onClick={() => applyQuickDate(days)}
                                className="px-2.5 py-1 text-xs rounded-lg"
                                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                                {label}
                              </button>
                            ))}
                          </div>
                          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                            className="studio-input w-full text-sm" min={new Date().toISOString().split('T')[0]} />
                          <textarea value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                            placeholder="Purpose or notes…" rows={2} className="studio-input w-full text-sm resize-none" />
                          {followUpError && <p className="text-xs text-red-600">{followUpError}</p>}
                          <div className="flex gap-2">
                            <button type="button" disabled={!followUpDate || savingFU}
                              onClick={async () => { await scheduleFollowUp(); setShowReschedule(false); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                              style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                              {savingFU ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => { setShowReschedule(false); setFollowUpDate(''); setFollowUpNote(''); }}
                              className="px-3 py-1.5 text-xs rounded-lg"
                              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {followUpError && !showReschedule && <p className="mt-2 text-xs text-red-600">{followUpError}</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {quickDates.map(({ label, days }) => (
                          <button key={label} type="button" onClick={() => applyQuickDate(days)}
                            className="px-2.5 py-1 text-xs rounded-lg"
                            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                        className="studio-input w-full text-sm" min={new Date().toISOString().split('T')[0]} />
                      {followUpDate && (
                        <textarea value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                          placeholder="Purpose (optional)…" rows={2} className="studio-input w-full text-sm resize-none" />
                      )}
                      {followUpError && <p className="text-xs text-red-600">{followUpError}</p>}
                      {fuSuccess && <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>Scheduled!</p>}
                      {followUpDate && (
                        <button type="button" onClick={scheduleFollowUp} disabled={savingFU}
                          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50">
                          <Calendar className="h-3.5 w-3.5" />{savingFU ? 'Saving…' : 'Schedule'}
                        </button>
                      )}
                      {!followUpDate && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Pick a date above to schedule.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* CUSTOMER */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Customer</p>
                  <p className="text-base font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>{lead.contactName}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</p>
                  {lead.contactEmail && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.contactEmail}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {customerId ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success-text)' }}>
                          <CheckCircle2 className="h-3 w-3" /> Existing Customer
                        </span>
                        <Link href={`/customers/${customerId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-75"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border-subtle)' }}>
                          <ExternalLink className="h-3 w-3" /> View Customer
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                          <User className="h-3 w-3" /> Not converted yet
                        </span>
                        <button type="button" onClick={convertToCustomer} disabled={converting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-75 disabled:opacity-50"
                          style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                          <Plus className="h-3 w-3" />{converting ? 'Converting…' : 'Convert to Customer'}
                        </button>
                      </>
                    )}
                  </div>
                  {convertError && <p className="mt-2 text-xs text-red-600">{convertError}</p>}
                </div>

                {/* SITE LOCATION */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Site Location</p>
                  {(lead.contactCity || lead.pincode || lead.projectLocation) ? (
                    <div>
                      {lead.contactCity && (
                        <p className="font-semibold flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-heading)' }}>
                          <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                          {lead.contactCity}{lead.pincode ? ` — ${lead.pincode}` : ''}
                        </p>
                      )}
                      {lead.projectLocation && (
                        <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{lead.projectLocation}</p>
                      )}
                      <button type="button" onClick={() => setShowSiteVisitModal(true)}
                        className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-75"
                        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                        <Home className="h-3 w-3" style={{ color: 'var(--violet-primary)' }} /> Schedule Site Visit
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>No location added yet.</p>
                      <button type="button" onClick={() => setShowEditDialog(true)}
                        className="text-xs font-medium hover:underline"
                        style={{ color: 'var(--violet-primary)' }}>
                        + Add location
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ── ACTIVITY ──────────────────────────────────────────── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">

              {/* Log activity */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Log Activity</p>

                {/* Activity type selector */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {(['note', 'call', 'whatsapp', 'meeting'] as ActivityLogType[]).map(t => (
                    <button key={t} type="button" onClick={() => setActivityType(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                      style={{
                        background: activityType === t ? 'var(--accent-soft)' : 'var(--surface-muted)',
                        border: `1.5px solid ${activityType === t ? 'var(--accent-base)' : 'var(--border-subtle)'}`,
                        color: activityType === t ? 'var(--accent-base)' : 'var(--text-secondary)',
                      }}>
                      {t === 'whatsapp' ? 'WhatsApp' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <textarea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder={activityType === 'note' ? 'Add a note…' : activityType === 'call' ? 'Call notes…' : activityType === 'whatsapp' ? 'WhatsApp message summary…' : 'Meeting notes…'}
                  className="studio-input w-full text-sm resize-none mb-2" />

                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={saveNote} disabled={savingNote || !noteText.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                    {savingNote ? 'Saving…' : 'Save'}
                  </button>

                  {/* Voice note button */}
                  {!recording ? (
                    <button type="button" onClick={startRecording} disabled={transcribing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                      <Mic className="h-4 w-4" style={{ color: transcribing ? 'var(--text-tertiary)' : 'var(--danger)' }} />
                      {transcribing ? 'Transcribing…' : 'Voice note'}
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                      <MicOff className="h-4 w-4" />
                      Stop ({recordingSeconds}s)
                    </button>
                  )}
                </div>
                {noteError && <p className="mt-2 text-xs text-red-600">{noteError}</p>}
              </div>

              {/* AI Brief */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>AI Brief</p>
                  {brief && (
                    <button type="button" onClick={generateBrief} disabled={briefLoading}
                      className="text-xs disabled:opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      {briefLoading ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  )}
                </div>
                {brief ? (
                  <div className="space-y-3">
                    {(() => {
                      const S = {
                        hot:  { bg: 'var(--danger-soft)',   color: 'var(--danger)' },
                        warm: { bg: 'var(--warning-soft)',  color: 'var(--warning)' },
                        cold: { bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
                        lost: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
                      };
                      const s = S[brief.sentiment];
                      return <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{brief.sentiment.toUpperCase()}</span>;
                    })()}
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)', lineHeight: '1.65' }}>{brief.summary}</p>
                    <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: 'var(--purple-soft)', border: '1px solid rgba(124,92,252,0.3)' }}>
                      <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--violet-primary)' }} />
                      <div>
                        <p className="text-[10px] font-bold mb-1 tracking-wider" style={{ color: 'var(--violet-primary)' }}>NEXT BEST ACTION</p>
                        <p className="text-sm" style={{ color: 'var(--text-heading)' }}>{brief.nextBestAction}</p>
                      </div>
                    </div>
                    {brief.riskFlags.length > 0 && (
                      <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-soft)' }}>
                        <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                        <div>
                          <p className="text-[10px] font-bold mb-1 tracking-wider" style={{ color: 'var(--danger)' }}>RISKS</p>
                          <ul className="space-y-0.5">
                            {brief.riskFlags.map(flag => <li key={flag} className="text-sm" style={{ color: 'var(--danger-text)' }}>· {flag}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Sparkles className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                      AI analyses this lead&apos;s activities, budget, and WhatsApp history for next steps and risk flags.
                    </p>
                    {briefError && <p className="text-xs text-red-600 mb-3">{briefError}</p>}
                    <button type="button" onClick={generateBrief} disabled={briefLoading}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                      <Sparkles className="h-4 w-4" />{briefLoading ? 'Generating…' : 'Generate Brief'}
                    </button>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              {historyActivities.length > 0 ? (
                <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>Timeline</p>
                  <div className="space-y-0">
                    {historyActivities.map((a, i) => (
                      <TimelineEntry key={a.id} activity={a} isLast={i === historyActivities.length - 1} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <StickyNote className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No activity yet. Log a call, note, or meeting above.</p>
                </div>
              )}
            </div>
          )}{/* end activity tab */}

          {/* ── FOLLOW-UPS ────────────────────────────────────────── */}
          {activeTab === 'followups' && (
            <div className="space-y-3">
              {!tabLoaded.has('followups') ? (
                <div className="text-center py-10">
                  <div className="skeleton h-16 w-full rounded-xl mb-2" />
                  <div className="skeleton h-16 w-full rounded-xl" />
                </div>
              ) : followUpsData.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <BellRing className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>No follow-ups recorded yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Schedule a follow-up from the Overview tab</p>
                </div>
              ) : (
                followUpsData.map(fu => (
                  <div key={fu.id} className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: fu.completedAt ? 'var(--success-soft)' : 'var(--accent-soft)' }}>
                      {fu.completedAt
                        ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                        : <Calendar className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {fu.followUpDate && (
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                            {fmtFollowUpDate(fu.followUpDate)}
                          </span>
                        )}
                        {fu.followUpType && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                            {fu.followUpType}
                          </span>
                        )}
                        {fu.completedAt && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                            Done
                          </span>
                        )}
                      </div>
                      {fu.comments && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{fu.comments}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Stage: {fu.stage} · {fmtDate(fu.createdAt)}
                        {fu.createdByName ? ` · ${fu.createdByName}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}{/* end followups tab */}

          {/* ── SITE VISITS ───────────────────────────────────────── */}
          {activeTab === 'sitevisits' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {siteVisitsData.length} Visit{siteVisitsData.length !== 1 ? 's' : ''}
                </p>
                <button type="button" onClick={() => setShowSiteVisitModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Plus className="h-3.5 w-3.5" /> Schedule Visit
                </button>
              </div>

              {siteVisitsData.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <Home className="h-9 w-9 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>No site visits yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Schedule a site visit to see the project location</p>
                </div>
              ) : (
                siteVisitsData.map(sv => (
                  <div key={sv.id} className="rounded-xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: sv.completedAt ? 'var(--success-soft)' : 'var(--accent-soft)' }}>
                        <Home className="h-4 w-4" style={{ color: sv.completedAt ? 'var(--success)' : 'var(--accent-base)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                            {fmtDate(sv.scheduledAt)}
                          </span>
                          {sv.completedAt ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                              Completed
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                              Scheduled
                            </span>
                          )}
                        </div>
                        {sv.locationJson?.address && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sv.locationJson.address}</p>
                        )}
                        {sv.notes && (
                          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{sv.notes}</p>
                        )}
                        {sv.photos.length > 0 && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sv.photos.length} photo{sv.photos.length !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}{/* end sitevisits tab */}

          {/* ── MEASUREMENTS ──────────────────────────────────────── */}
          {activeTab === 'measurements' && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <MeasurementsTabContent
                leadId={id}
                initialRounds={measurementsData}
                onRoundAdded={round => setMeasurementsData(prev => [...prev, round])}
              />
            </div>
          )}{/* end measurements tab */}

          {/* ── QUOTATIONS ────────────────────────────────────────── */}
          {activeTab === 'quotations' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: leadQuotes.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Quotations{leadQuotes.length > 0 ? ` (${leadQuotes.length})` : ''}
                </p>
                <button type="button" onClick={createQuote} disabled={creatingQuote}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Plus className="h-3.5 w-3.5" />{creatingQuote ? 'Creating…' : 'New Quotation'}
                </button>
              </div>
              {leadQuotes.length > 0 ? (
                <div className="px-5 py-4 space-y-2">
                  {leadQuotes.map(q => {
                    const qStatusStyle =
                      q.status === 'approved' || q.status === 'accepted'
                        ? { bg: 'var(--success-soft)', color: 'var(--success-text)' }
                        : q.status === 'sent'
                        ? { bg: 'var(--accent-soft)', color: 'var(--accent-text)' }
                        : q.status === 'rejected'
                        ? { bg: 'var(--danger-soft)', color: 'var(--danger)' }
                        : { bg: 'var(--surface-card)', color: 'var(--text-secondary)' };
                    return (
                      <Link key={q.id} href={`/quotes/${q.id}`}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>
                              QUO-{q.id.slice(-6).toUpperCase()} v{q.version}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: qStatusStyle.bg, color: qStatusStyle.color }}>
                              {q.status.toUpperCase()}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(q.createdAt)}</span>
                          </div>
                          {q.totalPaise > 0 && (
                            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-gold)' }}>{fmt(q.totalPaise)}</p>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <FileText className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No quotations yet</p>
                  <button type="button" onClick={createQuote} disabled={creatingQuote}
                    className="text-xs font-medium hover:underline disabled:opacity-50"
                    style={{ color: 'var(--violet-primary)' }}>
                    {creatingQuote ? 'Creating…' : 'Create first quotation →'}
                  </button>
                </div>
              )}
            </div>
          )}{/* end quotations tab */}

          {/* ── DOCUMENTS ─────────────────────────────────────────── */}
          {activeTab === 'documents' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Documents{leadDocs.length > 0 ? ` (${leadDocs.length})` : ''}
                </p>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Upload className="h-3.5 w-3.5" />{uploadingDoc ? 'Uploading…' : 'Upload'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(f); }} />
              {leadDocs.length > 0 ? (
                <div className="px-5 py-4 space-y-2">
                  {leadDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                      <FileText className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{doc.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB · ` : ''}
                          {fmtDate(doc.createdAt)}
                        </p>
                      </div>
                      {doc.downloadUrl && (
                        <a href={doc.downloadUrl} target="_blank" rel="noreferrer"
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--surface-muted)]">
                          <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <Upload className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload floor plans, mood boards, site photos, or any project document.</p>
                </div>
              )}
            </div>
          )}{/* end documents tab */}

        </div>{/* end space-y-4 */}
      </div>{/* end px-4 */}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg whitespace-nowrap"
          style={{ background: '#059669', color: '#fff' }}>
          {toast}
        </div>
      )}

      {/* Mobile floating bar */}
      <div className="lg:hidden floating-action-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 gap-2"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-blue-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-600">Call</span>
        </a>
        <a href={`https://wa.me/91${waPhone}`} target="_blank" rel="noreferrer"
          className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-green-50">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <span className="text-[10px] font-medium text-green-600">WhatsApp</span>
        </a>
        <button type="button" onClick={scrollToFollowUp} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-amber-50">
          <Calendar className="h-5 w-5 text-amber-600" />
          <span className="text-[10px] font-medium text-amber-600">Follow-up</span>
        </button>
        <button type="button" onClick={() => setShowEditDialog(true)} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-violet-50">
          <Edit2 className="h-5 w-5" style={{ color: 'var(--violet-primary)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--violet-primary)' }}>Edit</span>
        </button>
        {linkedProject ? (
          <Link href={`/projects/${linkedProject.id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Project</span>
          </Link>
        ) : isWon ? (
          <Link href={`/projects?leadId=${id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Convert</span>
          </Link>
        ) : nextStageAction ? (
          <button type="button"
            onClick={() => nextStageAction.terminal ? setShowWonFlowModal(true) : advanceStage(nextStageAction.targetStage)}
            disabled={stageActionsDisabled}
            className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--violet-primary)' }}>
            <ArrowRight className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Advance</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ opacity: 0.35 }}>
            <FolderKanban className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Convert</span>
          </div>
        )}
      </div>

    </div>
  );
}
