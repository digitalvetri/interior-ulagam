'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, FolderOpen, CheckCircle2, AlertTriangle, X,
  ExternalLink, } from 'lucide-react';
import { Deliverable, DeliverableStatus, DeliverableType } from '@/types/deliverables';
import { StatusBadge } from '@/components/ui/StatusBadge';

/* ── Config ────────────────────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<DeliverableType, { label: string; emoji: string; bg: string; color: string }> = {
  '2d_plan':        { label: '2D Plan',           emoji: '📐', bg: 'var(--accent-soft)', color: 'var(--accent-text)' },
  '3d_render':      { label: '3D Render',          emoji: '🏠', bg: 'var(--accent-soft)', color: '#6B21A8' },
  color_palette:    { label: 'Color Palette',      emoji: '🎨', bg: '#FDF2F8', color: '#BE185D' },
  working_drawings: { label: 'Working Drawings',   emoji: '📏', bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
  bom:              { label: 'Bill of Materials',  emoji: '📋', bg: 'var(--success-soft)', color: 'var(--success-text)' },
};

const STATUS_CONFIG: Record<DeliverableStatus, { label: string; bg: string; color: string; dot: string }> = {
  pending:     { label: 'Pending',     bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
  in_progress: { label: 'In Progress', bg: 'var(--accent-soft)', color: 'var(--accent-text)', dot: 'var(--accent-base)' },
  in_review:   { label: 'In Review',   bg: 'var(--warning-soft)', color: 'var(--warning-text)', dot: 'var(--warning)' },
  approved:    { label: 'Approved',    bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
  rejected:    { label: 'Rejected',    bg: 'var(--danger-soft)', color: 'var(--danger)', dot: 'var(--danger)' },
};

const ALL_TYPES: DeliverableType[]   = ['2d_plan', '3d_render', 'color_palette', 'working_drawings', 'bom'];
const ALL_STATUSES: DeliverableStatus[] = ['pending', 'in_progress', 'in_review', 'approved', 'rejected'];

/* ── Helpers ───────────────────────────────────────────────────────────────── */


/* ── Deliverable Card ──────────────────────────────────────────────────────── */

function DeliverableCard({
  deliverable: d, changeOrderIds, onStatusChange, onApprove,
}: {
  deliverable: Deliverable;
  changeOrderIds: Set<string>;
  onStatusChange: (id: string, status: DeliverableStatus) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
}) {
  const [saving,    setSaving]    = useState(false);
  const [approving, setApproving] = useState(false);

  const overCap = d.revisionCount > d.revisionCap;
  const showWarning = changeOrderIds.has(d.id) || overCap;
  const revPct = d.revisionCap > 0
    ? Math.min(100, Math.round((d.revisionCount / d.revisionCap) * 100))
    : 0;
  const typeCfg = TYPE_CONFIG[d.type];

  async function handleStatus(val: string) {
    setSaving(true);
    await onStatusChange(d.id, val as DeliverableStatus);
    setSaving(false);
  }

  async function handleApprove() {
    setApproving(true);
    await onApprove(d.id);
    setApproving(false);
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4 transition-all hover:shadow-md"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

      {/* Top: icon + title + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: typeCfg.bg }}>
            {typeCfg.emoji}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{typeCfg.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {d.approvedAt
                ? `Approved ${new Date(d.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                : 'Not approved yet'}
            </p>
          </div>
        </div>
        <StatusBadge module="deliverables" status={d.status} />
      </div>

      {/* Change-order warning */}
      {showWarning && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-soft)', color: 'var(--warning-text)' }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          Revision cap exceeded — a change-order quote is required.
        </div>
      )}

      {/* Revision meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--text-secondary)' }}>Revisions</span>
          <span className="font-semibold" style={{ color: overCap ? 'var(--danger)' : 'var(--text-heading)' }}>
            {d.revisionCount} / {d.revisionCap}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--border-subtle)' }}>
          <div className="h-1.5 rounded-full transition-all"
            style={{
              width: `${revPct}%`,
              background: overCap ? 'var(--danger)' : revPct > 75 ? 'var(--warning)' : 'var(--accent-base)',
            }} />
        </div>
      </div>

      {/* File link */}
      {d.latestFileUrl && (
        <a href={d.latestFileUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
          style={{ color: 'var(--accent-base)' }}>
          <ExternalLink className="h-3.5 w-3.5" />
          View latest file
        </a>
      )}

      {/* Status update select */}
      <div>
        <label className="studio-label block mb-1.5 text-xs">Update Status</label>
        <select value={d.status} onChange={e => handleStatus(e.target.value)} disabled={saving}
          className="studio-input w-full text-xs py-1.5">
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Approve button */}
      {d.status !== 'approved' && (
        <button type="button" onClick={handleApprove} disabled={approving}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all"
          style={{
            background: approving ? 'var(--success-soft)' : 'var(--success)',
            color: approving ? 'var(--success-text)' : 'var(--surface-card)',
            border: '1px solid var(--success)',
          }}>
          <CheckCircle2 className="h-4 w-4" />
          {approving ? 'Approving…' : 'Mark Approved'}
        </button>
      )}

      {d.status === 'approved' && (
        <div className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium"
          style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
          <CheckCircle2 className="h-4 w-4" />
          Approved
        </div>
      )}
    </div>
  );
}

