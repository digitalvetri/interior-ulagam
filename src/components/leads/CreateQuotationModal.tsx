'use client';

import React, { useState } from 'react';
import { X, FileText, ExternalLink } from 'lucide-react';
import type { Quote } from '@/types/quotes';

interface Props {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (quote: Quote, openEditor: boolean) => void;
}

export function CreateQuotationModal({ leadId, leadName, open, onOpenChange, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleCreate(openEditor: boolean) {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/quotes`, { method: 'POST' });
      const json = await res.json() as { data?: Quote; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      onSuccess(json.data!, openEditor);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quotation.');
    } finally { setSubmitting(false); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Create Quotation</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Lead summary */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Lead</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{leadName}</p>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A draft quotation will be created and linked to this lead. The lead will move to the <strong>Quotation</strong> stage.
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCreate(true)}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
              style={{ background: '#7C3AED' }}
            >
              <ExternalLink className="h-4 w-4" />
              {submitting ? 'Creating…' : 'Create & Open Quote Editor'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCreate(false)}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl disabled:opacity-50"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-heading)', border: '1px solid var(--border-subtle)' }}
            >
              Create & Stay on Lead
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full px-5 py-2 text-sm rounded-xl"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
