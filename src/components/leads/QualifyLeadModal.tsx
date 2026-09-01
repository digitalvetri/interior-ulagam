'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Lead } from '@/types/leads';

interface Props {
  leadId: string;
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedLead: Lead) => void;
}

const PROPERTY_TYPES = [
  'Apartment', 'Villa', 'Independent House', 'Office', 'Retail',
  'Restaurant', 'Hotel / Hospitality', 'Other',
];

const BUDGET_BANDS = [
  'Under ₹5L', '₹5–10L', '₹10–25L', '₹25–50L', '₹50L–1Cr', 'Above ₹1Cr',
];

const TIMELINES = [
  'ASAP', 'Within 3 months', '3–6 months', '6–12 months', 'Flexible',
];

export function QualifyLeadModal({ leadId, lead, open, onClose, onSuccess }: Props) {
  const [propertyType, setPropertyType] = useState(lead.propertyType ?? '');
  const [budgetBand, setBudgetBand]     = useState(lead.budgetBand ?? '');
  const [timeline, setTimeline]         = useState('');
  const [reqNotes, setReqNotes]         = useState(lead.notes ?? '');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!propertyType || !budgetBand) {
      setError('Property type and budget are required to qualify a lead.'); return;
    }
    setSubmitting(true); setError(null);
    try {
      const patch: Record<string, unknown> = {
        propertyType,
        budgetBand,
        notes: reqNotes.trim() || null,
        stage: 'qualified',
      };
      if (timeline) patch['notes'] = [reqNotes.trim(), `Timeline: ${timeline}`].filter(Boolean).join('\n');

      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json() as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to qualify lead');
      onSuccess(json.data!);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto" style={{ maxHeight: '90vh', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Qualify Lead</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactName} — capture requirement details</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Property type */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Property Type *</p>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(pt => (
                <button key={pt} type="button" onClick={() => setPropertyType(pt)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: propertyType === pt ? 'var(--accent-soft)' : 'var(--surface-muted)',
                    border: `1.5px solid ${propertyType === pt ? 'var(--accent-base)' : 'var(--border-subtle)'}`,
                    color: propertyType === pt ? 'var(--accent-base)' : 'var(--text-heading)',
                  }}>
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Budget Band *</p>
            <div className="flex flex-wrap gap-2">
              {BUDGET_BANDS.map(b => (
                <button key={b} type="button" onClick={() => setBudgetBand(b)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: budgetBand === b ? 'var(--accent-soft)' : 'var(--surface-muted)',
                    border: `1.5px solid ${budgetBand === b ? 'var(--accent-base)' : 'var(--border-subtle)'}`,
                    color: budgetBand === b ? 'var(--accent-base)' : 'var(--text-heading)',
                  }}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Project Timeline</p>
            <div className="flex flex-wrap gap-2">
              {TIMELINES.map(t => (
                <button key={t} type="button" onClick={() => setTimeline(prev => prev === t ? '' : t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: timeline === t ? 'var(--accent-soft)' : 'var(--surface-muted)',
                    border: `1.5px solid ${timeline === t ? 'var(--accent-base)' : 'var(--border-subtle)'}`,
                    color: timeline === t ? 'var(--accent-base)' : 'var(--text-heading)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Requirement Notes</p>
            <textarea rows={3} value={reqNotes} onChange={e => setReqNotes(e.target.value)}
              placeholder="Style preferences, special requirements, rooms to cover…"
              className="studio-input w-full text-sm resize-none" />
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
              {submitting ? 'Qualifying…' : 'Qualify Lead →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
