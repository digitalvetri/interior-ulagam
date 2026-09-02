'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, Plus, AlertTriangle, X, Copy, Check,
  ClipboardList, ExternalLink, PartyPopper, Download,
} from 'lucide-react';
import type { SnagItem, SnagStatus } from '@/types/snag';
import { StatusBadge } from '@/components/ui/StatusBadge';

/* ── Status config ─────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<SnagStatus, { label: string; bg: string; color: string; dot: string }> = {
  open:             { label: 'Open',             bg: 'var(--danger-soft)', color: 'var(--danger)', dot: 'var(--danger)' },
  in_progress:      { label: 'In Progress',      bg: 'var(--warning-soft)', color: 'var(--warning-text)', dot: 'var(--warning)' },
  resolved:         { label: 'Resolved',         bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
  client_confirmed: { label: 'Client Confirmed', bg: 'var(--accent-soft)', color: 'var(--accent-text)', dot: 'var(--accent-base)' },
};

const STATUS_OPTIONS: SnagStatus[] = ['open', 'in_progress', 'resolved', 'client_confirmed'];


/* ── Add Snag Modal ────────────────────────────────────────────────────────── */

interface AddSnagForm { description: string; photoUrl: string; assigneeId: string; }
const INITIAL_FORM: AddSnagForm = { description: '', photoUrl: '', assigneeId: '' };

