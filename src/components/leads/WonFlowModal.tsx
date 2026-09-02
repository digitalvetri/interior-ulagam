'use client';

import { useState } from 'react';
import { X, CheckCircle2, FolderKanban, User } from 'lucide-react';
import type { Lead } from '@/types/leads';

interface CreatedProject {
  id: string;
  name: string;
}

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onSuccess: (project: CreatedProject) => void;
  acceptedQuoteTotalPaise?: number;
}

function rupeesToPaise(rupees: string): number | undefined {
  const n = parseFloat(rupees.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export function WonFlowModal({ lead, open, onClose, onSuccess, acceptedQuoteTotalPaise }: Props) {
  const defaultName =
    lead.projectName?.trim() ||
    `${lead.contactName} — ${lead.propertyType ?? 'Interior'} Project`;

  const sourcePaise = acceptedQuoteTotalPaise ?? lead.projectValuePaise;
  const defaultValue =
    sourcePaise && sourcePaise > 0
      ? (sourcePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })
      : '';

  const [projectName, setProjectName] = useState(defaultName);
  const [contractValue, setContractValue] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!projectName.trim()) { setError('Project name is required'); return; }
    setSubmitting(true); setError(null);

    const totalContractPaise = contractValue.trim()
      ? rupeesToPaise(contractValue)
      : undefined;

    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId:             lead.id,
          name:               projectName.trim(),
          totalContractPaise: totalContractPaise ?? undefined,
        }),
      });
      const json = await res.json() as { data?: { id: string; name: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create project');
      onSuccess(json.data!);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl w-full max-w-md shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Mark as Won</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              This will create a project and convert the lead to a client.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Client summary */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-soft)' }}>
              <User className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>{lead.contactName}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</p>
            </div>
          </div>

          {/* Project name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Project Name *
            </label>
            <input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. 3BHK Renovation — Coimbatore"
              className="studio-input w-full text-sm"
            />
          </div>

          {/* Contract value */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Contract Value (₹) — optional
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>₹</span>
              <input
                value={contractValue}
                onChange={e => setContractValue(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="studio-input w-full text-sm pl-7"
              />
            </div>
            {lead.budgetBand && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Budget band: {lead.budgetBand}</p>
            )}
          </div>

          {/* What will happen */}
          <div className="rounded-xl p-3.5 space-y-1.5" style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--success-text)' }}>What happens next</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
              <p className="text-xs" style={{ color: 'var(--success-text)' }}>
                {lead.customerId ? 'Existing customer record updated to client' : 'New customer profile created (duplicate check by phone)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
              <p className="text-xs" style={{ color: 'var(--success-text)' }}>Project created and linked to this lead</p>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || !projectName.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--success)', color: '#fff' }}>
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
