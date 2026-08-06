'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CreditCard, Plus, Send, Settings2, CheckCircle2, Copy,
  Check, AlertTriangle, X, IndianRupee,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { Milestone, MilestonePaymentStatus } from '@/types/milestones';

/* ── Status config ─────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<MilestonePaymentStatus, { label: string; bg: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
  link_sent: { label: 'Link Sent', bg: 'var(--accent-soft)', color: 'var(--accent-text)', dot: 'var(--accent-base)' },
  paid:      { label: 'Paid',      bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)', color: 'var(--danger)', dot: 'var(--danger)' },
};

function StatusBadge({ status }: { status: MilestonePaymentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Send Payment Link Modal ───────────────────────────────────────────────── */

interface SendLinkForm { clientName: string; contactPhone: string; placeOfSupply: string; isInterstate: boolean; }

function SendLinkModal({
  milestone, onClose, onSuccess,
}: {
  milestone: Milestone;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm]       = useState<SendLinkForm>({ clientName: '', contactPhone: '', placeOfSupply: '', isInterstate: false });
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  function set<K extends keyof SendLinkForm>(k: K, v: SendLinkForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSend() {
    setError(null);
    if (!form.clientName.trim()) { setError('Client name is required'); return; }
    if (!form.contactPhone.trim()) { setError('Contact phone is required'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/v1/milestones/${milestone.id}/trigger`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: form.clientName.trim(), contactPhone: form.contactPhone.trim(),
          placeOfSupply: form.placeOfSupply.trim() || undefined, isInterstate: form.isInterstate,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? 'Failed to send payment link'); return;
      }
      const body = await res.json() as { data: { paymentLink: { shortUrl: string } } };
      setShortUrl(body.data.paymentLink.shortUrl);
      onSuccess();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <Send className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Send Payment Link</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {milestone.label} · {formatRupees(milestone.amountPaise)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {shortUrl ? (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--success-soft)', border: '1px solid #86EFAC' }}>
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-green-700">Payment link created!</span>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Payment URL</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-mono break-all" style={{ color: 'var(--text-heading)' }}>{shortUrl}</p>
                <button type="button" onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: copied ? 'var(--success-soft)' : 'var(--accent-soft)', color: copied ? 'var(--success-text)' : 'var(--accent-base)' }}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full py-2.5 text-sm">Close</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="studio-label block mb-1.5">Client Name *</label>
                  <input type="text" value={form.clientName} onChange={e => set('clientName', e.target.value)}
                    placeholder="Ramesh Sharma" className="studio-input w-full text-sm" />
                </div>
                <div>
                  <label className="studio-label block mb-1.5">Contact Phone *</label>
                  <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                    placeholder="+91 98765 43210" className="studio-input w-full text-sm" />
                </div>
                <div>
                  <label className="studio-label block mb-1.5">
                    Place of Supply <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                  </label>
                  <input type="text" value={form.placeOfSupply} onChange={e => set('placeOfSupply', e.target.value)}
                    placeholder="Tamil Nadu" className="studio-input w-full text-sm" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer px-1">
                  <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ background: form.isInterstate ? 'var(--accent-base)' : 'var(--border-strong)' }}
                    onClick={() => set('isInterstate', !form.isInterstate)}>
                    <div className="absolute top-1 w-4 h-4 bg-[var(--surface-card)] rounded-full transition-all"
                      style={{ left: form.isInterstate ? 22 : 4 }} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-heading)' }}>Interstate supply (IGST 18%)</span>
                </label>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button type="button" onClick={handleSend} disabled={sending}
                className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : 'Send Link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Manual Override Modal ─────────────────────────────────────────────────── */

function OverrideModal({
  milestone, onClose, onSuccess,
}: {
  milestone: Milestone;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newStatus, setNewStatus] = useState<'paid' | 'overdue' | ''>('');
  const [note,      setNote]      = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleOverride() {
    setError(null);
    if (!newStatus) { setError('Please select a new status'); return; }
    if (!note.trim()) { setError('A note is required for manual overrides'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/milestones/${milestone.id}/override`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? 'Failed to apply override'); return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-soft)' }}>
              <Settings2 className="h-4 w-4" style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Manual Override</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {milestone.label} · {formatRupees(milestone.amountPaise)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            {(['paid', 'overdue'] as const).map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button key={s} type="button" onClick={() => setNewStatus(s)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: newStatus === s ? cfg.dot : 'var(--border-strong)',
                    background:  newStatus === s ? cfg.bg : 'var(--surface-card)',
                    color:       newStatus === s ? cfg.color : 'var(--text-secondary)',
                  }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="studio-label block mb-1.5">Reason / Note *</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={3} placeholder="Reason for this manual override…"
              className="studio-input w-full text-sm resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleOverride} disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
            style={{
              background: newStatus === 'overdue' ? 'var(--danger)' : 'var(--accent-base)',
              color: 'var(--surface-card)',
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Applying…' : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [seeding,    setSeeding]    = useState(false);
  const [seedError,  setSeedError]  = useState<string | null>(null);

  const [sendOpen,      setSendOpen]      = useState(false);
  const [overrideOpen,  setOverrideOpen]  = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  const loadMilestones = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/milestones`)
      .then(r => r.json())
      .then(({ data }: { data: Milestone[] }) => { setMilestones(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  async function handleSeedDefaults() {
    setSeedError(null); setSeeding(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedDefaults: true }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSeedError(body.error ?? 'Failed to seed milestones'); return;
      }
      loadMilestones();
    } catch {
      setSeedError('Network error — please try again');
    } finally {
      setSeeding(false);
    }
  }

  // Summary stats
  const totalPaidPaise       = milestones.filter(m => m.paymentStatus === 'paid').reduce((s, m) => s + m.amountPaise, 0);
  const totalOutstandingPaise = milestones.filter(m => m.paymentStatus !== 'paid').reduce((s, m) => s + m.amountPaise, 0);
  const paidCount            = milestones.filter(m => m.paymentStatus === 'paid').length;
  const overdueCount         = milestones.filter(m => m.paymentStatus === 'overdue').length;

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Milestone Payments</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Track client payments and send payment links
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && milestones.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Paid</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{formatRupees(totalPaidPaise)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{paidCount} milestone{paidCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Outstanding</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--warning-text)' }}>{formatRupees(totalOutstandingPaise)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{milestones.length - paidCount} remaining</p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Progress</p>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                {milestones.length > 0 ? Math.round((paidCount / milestones.length) * 100) : 0}%
              </p>
              {overdueCount > 0 && (
                <span className="text-xs font-medium mb-0.5" style={{ color: 'var(--danger)' }}>
                  {overdueCount} overdue
                </span>
              )}
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--border-subtle)' }}>
              <div className="h-1.5 rounded-full"
                style={{
                  width: `${milestones.length > 0 ? Math.round((paidCount / milestones.length) * 100) : 0}%`,
                  background: 'var(--success)',
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>

      ) : milestones.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--success-soft)' }}>
              <CreditCard className="h-10 w-10" style={{ color: 'var(--success)' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', border: '2px solid var(--surface-card)' }}>
              <Plus className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No milestones set up yet</h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Seed default milestones at 10% / 40% / 40% / 10% of the contract value to start collecting payments.
            </p>
          </div>
          {seedError && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{seedError}</p>
          )}
          <button type="button" onClick={handleSeedDefaults} disabled={seeding}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
            <IndianRupee className="h-4 w-4" />
            {seeding ? 'Seeding…' : 'Seed Default Milestones (10/40/40/10%)'}
          </button>
        </div>

      ) : (
        /* Milestone cards */
        <div className="space-y-3">
          {milestones.map(m => {
            const cfg = STATUS_CONFIG[m.paymentStatus];
            const canSend = ['pending', 'link_sent', 'overdue'].includes(m.paymentStatus);
            return (
              <div key={m.id} className="rounded-2xl border p-5 transition-all hover:shadow-sm"
                style={{
                  background: 'var(--surface-card)',
                  borderColor: m.paymentStatus === 'overdue' ? 'var(--danger-soft)' : 'var(--border-subtle)',
                  borderLeftWidth: 4,
                  borderLeftColor: cfg.dot,
                }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{m.label}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(m.amountPaise)}
                      </p>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                        {m.pctOfTotal}%
                      </span>
                    </div>
                    {m.paidAt && (
                      <p className="text-xs" style={{ color: 'var(--success)' }}>
                        Paid on {new Date(m.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {m.triggerStage && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Trigger: {m.triggerStage.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={m.paymentStatus} />
                </div>

                {m.paymentStatus !== 'paid' && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {canSend && (
                      <button type="button"
                        onClick={() => { setActiveMilestone(m); setSendOpen(true); }}
                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
                        <Send className="h-3.5 w-3.5" />
                        {m.paymentStatus === 'link_sent' ? 'Resend Link' : 'Send Payment Link'}
                      </button>
                    )}
                    <button type="button"
                      onClick={() => { setActiveMilestone(m); setOverrideOpen(true); }}
                      className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
                      <Settings2 className="h-3.5 w-3.5" />
                      Manual Override
                    </button>
                  </div>
                )}

                {m.paymentStatus === 'paid' && (
                  <div className="flex items-center gap-2 mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>Payment received</span>
                    <button type="button"
                      onClick={() => { setActiveMilestone(m); setOverrideOpen(true); }}
                      className="ml-auto text-xs font-medium transition-colors hover:underline"
                      style={{ color: 'var(--text-tertiary)' }}>
                      Override
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {sendOpen && activeMilestone && (
        <SendLinkModal
          milestone={activeMilestone}
          onClose={() => { setSendOpen(false); setActiveMilestone(null); }}
          onSuccess={loadMilestones}
        />
      )}
      {overrideOpen && activeMilestone && (
        <OverrideModal
          milestone={activeMilestone}
          onClose={() => { setOverrideOpen(false); setActiveMilestone(null); }}
          onSuccess={loadMilestones}
        />
      )}
    </div>
  );
}
