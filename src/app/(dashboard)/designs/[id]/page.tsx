'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, ExternalLink, FileText, Plus, Send, X,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type DeliverableType =
  | 'mood_board'
  | '2d_layout'
  | '3d_render'
  | 'working_drawing'
  | 'material_board';

type DeliverableStatus = 'draft' | 'shared' | 'changes_requested' | 'approved';

interface DeliverableVersion {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileType?: string;
  sharedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface DesignDeliverable {
  id: string;
  tenantId: string;
  leadId?: string | null;
  projectId?: string | null;
  type: DeliverableType;
  title: string;
  revisionCap: number;
  status: DeliverableStatus;
  approvedAt?: string | null;
  approvedByClient?: string | null;
  createdAt: string;
  versions: DeliverableVersion[];
}

/* ── Config ────────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<DeliverableType, string> = {
  mood_board:      'Mood Board',
  '2d_layout':     '2D Layout',
  '3d_render':     '3D Render',
  working_drawing: 'Working Drawing',
  material_board:  'Material Board',
};

interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

const STATUS_CONFIG: Record<DeliverableStatus, StatusConfig> = {
  draft:             { label: 'Draft',             bg: 'var(--surface-muted)',  color: 'var(--text-primary)',   dot: 'var(--text-tertiary)' },
  shared:            { label: 'Shared',            bg: '#EFF6FF',               color: '#1D4ED8',               dot: '#3B82F6' },
  changes_requested: { label: 'Changes Requested', bg: '#FFF7ED',               color: '#C2410C',               dot: '#F97316' },
  approved:          { label: 'Approved',          bg: 'var(--success-soft)',   color: 'var(--success-text)',   dot: 'var(--success)' },
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: DeliverableStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
      {message}
    </div>
  );
}

/* ── Approve Dialog ─────────────────────────────────────────────────────────── */

function ApproveDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (clientName: string) => Promise<void>;
}) {
  const [clientName, setClientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit() {
    const name = clientName.trim();
    if (!name) { setError('Client name is required.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(name);
      onClose();
    } catch {
      setError('Failed to approve. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--success-soft)' }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
              Approve Deliverable
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter the client&apos;s name to record who approved this deliverable.
          </p>
          <div>
            <label
              htmlFor="client-name"
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Client Name
            </label>
            <input
              id="client-name"
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Mohammed Sheriff"
              disabled={submitting}
              className="studio-input w-full text-sm"
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
          )}
        </div>

        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary flex-1 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── New Version Dialog ─────────────────────────────────────────────────────── */

function NewVersionDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (fileUrl: string, notes: string) => Promise<void>;
}) {
  const [fileUrl,    setFileUrl]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit() {
    const url = fileUrl.trim();
    if (!url) { setError('File URL is required.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(url, notes.trim());
      onClose();
    } catch {
      setError('Failed to add version. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-soft)' }}
            >
              <Plus className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
              New Version
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label
              htmlFor="file-url"
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              File URL
            </label>
            <input
              id="file-url"
              type="url"
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              disabled={submitting}
              className="studio-input w-full text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="version-notes"
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Notes <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="version-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What changed in this version?"
              disabled={submitting}
              className="studio-input w-full text-sm resize-none"
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
          )}
        </div>

        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary flex-1 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {submitting ? 'Adding…' : 'Add Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function DesignDeliverableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [deliverable,        setDeliverable]        = useState<DesignDeliverable | null>(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [sharing,            setSharing]            = useState(false);
  const [showApproveDialog,  setShowApproveDialog]  = useState(false);
  const [showVersionDialog,  setShowVersionDialog]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/design-deliverables/${id}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: DesignDeliverable }>;
      })
      .then(body => { setDeliverable(body.data); })
      .catch(() => { setError('Failed to load deliverable. Please refresh.'); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch(`/api/v1/design-deliverables/${id}/share`, { method: 'POST' });
      if (!res.ok) throw new Error();
      load();
    } catch {
      // silently ignore — user can retry
    } finally {
      setSharing(false);
    }
  }

  async function handleApprove(clientName: string) {
    const res = await fetch(`/api/v1/design-deliverables/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName }),
    });
    if (!res.ok) throw new Error('Approve failed');
    load();
  }

  async function handleAddVersion(fileUrl: string, notes: string) {
    const body: { fileUrl: string; notes?: string } = { fileUrl };
    if (notes) body.notes = notes;
    const res = await fetch(`/api/v1/design-deliverables/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Add version failed');
    load();
  }

  /* ── Render: loading ── */
  if (loading) {
    return (
      <div className="p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Loading deliverable…
      </div>
    );
  }

  /* ── Render: error ── */
  if (error || !deliverable) {
    return (
      <div className="p-8 space-y-4">
        <Link
          href="/designs"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to designs
        </Link>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error ?? 'Deliverable not found.'}
        </p>
      </div>
    );
  }

  const { status, versions, leadId, projectId, approvedAt, approvedByClient } = deliverable;
  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const typeLabel      = TYPE_LABELS[deliverable.type] ?? deliverable.type;
  const revisionLabel  = `${typeLabel} · Revision ${versions.length} of ${deliverable.revisionCap}`;

  return (
    <div className="px-6 py-6 space-y-6">

      {/* Back */}
      <Link
        href="/designs"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to designs
      </Link>

      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
            {deliverable.title}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {revisionLabel}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />

          {status === 'draft' && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#3B82F6' }}
            >
              <Send className="h-4 w-4" />
              {sharing ? 'Sharing…' : 'Share to Client'}
            </button>
          )}

          {status === 'shared' && (
            <button
              type="button"
              onClick={() => setShowApproveDialog(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--success)' }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </button>
          )}

          {status === 'changes_requested' && (
            <button
              type="button"
              onClick={() => setShowVersionDialog(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-base)' }}
            >
              <Plus className="h-4 w-4" />
              New Version
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">

        {/* LEFT — Versions + Approval */}
        <div className="space-y-6">

          {/* Versions card */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <h2
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Versions
              </h2>
              <span
                className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
              >
                {versions.length}
              </span>
            </div>

            {sortedVersions.length === 0 ? (
              <EmptyState message="No versions uploaded yet." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {sortedVersions.map((v, index) => (
                  <li key={v.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: index === 0 ? 'var(--accent-soft)' : 'var(--surface-muted)' }}
                      >
                        <FileText
                          className="h-4 w-4"
                          style={{ color: index === 0 ? 'var(--accent-base)' : 'var(--text-tertiary)' }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                          Version {v.versionNumber}
                          {index === 0 && (
                            <span
                              className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}
                            >
                              Latest
                            </span>
                          )}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(v.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {v.sharedAt && (
                            <> · Shared {new Date(v.sharedAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short',
                            })}</>
                          )}
                        </p>
                        {v.notes && (
                          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {v.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <a
                      href={v.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Approval card */}
          <div
            className="rounded-2xl border p-6"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Approval
            </h2>
            {approvedAt && approvedByClient ? (
              <div className="flex items-start gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--success-soft)' }}
                >
                  <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Approved by {approvedByClient}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(approvedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Pending client approval.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Related */}
        <div className="sticky top-6 self-start">
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Related
            </h2>
            {leadId || projectId ? (
              <ul className="space-y-3">
                {leadId && (
                  <li>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Lead</p>
                    <Link
                      href={`/leads/${leadId}`}
                      className="text-sm font-medium transition-colors hover:underline"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      View lead →
                    </Link>
                  </li>
                )}
                {projectId && (
                  <li>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Project</p>
                    <Link
                      href={`/projects/${projectId}`}
                      className="text-sm font-medium transition-colors hover:underline"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      View project →
                    </Link>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No related lead or project.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showApproveDialog && (
        <ApproveDialog
          onClose={() => setShowApproveDialog(false)}
          onSubmit={handleApprove}
        />
      )}

      {showVersionDialog && (
        <NewVersionDialog
          onClose={() => setShowVersionDialog(false)}
          onSubmit={handleAddVersion}
        />
      )}
    </div>
  );
}
