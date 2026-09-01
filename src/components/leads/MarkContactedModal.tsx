'use client';

import { useState } from 'react';
import { X, Phone, MessageCircle, Users, Mail } from 'lucide-react';
import type { Lead, LeadActivity } from '@/types/leads';

interface Props {
  leadId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedLead: Lead, newActivity: LeadActivity) => void;
}

const METHODS = [
  { key: 'call',      label: 'Phone Call',  Icon: Phone },
  { key: 'whatsapp',  label: 'WhatsApp',    Icon: MessageCircle },
  { key: 'meeting',   label: 'In Person',   Icon: Users },
  { key: 'email',     label: 'Email',       Icon: Mail },
] as const;

type Method = typeof METHODS[number]['key'];

export function MarkContactedModal({ leadId, contactName, open, onClose, onSuccess }: Props) {
  const [method, setMethod]     = useState<Method>('call');
  const [note, setNote]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  if (!open) return null;

  const titleMap: Record<Method, string> = {
    call:     `Call — ${contactName}`,
    whatsapp: `WhatsApp — ${contactName}`,
    meeting:  `In-person meeting — ${contactName}`,
    email:    `Email — ${contactName}`,
  };

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    try {
      // 1. Log the contact activity
      const actRes = await fetch(`/api/v1/leads/${leadId}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: method === 'meeting' ? 'meeting' : method === 'email' ? 'note' : method,
          title: titleMap[method],
          contactMethod: method,
          description: note.trim() || undefined,
        }),
      });
      const actJson = await actRes.json() as { data?: LeadActivity; error?: string };
      if (!actRes.ok) throw new Error(actJson.error ?? 'Failed to log activity');

      // 2. Advance stage to contacted
      const leadRes = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'contacted' }),
      });
      const leadJson = await leadRes.json() as { data?: Lead; error?: string };
      if (!leadRes.ok) throw new Error(leadJson.error ?? 'Failed to advance stage');

      setNote(''); setMethod('call');
      onSuccess(leadJson.data!, actJson.data!);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl w-full max-w-sm shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Mark as Contacted</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contactName}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Contact method */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>How did you reach them?</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: method === key ? 'var(--accent-soft)' : 'var(--surface-muted)',
                    border: `1.5px solid ${method === key ? 'var(--accent-base)' : 'var(--border-subtle)'}`,
                    color: method === key ? 'var(--accent-base)' : 'var(--text-heading)',
                  }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Notes (optional)</p>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Brief note about the conversation…"
              className="studio-input w-full text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}>
              {submitting ? 'Saving…' : 'Mark Contacted'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
