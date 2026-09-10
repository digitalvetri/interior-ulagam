'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, AlertTriangle, X, Users, TrendingUp, Calendar, FileText,
  Image as ImageIcon, ExternalLink, HardHat, Pencil, Trash2,
  ChevronDown, ChevronUp, FileDown, Ruler, CheckCircle2, Clock,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SiteLog {
  id: string;
  projectId: string;
  logDate: string;
  photos: string[];
  voiceNoteUrl: string | null;
  transcript: string | null;
  progressPct: number | null;
  stage: string | null;
  delayFlag: boolean;
  labourCount: number | null;
  blockersJson: unknown;
  source: 'whatsapp' | 'manual';
  createdAt: string;
}

interface SiteProject {
  id: string;
  leadId: string | null;
}

interface MeasurementItem {
  id: string;
  room: string;
  itemName: string;
  qty: number;
  unit: string;
}

interface MeasurementRound {
  id: string;
  leadId: string;
  roundName: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  items?: MeasurementItem[];
}

type LogFormState = {
  logDate: string;
  progressPct: string;
  stage: string;
  labourCount: string;
  delayFlag: boolean;
  transcript: string;
  blockers: string[];
};

/* ── Utilities ─────────────────────────────────────────────────────────────── */

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseBlockers(blockersJson: unknown): string[] {
  if (!blockersJson || !Array.isArray(blockersJson)) return [];
  return blockersJson.filter((b): b is string => typeof b === 'string');
}

function progressColor(pct: number): string {
  if (pct < 40) return 'var(--danger)';
  if (pct < 70) return 'var(--warning)';
  return 'var(--success)';
}

function formatLogDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
}

const EMPTY_FORM: LogFormState = {
  logDate: '',
  progressPct: '',
  stage: '',
  labourCount: '',
  delayFlag: false,
  transcript: '',
  blockers: [],
};

/* ── Progress Chart ─────────────────────────────────────────────────────────── */

interface ChartPoint { date: string; pct: number; }

function ProgressChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null;
  const W = 600, H = 80, PAD = 8;
  const minTs = new Date(points[0].date).getTime();
  const maxTs = new Date(points[points.length - 1].date).getTime();
  const tsRange = maxTs - minTs || 1;

  const toX = (d: string) => PAD + ((new Date(d).getTime() - minTs) / tsRange) * (W - PAD * 2);
  const toY = (p: number) => H - PAD - (p / 100) * (H - PAD * 2);

  const polyline = points.map(p => `${toX(p.date)},${toY(p.pct)}`).join(' ');
  const areaPath = [
    `M ${toX(points[0].date)} ${H - PAD}`,
    ...points.map(p => `L ${toX(p.date)} ${toY(p.pct)}`),
    `L ${toX(points[points.length - 1].date)} ${H - PAD}`,
    'Z',
  ].join(' ');

  const labelPoints = points.length <= 5
    ? points
    : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
        <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
        Progress Timeline
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        <path d={areaPath} fill="var(--accent-base)" fillOpacity={0.08} />
        <polyline points={polyline} fill="none" stroke="var(--accent-base)"
          strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.date)} cy={toY(p.pct)} r={3}
            fill="var(--surface-card)" stroke="var(--accent-base)" strokeWidth={2} />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        {labelPoints.map((p, i) => <span key={i}>{formatShortDate(p.date)}</span>)}
      </div>
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, valueColor, danger }: {
  label: string; value: string; sub?: string; valueColor?: string; danger?: boolean;
}) {
  return (
    <div className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: danger ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)' }}>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: valueColor ?? (danger ? 'var(--danger)' : 'var(--text-heading)') }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  );
}

/* ── Shared Modal Shell ─────────────────────────────────────────────────────── */

