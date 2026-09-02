'use client';

import React, { useEffect, useState } from 'react';
import { X, Ruler, CheckCircle2 } from 'lucide-react';
import type { MeasurementRound } from '@/types/leads';

interface TeamMember { id: string; fullName: string; role: string; }

interface Props {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (round: MeasurementRound) => void;
}

export function ScheduleMeasurementModal({ leadId, open, onOpenChange, onSuccess }: Props) {
  const [fetchDone, setFetchDone]     = useState(false);
  const [existingRounds, setExisting] = useState<MeasurementRound[]>([]);
  const [team, setTeam]               = useState<TeamMember[]>([]);
  const [roundName, setRoundName]     = useState('Initial Measurement');
  const [scheduledAt, setScheduledAt] = useState('');
  const [assignedToId, setAssignedTo] = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetchDone(false);
    setExisting([]);
    setRoundName('Initial Measurement');
    setScheduledAt('');
    setAssignedTo('');
    setNotes('');
    setError(null);

    Promise.all([
      fetch(`/api/v1/leads/${leadId}/measurements`),
      fetch('/api/v1/employees'),
    ]).then(async ([mrRes, empRes]) => {
      if (mrRes.ok) {
        const { data } = await mrRes.json() as { data: MeasurementRound[] };
        setExisting(data ?? []);
      }
      if (empRes.ok) {
        const res = await empRes.json() as { data?: TeamMember[] };
        setTeam((res.data ?? []).filter(m => m.role === 'designer' || m.role === 'owner'));
      }
    }).catch(() => {}).finally(() => setFetchDone(true));
  }, [open, leadId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roundName.trim()) { setError('Round name is required.'); return; }
    setSubmitting(true); setError(null);
    try {
      const body: Record<string, unknown> = { roundName: roundName.trim() };
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      if (assignedToId) body.assignedToId = assignedToId;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch(`/api/v1/leads/${leadId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: MeasurementRound; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      onSuccess({ ...json.data!, items: [] });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create measurement round.');
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
            <Ruler className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Record Measurements</h2>
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

        {/* Existing rounds — info view */}
        {fetchDone && existingRounds.length > 0 && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                {existingRounds.length} measurement round{existingRounds.length > 1 ? 's' : ''} recorded
              </p>
            </div>
            <div className="space-y-2">
              {existingRounds.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{r.roundName}</p>
                    {r.scheduledAt && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(r.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {r.completedAt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>DONE</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Moving to Measurement stage. Add more rounds from the Measurements tab.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl"
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                Cancel
              </button>
              <button type="button"
                onClick={async () => {
                  // Advance stage without creating a new round
                  onSuccess(existingRounds[0]);
                  onOpenChange(false);
                }}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white"
                style={{ background: '#7C3AED' }}>
                Move to Measurement
              </button>
            </div>
          </div>
        )}

        {/* No rounds — create form */}
        {fetchDone && existingRounds.length === 0 && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Create the first measurement round to record site dimensions.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Round Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                placeholder="e.g. Initial Measurement"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Scheduled Date
              </label>
              <input
                type="date"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className={inputCls}
              />
            </div>
            {team.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Assign Designer
                </label>
                <select value={assignedToId} onChange={e => setAssignedTo(e.target.value)} className={inputCls}>
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
                placeholder="What to measure, areas to cover, client requirements…"
                className={`${inputCls} resize-none`}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl"
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
                style={{ background: '#7C3AED' }}>
                {submitting ? 'Creating…' : 'Create Round & Move to Measurement'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
