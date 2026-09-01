'use client';

import React, { useEffect, useState } from 'react';
import { X, Home, CheckCircle2 } from 'lucide-react';
import type { SiteVisit } from '@/types/site-visits';

interface TeamMember { id: string; fullName: string; role: string; }

interface Props {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAddress?: string;
  onSuccess: (visit: SiteVisit) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-[11px] w-24 flex-shrink-0 font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  );
}

export function ScheduleSiteVisitModal({ leadId, open, onOpenChange, defaultAddress = '', onSuccess }: Props) {
  const [fetchDone, setFetchDone]           = useState(false);
  const [existingVisit, setExistingVisit]   = useState<SiteVisit | null>(null);
  const [scheduledAt, setScheduledAt]       = useState('');
  const [address, setAddress]               = useState('');
  const [designerId, setDesignerId]         = useState('');
  const [notes, setNotes]                   = useState('');
  const [team, setTeam]                     = useState<TeamMember[]>([]);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetchDone(false);
    setExistingVisit(null);
    setScheduledAt('');
    setAddress(defaultAddress);
    setDesignerId('');
    setNotes('');
    setError(null);

    Promise.all([
      fetch(`/api/v1/site-visits?leadId=${leadId}`),
      fetch('/api/v1/employees'),
    ]).then(async ([svRes, empRes]) => {
      if (svRes.ok) {
        const { data } = await svRes.json() as { data: SiteVisit[] };
        const found = data.find(v => !v.completedAt) ?? data[0] ?? null;
        setExistingVisit(found);
      }
      if (empRes.ok) {
        const res = await empRes.json() as { data?: TeamMember[] };
        setTeam((res.data ?? []).filter(m => m.role === 'designer' || m.role === 'owner'));
      }
    }).catch(() => {}).finally(() => setFetchDone(true));
  }, [open, leadId, defaultAddress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) { setError('Please select a date and time.'); return; }
    const parsedDate = new Date(scheduledAt);
    if (isNaN(parsedDate.getTime())) { setError('Invalid date — please pick again.'); return; }

    setSubmitting(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        leadId,
        scheduledAt: parsedDate.toISOString(),
        address: address.trim() || 'TBD',
      };
      if (designerId) body.designerId = designerId;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch('/api/v1/site-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: SiteVisit; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      onSuccess(json.data!);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule.');
    } finally { setSubmitting(false); }
  }

  if (!open) return null;

  const inputCls = 'studio-input w-full text-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <Home className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
              {existingVisit ? 'Site Visit Details' : 'Schedule Site Visit'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Loading */}
        {!fetchDone && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          </div>
        )}

        {/* Existing visit — details view */}
        {fetchDone && existingVisit && (
          <div className="px-6 py-5 space-y-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: existingVisit.completedAt ? 'var(--success-soft)' : 'var(--accent-soft)',
                color: existingVisit.completedAt ? 'var(--success-text)' : 'var(--accent-text)',
              }}
            >
              <CheckCircle2 className="h-3 w-3" />
              {existingVisit.completedAt ? 'Completed' : 'Scheduled'}
            </span>
            <div>
              <Row
                label="Date & Time"
                value={new Date(existingVisit.scheduledAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              />
              <Row label="Address" value={existingVisit.locationJson?.address ?? '—'} />
              {existingVisit.notes && <Row label="Notes" value={existingVisit.notes} />}
              {existingVisit.completedAt && (
                <Row label="Completed" value={new Date(existingVisit.completedAt).toLocaleString('en-IN')} />
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-heading)', border: '1px solid var(--border-subtle)' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* No visit — schedule form */}
        {fetchDone && !existingVisit && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Site address"
                className={inputCls}
              />
            </div>
            {team.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Assign Designer
                </label>
                <select value={designerId} onChange={e => setDesignerId(e.target.value)} className={inputCls}>
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Preparation notes, what to measure, client requirements…"
                className={`${inputCls} resize-none`}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div
              className="flex items-center justify-end gap-2 pt-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl"
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
                style={{ background: '#7C3AED' }}
              >
                {submitting ? 'Scheduling…' : 'Schedule Site Visit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