/* ── Add Deliverable Modal ─────────────────────────────────────────────────── */

function AddDeliverableModal({
  projectId, onClose, onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (d: Deliverable) => void;
}) {
  const [type,        setType]        = useState<DeliverableType>('2d_plan');
  const [revisionCap, setRevisionCap] = useState('2');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const cap = parseInt(revisionCap, 10);
    if (isNaN(cap) || cap < 0) { setError('Revision cap must be 0 or more'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/deliverables`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, revisionCap: cap }),
      });
      const body = await res.json() as { data?: Deliverable; error?: string };
      if (!res.ok) { setError(body.error ?? 'Failed to add deliverable'); return; }
      onCreated(body.data!);
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  const typeCfg = TYPE_CONFIG[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--accent-soft)' }}>📁</div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Add Deliverable</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="studio-label block mb-1.5">Type</label>
            <select value={type} onChange={e => setType(e.target.value as DeliverableType)}
              className="studio-input w-full text-sm">
              {ALL_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_CONFIG[t].emoji} {TYPE_CONFIG[t].label}</option>
              ))}
            </select>
            {/* Preview of selected type */}
            <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: typeCfg.bg }}>
              <span className="text-lg">{typeCfg.emoji}</span>
              <span className="text-xs font-medium" style={{ color: typeCfg.color }}>{typeCfg.label}</span>
            </div>
          </div>
          <div>
            <label className="studio-label block mb-1.5">Revision Cap</label>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => setRevisionCap(v => String(Math.max(0, Number(v) - 1)))}
                className="h-9 w-9 rounded-xl border flex items-center justify-center text-lg font-medium transition-colors hover:bg-[var(--border-subtle)]"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>−</button>
              <input type="number" min={0} step={1} value={revisionCap}
                onChange={e => setRevisionCap(e.target.value)}
                className="studio-input flex-1 text-sm text-center" />
              <button type="button"
                onClick={() => setRevisionCap(v => String(Number(v) + 1))}
                className="h-9 w-9 rounded-xl border flex items-center justify-center text-lg font-medium transition-colors hover:bg-[var(--border-subtle)]"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>+</button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Extra revisions beyond this cap will trigger a change-order quote.
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            {saving ? 'Adding…' : 'Add Deliverable'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [deliverables,    setDeliverables]    = useState<Deliverable[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [changeOrderIds,  setChangeOrderIds]  = useState<Set<string>>(new Set());
  const [modalOpen,       setModalOpen]       = useState(false);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}/deliverables`)
      .then(r => r.json())
      .then(({ data }: { data: Deliverable[] }) => { setDeliverables(data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function updateDeliverable(updated: Deliverable) {
    setDeliverables(prev => prev.map(d => d.id === updated.id ? updated : d));
  }

  async function handleStatusChange(deliverableId: string, status: DeliverableStatus) {
    const res = await fetch(`/api/v1/deliverables/${deliverableId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await res.json() as { data?: Deliverable; changeOrderNeeded?: boolean };
    if (!res.ok || !body.data) return;
    updateDeliverable(body.data);
    if (body.changeOrderNeeded) setChangeOrderIds(prev => new Set(prev).add(deliverableId));
  }

  async function handleApprove(deliverableId: string) {
    const res = await fetch(`/api/v1/deliverables/${deliverableId}/approve`, { method: 'POST' });
    const body = await res.json() as { data?: Deliverable };
    if (!res.ok || !body.data) return;
    updateDeliverable(body.data);
    setChangeOrderIds(prev => { const next = new Set(prev); next.delete(deliverableId); return next; });
  }

  const approvedCount = deliverables.filter(d => d.status === 'approved').length;

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Deliverables</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {deliverables.length > 0
              ? `${approvedCount} of ${deliverables.length} approved`
              : '2D plans, renders, working drawings & BOMs'}
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl flex-shrink-0">
          <Plus className="h-4 w-4" />Add Deliverable
        </button>
      </div>

      {/* Progress bar (when items exist) */}
      {!loading && deliverables.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span style={{ color: 'var(--text-secondary)' }}>Overall Approval Progress</span>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>
              {approvedCount}/{deliverables.length} approved
            </span>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: 'var(--border-subtle)' }}>
            <div className="h-2 rounded-full transition-all"
              style={{
                width: `${deliverables.length > 0 ? Math.round((approvedCount / deliverables.length) * 100) : 0}%`,
                background: approvedCount === deliverables.length ? 'var(--success)' : 'var(--accent-base)',
              }} />
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
        </div>
      ) : deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}>
            <FolderOpen className="h-10 w-10" style={{ color: 'var(--accent-base)' }} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No deliverables yet</h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              Add 2D plans, 3D renders, color palettes, and working drawings for this project.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
            <Plus className="h-4 w-4" />Add First Deliverable
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map(d => (
            <DeliverableCard key={d.id} deliverable={d} changeOrderIds={changeOrderIds}
              onStatusChange={handleStatusChange} onApprove={handleApprove} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <AddDeliverableModal
          projectId={id}
          onClose={() => setModalOpen(false)}
          onCreated={d => { setDeliverables(prev => [d, ...prev]); setModalOpen(false); }}
        />
      )}
    </div>
  );
}
