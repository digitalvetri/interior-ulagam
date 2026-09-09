'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Palette, Layers, Box, Ruler, Grid2X2 } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

type DeliverableType = 'mood_board' | '2d_layout' | '3d_render' | 'working_drawing' | 'material_board';
type DeliverableStatus = 'draft' | 'shared' | 'changes_requested' | 'approved';

interface DesignDeliverable {
  id: string;
  type: DeliverableType;
  title: string;
  status: DeliverableStatus;
  revisionCap: number;
  approvedAt: string | null;
  createdAt: string;
}

interface DesignDeliverablesTabProps {
  leadId: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<DeliverableType, string> = {
  mood_board:      'Mood Board',
  '2d_layout':     '2D Layout',
  '3d_render':     '3D Render',
  working_drawing: 'Working Drawing',
  material_board:  'Material Board',
};

const TYPE_OPTIONS: DeliverableType[] = [
  'mood_board', '2d_layout', '3d_render', 'working_drawing', 'material_board',
];

function TypeIcon({ type, className }: { type: DeliverableType; className?: string }) {
  const props = { className: className ?? 'h-4 w-4' };
  switch (type) {
    case 'mood_board':      return <Palette {...props} />;
    case '2d_layout':       return <Layers {...props} />;
    case '3d_render':       return <Box {...props} />;
    case 'working_drawing': return <Ruler {...props} />;
    case 'material_board':  return <Grid2X2 {...props} />;
  }
}

function StatusBadge({ status }: { status: DeliverableStatus }) {
  const cfg: Record<DeliverableStatus, { label: string; classes: string }> = {
    draft:             { label: 'Draft',             classes: 'bg-gray-100 text-gray-600' },
    shared:            { label: 'Shared',            classes: 'bg-amber-100 text-amber-700' },
    changes_requested: { label: 'Changes Requested', classes: 'bg-orange-100 text-orange-700' },
    approved:          { label: 'Approved',          classes: 'bg-green-100 text-green-700' },
  };
  const { label, classes } = cfg[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export function DesignDeliverablesTab({ leadId }: DesignDeliverablesTabProps) {
  const [deliverables, setDeliverables] = useState<DesignDeliverable[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showNewForm, setShowNewForm]   = useState(false);

  // New form state
  const [newType, setNewType]           = useState<DeliverableType>('mood_board');
  const [newTitle, setNewTitle]         = useState('');
  const [newRevCap, setNewRevCap]       = useState(3);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  // Per-deliverable action loading
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/design-deliverables?leadId=${leadId}`)
      .then(r => r.json())
      .then((res: { data?: DesignDeliverable[] }) => {
        setDeliverables(res.data ?? []);
      })
      .catch(() => {
        setDeliverables([]);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  function resetForm() {
    setNewType('mood_board');
    setNewTitle('');
    setNewRevCap(3);
    setSaveError(null);
  }

  async function handleSave() {
    if (!newTitle.trim()) { setSaveError('Title is required'); return; }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch('/api/v1/design-deliverables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, type: newType, title: newTitle.trim(), revisionCap: newRevCap }),
      });
      const json = await res.json() as { data?: DesignDeliverable; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setDeliverables(prev => [json.data!, ...prev]);
      resetForm();
      setShowNewForm(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleShare(deliverable: DesignDeliverable) {
    setActionLoadingId(deliverable.id);
    try {
      const res = await fetch(`/api/v1/design-deliverables/${deliverable.id}/share`, { method: 'POST' });
      const json = await res.json() as { data?: DesignDeliverable; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setDeliverables(prev => prev.map(d => d.id === deliverable.id ? { ...d, status: 'shared' } : d));
    } catch {
      // silently ignore — user can retry
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApprove(deliverable: DesignDeliverable) {
    setActionLoadingId(deliverable.id);
    try {
      const res = await fetch(`/api/v1/design-deliverables/${deliverable.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedByClient: 'admin' }),
      });
      const json = await res.json() as { data?: DesignDeliverable; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setDeliverables(prev => prev.map(d =>
        d.id === deliverable.id
          ? { ...d, status: 'approved', approvedAt: new Date().toISOString() }
          : d,
      ));
    } catch {
      // silently ignore
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Design Studio</p>
        <button
          type="button"
          onClick={() => { setShowNewForm(v => !v); resetForm(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--violet-primary)', color: '#fff' }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* New deliverable inline form */}
      {showNewForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Type
              </label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as DeliverableType)}
                className="studio-input w-full text-sm"
              >
                {TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Revision Cap
              </label>
              <input
                type="number"
                value={newRevCap}
                min={1}
                max={10}
                onChange={e => setNewRevCap(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="studio-input w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Title *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Master Bedroom Mood Board v1"
              className="studio-input w-full text-sm"
              autoFocus
            />
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !newTitle.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewForm(false); resetForm(); }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : deliverables.length === 0 && !showNewForm ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <Palette className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No design deliverables yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliverables.map(d => {
            const isActionLoading = actionLoadingId === d.id;
            const canShare   = d.status === 'draft' || d.status === 'changes_requested';
            const canApprove = d.status === 'shared';

            return (
              <div
                key={d.id}
                className="rounded-xl p-4"
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
              >
                {/* Top row: icon + title + badge */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--surface-muted)' }}
                  >
                    <TypeIcon type={d.type} className="h-4 w-4 text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{d.title}</p>
                      <StatusBadge status={d.status} />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {TYPE_LABELS[d.type]} · Revision cap: {d.revisionCap}
                    </p>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <Link
                    href={`/designs/${d.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)', border: '1px solid var(--border-subtle)' }}
                  >
                    Details
                  </Link>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => handleShare(d)}
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border-subtle)' }}
                    >
                      {isActionLoading ? 'Sharing…' : 'Share'}
                    </button>
                  )}
                  {canApprove && (
                    <button
                      type="button"
                      onClick={() => handleApprove(d)}
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'var(--success-soft)', color: 'var(--success-text)', border: '1px solid var(--border-subtle)' }}
                    >
                      {isActionLoading ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
