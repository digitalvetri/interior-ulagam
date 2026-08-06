'use client';

import { useState } from 'react';
import { X, Check, BellRing, ChevronDown, Loader2 } from 'lucide-react';
import { Lead, LeadStage } from '@/types/leads';

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'new',                  label: 'New Inquiry' },
  { value: 'site_visit_scheduled', label: 'Site Visit' },
  { value: 'consultation_done',    label: 'Consultation' },
  { value: 'proposal_sent',        label: 'Proposal Sent' },
  { value: 'negotiation',          label: 'Negotiation' },
  { value: 'won',                  label: 'Won' },
  { value: 'lost',                 label: 'Lost' },
];

const CLIENT_STATUS_OPTIONS = [
  { value: 'interested',        label: 'Interested' },
  { value: 'not_interested',    label: 'Not Interested' },
  { value: 'callback',          label: 'Callback' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'thinking',          label: 'Thinking' },
  { value: 'no_response',       label: 'No Response' },
  { value: 'negotiating',       label: 'Negotiating' },
  { value: 'deal_closed',       label: 'Deal Closed' },
];

function todayDateString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

interface FollowUpModalProps {
  lead: Lead;
  onClose: () => void;
  onSaved?: () => void;
}

export function FollowUpModal({ lead, onClose, onSaved }: FollowUpModalProps) {
  const [followUpDate, setFollowUpDate] = useState(todayDateString());
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [stage, setStage] = useState<LeadStage>(lead.stage);
  const [clientStatus, setClientStatus] = useState('interested');
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let followUpDateTime: string | null = null;
      if (followUpDate) {
        const [y, m, d] = followUpDate.split('-').map(Number);
        const [h, min] = followUpTime.split(':').map(Number);
        followUpDateTime = new Date(y, m - 1, d, h, min).toISOString();
      }

      const res = await fetch(`/api/v1/leads/${lead.id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpDate: followUpDateTime,
          stage,
          clientStatus,
          comments: comments.trim() || null,
          addToCalendar,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(
          e.code === 'MIGRATION_REQUIRED'
            ? e.error
            : (e.error ?? 'Failed to save follow-up'),
        );
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            <h2 className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>
              Add Follow-up — {lead.contactName}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent-base)' }}
            >
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--border-subtle)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1">Next Follow-up Date</label>
              <input
                type="date"
                className="studio-input w-full"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
              />
            </div>
            <div>
              <label className="studio-label block mb-1">Follow-up Time</label>
              <input
                type="time"
                className="studio-input w-full"
                value={followUpTime}
                onChange={e => setFollowUpTime(e.target.value)}
              />
            </div>
          </div>

          {/* Stage + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1">Stage</label>
              <div className="relative">
                <select
                  className="studio-input w-full appearance-none pr-8"
                  value={stage}
                  onChange={e => setStage(e.target.value as LeadStage)}
                >
                  {STAGE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </div>
            </div>
            <div>
              <label className="studio-label block mb-1">Status</label>
              <div className="relative">
                <select
                  className="studio-input w-full appearance-none pr-8"
                  value={clientStatus}
                  onChange={e => setClientStatus(e.target.value)}
                >
                  {CLIENT_STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </div>
            </div>
          </div>

          {/* Calendar checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addToCalendar}
              onChange={e => setAddToCalendar(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-strong)]"
              style={{ accentColor: 'var(--accent-base)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Add event to Calendar</span>
          </label>

          {/* Comments */}
          <div>
            <label className="studio-label block mb-1">Comments</label>
            <textarea
              className="studio-input w-full resize-none"
              rows={4}
              placeholder="Notes about this follow-up interaction…"
              value={comments}
              onChange={e => setComments(e.target.value)}
            />
          </div>

          {error && (
            <p
              className="text-xs rounded-lg px-3 py-2"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