function ModalShell({ title, onClose, icon, children }: {
  title: string; onClose: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-soft)' }}>
              {icon}
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{title}</h2>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSubmit, submitting, submitLabel }: {
  onClose: () => void; onSubmit: () => void; submitting: boolean; submitLabel: string;
}) {
  return (
    <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
      <button type="button" onClick={onSubmit} disabled={submitting}
        className="btn-primary flex-1 py-2.5 text-sm">
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{message}
    </div>
  );
}

/* ── Log Form Fields (shared by Add + Edit modals) ──────────────────────────── */

function LogFormFields({ form, setField, blockersInput, setBlockersInput, onAddBlocker, onRemoveBlocker }: {
  form: LogFormState;
  setField: <K extends keyof LogFormState>(k: K, v: LogFormState[K]) => void;
  blockersInput: string;
  setBlockersInput: (v: string) => void;
  onAddBlocker: () => void;
  onRemoveBlocker: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="studio-label block mb-1.5">Log Date *</label>
          <input type="date" value={form.logDate}
            onChange={e => setField('logDate', e.target.value)}
            className="studio-input w-full text-sm" />
        </div>
        <div>
          <label className="studio-label block mb-1.5">
            Progress % <span style={{ color: 'var(--text-tertiary)' }}>(0–100)</span>
          </label>
          <input type="number" min={0} max={100} placeholder="e.g. 65" value={form.progressPct}
            onChange={e => setField('progressPct', e.target.value)}
            className="studio-input w-full text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="studio-label block mb-1.5">Stage / Work Type</label>
          <input type="text" placeholder="e.g. False ceiling" value={form.stage}
            onChange={e => setField('stage', e.target.value)}
            className="studio-input w-full text-sm" />
        </div>
        <div>
          <label className="studio-label block mb-1.5">Labour Count</label>
          <input type="number" min={0} placeholder="e.g. 8" value={form.labourCount}
            onChange={e => setField('labourCount', e.target.value)}
            className="studio-input w-full text-sm" />
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer px-1">
        <div
          className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer"
          style={{ background: form.delayFlag ? 'var(--danger)' : 'var(--border-strong)' }}
          onClick={() => setField('delayFlag', !form.delayFlag)}
        >
          <div className="absolute top-1 w-4 h-4 rounded-full transition-all"
            style={{ left: form.delayFlag ? 22 : 4, background: 'var(--surface-card)' }} />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-heading)' }}>Flag as delayed</span>
      </label>
      <div>
        <label className="studio-label block mb-1.5">Notes / Observations</label>
        <textarea value={form.transcript}
          onChange={e => setField('transcript', e.target.value)}
          rows={3} placeholder="Progress observations, work done today…"
          className="studio-input w-full text-sm resize-none" />
      </div>
      <div>
        <label className="studio-label block mb-1.5">Blockers</label>
        <div className="flex gap-2">
          <input type="text" placeholder="e.g. Material delivery delayed" value={blockersInput}
            onChange={e => setBlockersInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddBlocker(); } }}
            className="studio-input flex-1 text-sm" />
          <button type="button" onClick={onAddBlocker}
            className="rounded-lg border px-3 text-sm transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>
            Add
          </button>
        </div>
        {form.blockers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.blockers.map((b, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
                {b}
                <button type="button" onClick={() => onRemoveBlocker(i)} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Add Log Modal ──────────────────────────────────────────────────────────── */

function AddLogModal({ projectId, onClose, onSuccess }: {
  projectId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm]        = useState<LogFormState>({ ...EMPTY_FORM, logDate: getTodayString() });
  const [blockersInput, setBI] = useState('');
  const [submitting, setSub]   = useState(false);
  const [error, setError]      = useState<string | null>(null);

  function setField<K extends keyof LogFormState>(k: K, v: LogFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function addBlocker() {
    const val = blockersInput.trim(); if (!val) return;
    setField('blockers', [...form.blockers, val]); setBI('');
  }
  function removeBlocker(i: number) {
    setField('blockers', form.blockers.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.logDate) { setError('Log date is required'); return; }
    const progressPct = form.progressPct !== '' ? Number(form.progressPct) : undefined;
    const labourCount = form.labourCount !== '' ? Number(form.labourCount) : undefined;
    const payload: Record<string, unknown> = { logDate: form.logDate, source: 'manual', delayFlag: form.delayFlag };
    if (progressPct !== undefined && !Number.isNaN(progressPct)) payload.progressPct = progressPct;
    if (form.stage.trim()) payload.stage = form.stage.trim();
    if (labourCount !== undefined && !Number.isNaN(labourCount)) payload.labourCount = labourCount;
    if (form.transcript.trim()) payload.transcript = form.transcript.trim();
    if (form.blockers.length > 0) payload.blockersJson = form.blockers;
    setSub(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const b = await res.json() as { error?: string }; setError(b.error ?? 'Failed to save'); return; }
      onSuccess(); onClose();
    } catch { setError('Network error — please try again'); }
    finally { setSub(false); }
  }

  return (
    <ModalShell title="Add Log Entry" onClose={onClose}
      icon={<HardHat className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />}>
      <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
        <LogFormFields form={form} setField={setField} blockersInput={blockersInput}
          setBlockersInput={setBI} onAddBlocker={addBlocker} onRemoveBlocker={removeBlocker} />
        {error && <ErrorBanner message={error} />}
      </div>
      <ModalFooter onClose={onClose} onSubmit={handleSubmit} submitting={submitting} submitLabel="Save Log" />
    </ModalShell>
  );
}

/* ── Edit Log Modal ─────────────────────────────────────────────────────────── */

function EditLogModal({ log, onClose, onSuccess }: {
  log: SiteLog; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState<LogFormState>({
    logDate:    log.logDate,
    progressPct: log.progressPct !== null ? String(log.progressPct) : '',
    stage:       log.stage ?? '',
    labourCount: log.labourCount !== null ? String(log.labourCount) : '',
    delayFlag:   log.delayFlag,
    transcript:  log.transcript ?? '',
    blockers:    parseBlockers(log.blockersJson),
  });
  const [blockersInput, setBI] = useState('');
  const [submitting, setSub]   = useState(false);
  const [error, setError]      = useState<string | null>(null);

  function setField<K extends keyof LogFormState>(k: K, v: LogFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function addBlocker() {
    const val = blockersInput.trim(); if (!val) return;
    setField('blockers', [...form.blockers, val]); setBI('');
  }
  function removeBlocker(i: number) {
    setField('blockers', form.blockers.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.logDate) { setError('Log date is required'); return; }
    const progressPct = form.progressPct !== '' ? Number(form.progressPct) : null;
    const labourCount = form.labourCount !== '' ? Number(form.labourCount) : null;
    const payload: Record<string, unknown> = {
      logDate:      form.logDate,
      delayFlag:    form.delayFlag,
      stage:        form.stage.trim() || null,
      transcript:   form.transcript.trim() || null,
      blockersJson: form.blockers.length > 0 ? form.blockers : null,
      progressPct:  (progressPct !== null && !Number.isNaN(progressPct)) ? progressPct : null,
      labourCount:  (labourCount !== null && !Number.isNaN(labourCount)) ? labourCount : null,
    };
    setSub(true);
    try {
      const res = await fetch(`/api/v1/site-logs/${log.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const b = await res.json() as { error?: string }; setError(b.error ?? 'Failed to update'); return; }
      onSuccess(); onClose();
    } catch { setError('Network error — please try again'); }
    finally { setSub(false); }
  }

  return (
    <ModalShell title="Edit Log Entry" onClose={onClose}
      icon={<Pencil className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />}>
      <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
        <LogFormFields form={form} setField={setField} blockersInput={blockersInput}
          setBlockersInput={setBI} onAddBlocker={addBlocker} onRemoveBlocker={removeBlocker} />
        {error && <ErrorBanner message={error} />}
      </div>
      <ModalFooter onClose={onClose} onSubmit={handleSubmit} submitting={submitting} submitLabel="Update Log" />
    </ModalShell>
  );
}

/* ── Log Card ───────────────────────────────────────────────────────────────── */

function LogCard({ log, onEdit, onDelete, confirmingDelete, onConfirmDelete, onCancelDelete }: {
  log: SiteLog;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const blockers = parseBlockers(log.blockersJson);
  const LIMIT = 200;

  return (
    <div
      className="rounded-2xl border transition-all hover:shadow-sm"
      style={{
        background: 'var(--surface-card)',
        borderColor: log.delayFlag ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)',
        borderLeftWidth: 4,
        borderLeftColor: log.delayFlag
          ? 'var(--danger)'
          : log.progressPct !== null
            ? progressColor(log.progressPct)
            : 'var(--border-strong)',
      }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-muted)' }}>
              <Calendar className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>
                {formatLogDate(log.logDate)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {log.source === 'whatsapp' ? 'via WhatsApp' : 'Manual entry'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {log.delayFlag && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                <AlertTriangle className="h-3 w-3" />Delay Flagged
              </span>
            )}
            {log.stage && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                {log.stage}
              </span>
            )}
            <Link href={`/site-logs/${log.id}`}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-base)', background: 'var(--accent-soft)' }}>
              Details
            </Link>
            <button type="button" onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>
              <Pencil className="h-3 w-3" />Edit
            </button>
            <button type="button" onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ borderColor: 'rgba(239,68,68,0.2)', color: 'var(--danger)', background: 'var(--danger-soft)' }}>
              <Trash2 className="h-3 w-3" />Delete
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {log.progressPct !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />Progress
              </span>
              <span className="font-semibold" style={{ color: progressColor(log.progressPct) }}>
                {log.progressPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: 'var(--surface-muted)' }}>
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${log.progressPct}%`, background: progressColor(log.progressPct) }} />
            </div>
          </div>
        )}

        {/* Labour count */}
        {log.labourCount !== null && (
          <div className="mb-3 flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Users className="h-3.5 w-3.5" />
            <span>{log.labourCount} workers on site</span>
          </div>
        )}

        {/* Transcript */}
        {log.transcript && (
          <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface-muted)' }}>
            <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <FileText className="h-3 w-3" />Notes
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)' }}>
              {expanded || log.transcript.length <= LIMIT
                ? log.transcript
                : log.transcript.slice(0, LIMIT) + '…'}
            </p>
            {log.transcript.length > LIMIT && (
              <button type="button" onClick={() => setExpanded(!expanded)}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent-base)' }}>
                {expanded
                  ? <><ChevronUp className="h-3 w-3" />Show less</>
                  : <><ChevronDown className="h-3 w-3" />Read more</>}
              </button>
            )}
          </div>
        )}

        {/* Blockers */}
        {blockers.length > 0 && (
          <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--danger-soft)' }}>
            <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--danger)' }}>
              <AlertTriangle className="h-3 w-3" />Blockers ({blockers.length})
            </p>
            <ul className="space-y-1">
              {blockers.map((b, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--danger-text)' }}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--danger)' }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Photos */}
        {(log.photos ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {(log.photos ?? []).slice(0, 4).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="group relative h-16 w-16 rounded-xl overflow-hidden border"
                style={{ borderColor: 'var(--border-strong)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Site photo ${i + 1}`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                  <ExternalLink className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
            {(log.photos ?? []).length > 4 && (
              <div className="h-16 w-16 rounded-xl flex flex-col items-center justify-center text-xs font-medium"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                <ImageIcon className="h-4 w-4 mb-0.5" />+{(log.photos ?? []).length - 4}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation row */}
      {confirmingDelete && (
        <div className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--danger-soft)', background: 'var(--danger-soft)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
            Delete this log entry? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancelDelete}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
              Cancel
            </button>
            <button type="button" onClick={onConfirmDelete}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--danger)', color: '#fff' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Measurement Records Section ────────────────────────────────────────────── */

function MeasurementSection({ leadId }: { leadId: string }) {
  const [rounds, setRounds]         = useState<MeasurementRound[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generatingId, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/leads/${leadId}/measurements`)
      .then(r => r.json())
      .then(({ data }: { data: MeasurementRound[] }) => { setRounds(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [leadId]);

  async function downloadPdf(roundId: string) {
    setGenerating(roundId);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements/${roundId}/pdf`, { method: 'POST' });
      const body = await res.json() as { data?: { pdfUrl: string } };
      if (body.data?.pdfUrl) window.open(body.data.pdfUrl, '_blank');
    } catch { /* silent — user can retry */ }
    finally { setGenerating(null); }
  }

  function getRoundSummary(round: MeasurementRound): string {
    const items = round.items ?? [];
    if (items.length === 0) return '0 items';
    const rooms = new Set(items.map(i => i.room)).size;
    return `${items.length} item${items.length !== 1 ? 's' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}`;
  }

  if (loading) {
    return (
      <div>
        <div className="h-4 w-40 rounded animate-pulse mb-4" style={{ background: 'var(--surface-muted)' }} />
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse mb-2" style={{ background: 'var(--surface-muted)' }} />
        ))}
      </div>
    );
  }

  if (rounds.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
          <Ruler className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          Measurement Records
        </h2>
        <Link href={`/leads/${leadId}/site-visit`}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-base)' }}>
          Open in Lead →
        </Link>
      </div>
      <div className="space-y-2">
        {rounds.map(round => (
          <div key={round.id}
            className="rounded-xl border p-4 flex items-center justify-between gap-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-soft)' }}>
                <Ruler className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>
                  {round.roundName}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {getRoundSummary(round)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {round.completedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--success-text)' }}>
                  <CheckCircle2 className="h-3.5 w-3.5" />Done
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--warning-text)' }}>
                  <Clock className="h-3.5 w-3.5" />Pending
                </span>
              )}
              <button type="button" onClick={() => downloadPdf(round.id)}
                disabled={generatingId === round.id}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>
                <FileDown className="h-3.5 w-3.5" />
                {generatingId === round.id ? 'Generating…' : 'PDF'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'var(--accent-soft)' }}>
          <HardHat className="h-10 w-10" style={{ color: 'var(--accent-base)' }} />
        </div>
        <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--success-soft)', border: '2px solid var(--surface-card)' }}>
          <Plus className="h-4 w-4" style={{ color: 'var(--success)' }} />
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No site logs yet</h3>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          Site supervisors can send daily updates via WhatsApp, or you can add manual entries here.
        </p>
      </div>
      <button type="button" onClick={onAdd}
        className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
        <Plus className="h-4 w-4" />Add First Log Entry
      </button>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [project,    setProject]   = useState<SiteProject | null>(null);
  const [logs,       setLogs]      = useState<SiteLog[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [showAdd,    setShowAdd]   = useState(false);
  const [editingLog, setEditingLog] = useState<SiteLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters (client-side; API already loaded all logs)
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [delayOnly,    setDelayOnly]    = useState(false);
  const [stageFilter,  setStageFilter]  = useState('');

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}`)
      .then(r => r.json())
      .then(({ data }: { data: SiteProject }) => setProject(data ?? null))
      .catch(() => null);
  }, [projectId]);

  const loadLogs = useCallback(() => {
    fetch(`/api/v1/projects/${projectId}/site-logs`)
      .then(r => r.json())
      .then(({ data }: { data: SiteLog[] }) => { setLogs(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleDelete() {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/v1/site-logs/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== deletingId));
        setDeletingId(null);
      }
    } catch { /* leave confirm open so user can retry */ }
  }

  function clearFilters() {
    setFilterFrom(''); setFilterTo(''); setDelayOnly(false); setStageFilter('');
  }

  // Derived
  const filteredLogs = logs.filter(log => {
    if (filterFrom   && log.logDate < filterFrom)    return false;
    if (filterTo     && log.logDate > filterTo)      return false;
    if (delayOnly    && !log.delayFlag)              return false;
    if (stageFilter  && log.stage !== stageFilter)   return false;
    return true;
  });

  const uniqueStages = [...new Set(
    logs.map(l => l.stage).filter((s): s is string => !!s),
  )];

  const chartPoints = [...filteredLogs]
    .filter(l => l.progressPct !== null)
    .reverse()
    .map(l => ({ date: l.logDate, pct: l.progressPct as number }));

  const latestPct  = filteredLogs.find(l => l.progressPct !== null)?.progressPct ?? null;
  const delayCount = filteredLogs.filter(l => l.delayFlag).length;
  const labourDays = logs.reduce((s, l) => s + (l.labourCount ?? 0), 0);
  const hasFilter  = !!(filterFrom || filterTo || delayOnly || stageFilter);

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Site Execution Log</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Daily progress from site supervisors and manual entries
          </p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl flex-shrink-0">
          <Plus className="h-4 w-4" />Add Log Entry
        </button>
      </div>

      {/* KPI strip */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Latest Progress"
            value={latestPct !== null ? `${latestPct}%` : '—'}
            sub={latestPct !== null ? undefined : 'Not logged yet'}
            valueColor={latestPct !== null ? progressColor(latestPct) : undefined}
          />
          <KpiCard
            label="Total Entries"
            value={String(logs.length)}
            sub={`${logs.filter(l => l.source === 'whatsapp').length} via WhatsApp`}
          />
          <KpiCard
            label="Labour Days"
            value={String(labourDays)}
            sub="worker-days logged"
          />
          <KpiCard
            label="Delay Flags"
            value={String(delayCount)}
            sub={`of ${logs.length} entries`}
            danger={delayCount > 0}
          />
        </div>
      )}

      {/* Progress chart */}
      {!loading && chartPoints.length >= 2 && (
        <ProgressChart points={chartPoints} />
      )}

      {/* Filter bar */}
      {!loading && logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Filter:</span>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            title="From date" className="studio-input text-xs py-1.5 px-2.5 rounded-lg"
            style={{ maxWidth: 140 }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            title="To date" className="studio-input text-xs py-1.5 px-2.5 rounded-lg"
            style={{ maxWidth: 140 }} />
          {uniqueStages.length > 0 && (
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="studio-input text-xs py-1.5 px-2.5 rounded-lg" style={{ maxWidth: 160 }}>
              <option value="">All stages</option>
              {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium select-none"
            style={{ color: delayOnly ? 'var(--danger)' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={delayOnly} onChange={e => setDelayOnly(e.target.checked)}
              className="rounded" />
            Delays only
          </label>
          {hasFilter && (
            <button type="button" onClick={clearFilters}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent-base)' }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl animate-pulse"
              style={{ background: 'var(--surface-muted)' }} />
          ))}
        </div>

      ) : logs.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />

      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Calendar className="h-10 w-10" style={{ color: 'var(--border-strong)' }} />
          <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>
            No logs match these filters
          </p>
          <button type="button" onClick={clearFilters}
            className="text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
            Clear filters
          </button>
        </div>

      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => (
            <LogCard
              key={log.id}
              log={log}
              onEdit={() => setEditingLog(log)}
              onDelete={() => setDeletingId(prev => prev === log.id ? null : log.id)}
              confirmingDelete={deletingId === log.id}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setDeletingId(null)}
            />
          ))}
        </div>
      )}

      {/* Measurement records (if project came from a lead) */}
      {project?.leadId && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <MeasurementSection leadId={project.leadId} />
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddLogModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onSuccess={loadLogs}
        />
      )}
      {editingLog && (
        <EditLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSuccess={() => { loadLogs(); setEditingLog(null); }}
        />
      )}
    </div>
  );
}