function AddSnagModal({
  projectId, onClose, onAdd,
}: {
  projectId: string;
  onClose: () => void;
  onAdd: (item: SnagItem) => void;
}) {
  const [form, setForm]       = useState<AddSnagForm>(INITIAL_FORM);
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set<K extends keyof AddSnagForm>(k: K, v: AddSnagForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleAdd() {
    setError(null);
    if (!form.description.trim()) { setError('Description is required'); return; }
    const body: { description: string; photoUrl?: string; assigneeId?: string } = {
      description: form.description.trim(),
    };
    if (form.photoUrl.trim())   body.photoUrl   = form.photoUrl.trim();
    if (form.assigneeId.trim()) body.assigneeId = form.assigneeId.trim();
    setAdding(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/snag-items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? 'Failed to add snag item'); return;
      }
      const { data: created } = await res.json() as { data: SnagItem };
      onAdd(created);
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--danger-soft)' }}>
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--danger)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Add Snag Item</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="studio-label block mb-1.5">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Describe the snag item in detail…"
              className="studio-input w-full text-sm resize-none" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Photo URL <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="url" value={form.photoUrl} onChange={e => set('photoUrl', e.target.value)}
              placeholder="https://…" className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Assignee ID <span style={{ color: 'var(--text-tertiary)' }}>(optional UUID)</span>
            </label>
            <input type="text" value={form.assigneeId} onChange={e => set('assigneeId', e.target.value)}
              placeholder="e.g. 550e8400-…" className="studio-input w-full text-sm" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleAdd} disabled={adding}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add Snag Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function SnagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [snagItems,   setSnagItems]   = useState<SnagItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [modalOpen,   setModalOpen]   = useState(false);

  const [clientUrl,   setClientUrl]   = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError,   setLinkError]   = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverResult,  setHandoverResult]  = useState<{ success: boolean; message: string } | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSnagItems = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch(`/api/v1/projects/${id}/snag-items`);
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setLoadError(body.error ?? 'Failed to load snag items'); return;
      }
      const { data } = await res.json() as { data: SnagItem[] };
      setSnagItems(data ?? []);
    } catch {
      setLoadError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadSnagItems(); }, [loadSnagItems]);

  async function handleStatusChange(snag: SnagItem, newStatus: SnagStatus) {
    if (snag.status === newStatus) return;
    setUpdatingStatus(p => ({ ...p, [snag.id]: true }));
    try {
      const res = await fetch(`/api/v1/snag-items/${snag.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      const { data: updated } = await res.json() as { data: SnagItem };
      setSnagItems(p => p.map(s => s.id === snag.id ? updated : s));
    } finally {
      setUpdatingStatus(p => ({ ...p, [snag.id]: false }));
    }
  }

  async function handleGenerateClientLink() {
    setLinkLoading(true); setLinkError(null); setClientUrl(null); setCopied(false);
    try {
      const res = await fetch(`/api/v1/projects/${id}/client-token`);
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setLinkError(json.error ?? 'Failed to generate link'); return;
      }
      const { data } = await res.json() as { data: { url: string } };
      setClientUrl(data.url);
    } catch {
      setLinkError('Network error — please try again');
    } finally {
      setLinkLoading(false);
    }
  }

  function handleCopyLink() {
    if (!clientUrl) return;
    void navigator.clipboard.writeText(clientUrl).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  const allClear = snagItems.length === 0 ||
    snagItems.every(s => s.status === 'resolved' || s.status === 'client_confirmed');

  async function handleInitiateHandover() {
    setHandoverLoading(true); setHandoverResult(null);
    try {
      const res = await fetch(`/api/v1/projects/${id}/handover`, { method: 'POST' });
      const json = await res.json() as { data?: { message?: string }; error?: string };
      if (!res.ok) { setHandoverResult({ success: false, message: json.error ?? 'Handover failed' }); return; }
      setHandoverResult({ success: true, message: json.data?.message ?? 'Handover initiated' });
    } catch {
      setHandoverResult({ success: false, message: 'Network error — please try again' });
    } finally {
      setHandoverLoading(false);
    }
  }

  const openCount    = snagItems.filter(s => s.status === 'open').length;
  const resolvedCount = snagItems.filter(s => s.status === 'resolved' || s.status === 'client_confirmed').length;

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Snag List</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Track and resolve punch-list items before handover</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleGenerateClientLink} disabled={linkLoading}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
            <ExternalLink className="h-3.5 w-3.5" />
            {linkLoading ? 'Generating…' : 'Client View Link'}
          </button>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl">
            <Plus className="h-4 w-4" />Add Snag Item
          </button>
        </div>
      </div>

      {/* Client link */}
      {clientUrl && (
        <div className="rounded-xl border flex items-center gap-3 px-4 py-3"
          style={{ borderColor: '#E0E7FF', background: '#EEF2FF' }}>
          <span className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--accent-text)' }}>{clientUrl}</span>
          <button type="button" onClick={handleCopyLink}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{ background: copied ? 'var(--success-soft)' : 'var(--surface-card)', color: copied ? 'var(--success-text)' : 'var(--accent-base)' }}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      {linkError && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{linkError}</p>
      )}

      {/* Summary stats */}
      {!loading && snagItems.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Open',     count: openCount,          color: 'var(--danger)', bg: 'var(--danger-soft)' },
            { label: 'Total',    count: snagItems.length,   color: 'var(--text-heading)', bg: 'var(--surface-muted)' },
            { label: 'Resolved', count: resolvedCount,      color: 'var(--success-text)', bg: 'var(--success-soft)' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="rounded-xl border p-4 text-center" style={{ background: bg, borderColor: 'var(--border-subtle)' }}>
              <p className="text-2xl font-bold" style={{ color }}>{count}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>

      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="h-8 w-8" style={{ color: 'var(--danger)' }} />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{loadError}</p>
        </div>

      ) : snagItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--success-soft)' }}>
              <ClipboardList className="h-10 w-10" style={{ color: 'var(--success)' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--danger-soft)', border: '2px solid var(--surface-card)' }}>
              <Plus className="h-4 w-4" style={{ color: 'var(--danger)' }} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No snag items</h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Add punch-list items during site inspection before finalising the project handover.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
            <Plus className="h-4 w-4" />Add First Snag Item
          </button>
        </div>

      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snagItems.map(snag => (
              <div key={snag.id} className="rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:shadow-sm"
                style={{
                  background: 'var(--surface-card)', borderColor: 'var(--border-subtle)',
                  borderTopWidth: 3, borderTopColor: STATUS_CONFIG[snag.status].dot,
                }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--text-heading)' }}>
                    {snag.description}
                  </p>
                  <StatusBadge module="snags" status={snag.status} />
                </div>

                {snag.photoUrl && (
                  <a href={snag.photoUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={snag.photoUrl} alt="Snag photo"
                      className="h-28 w-full object-cover hover:opacity-90 transition-opacity" />
                  </a>
                )}

                <div className="space-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {snag.assigneeId && (
                    <p><span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Assignee:</span> {snag.assigneeId}</p>
                  )}
                  {snag.clientConfirmedAt && (
                    <p><span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Client confirmed:</span>{' '}
                      {new Date(snag.clientConfirmedAt).toLocaleDateString('en-IN')}</p>
                  )}
                  <p>Added {new Date(snag.createdAt).toLocaleDateString('en-IN')}</p>
                </div>

                <div className="mt-auto pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <select value={snag.status} disabled={updatingStatus[snag.id]}
                    onChange={e => void handleStatusChange(snag, e.target.value as SnagStatus)}
                    className="studio-input w-full text-xs py-1.5 disabled:opacity-50">
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Handover section */}
          {allClear && (
            <div className="rounded-2xl border p-5" style={{ borderColor: '#86EFAC', background: 'var(--success-soft)' }}>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--success-soft)' }}>
                  <PartyPopper className="h-5 w-5" style={{ color: 'var(--success)' }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold mb-1" style={{ color: 'var(--success-text)' }}>
                    {snagItems.length === 0
                      ? 'No snag items — ready for handover!'
                      : 'All snag items resolved — ready to initiate handover!'}
                  </p>
                  <p className="text-sm mb-3" style={{ color: 'var(--success-text)' }}>
                    Once you initiate handover, a formal sign-off notification will be sent to the client.
                  </p>
                  <button type="button" onClick={() => void handleInitiateHandover()} disabled={handoverLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all"
                    style={{ background: 'var(--success)', color: 'var(--surface-card)', opacity: handoverLoading ? 0.7 : 1 }}>
                    <CheckCircle2 className="h-4 w-4" />
                    {handoverLoading ? 'Initiating…' : 'Initiate Handover'}
                  </button>
                  {handoverResult && (
                    <div className="mt-2">
                      <p className="text-xs font-medium"
                        style={{ color: handoverResult.success ? 'var(--success-text)' : 'var(--danger)' }}>
                        {handoverResult.message}
                      </p>
                      {handoverResult.success && (
                        <a
                          href={`/api/v1/projects/${id}/handover/cert`}
                          download
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--surface-card)', border: '1px solid #86efac', color: 'var(--success-text)' }}
                        >
                          <Download className="h-3.5 w-3.5" /> Download Certificate
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <AddSnagModal
          projectId={id}
          onClose={() => setModalOpen(false)}
          onAdd={item => setSnagItems(p => [...p, item])}
        />
      )}
    </div>
  );
}
