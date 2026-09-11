'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, UserCheck, ChevronDown } from 'lucide-react';
import type { Lead } from '@/types/leads';

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  acceptedQuoteTotalPaise?: number;
  acceptedQuoteRef?: string;
}

const PROJECT_TYPES = ['Design', 'Architecture', 'Construction', 'Renovation'];

function rupeesToPaise(rupees: string): number | undefined {
  const n = parseFloat(rupees.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export function ConvertLeadModal({ lead, open, onClose, acceptedQuoteTotalPaise }: Props) {
  const router = useRouter();

  const defaultName =
    lead.projectName?.trim() ||
    `${lead.contactName}${lead.propertyType ? ` — ${lead.propertyType}` : ''} Project`;

  const sourcePaise = acceptedQuoteTotalPaise ?? lead.projectValuePaise ?? null;
  const defaultBudget = sourcePaise && sourcePaise > 0
    ? (sourcePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : '';

  const [projectName, setProjectName]   = useState(defaultName);
  const [projectType, setProjectType]   = useState('');
  const [siteCity, setSiteCity]         = useState(lead.contactCity ?? '');
  const [budget, setBudget]             = useState(defaultBudget);
  const [startDate, setStartDate]       = useState('');
  const [requirement, setRequirement]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!projectName.trim()) { setError('Project name is required'); return; }
    setSubmitting(true); setError(null);

    const budgetPaise = budget.trim() ? rupeesToPaise(budget) : undefined;

    const body: Record<string, unknown> = { projectName: projectName.trim() };
    if (budgetPaise)            body.budgetPaise  = budgetPaise;
    if (projectType)            body.projectType  = projectType;
    if (siteCity.trim())        body.siteCity     = siteCity.trim();
    if (startDate)              body.startDate    = new Date(startDate).toISOString();
    if (requirement.trim())     body.requirement  = requirement.trim();

    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: { projectId: string }; error?: string };
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Failed (${res.status})`);
      router.push(`/projects/${json.data!.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Convert to Client</h2>
          <button type="button" onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* CLIENT INFO section */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Client Info (from lead)
            </p>
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{lead.contactName}</p>
              {lead.contactPhone && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</p>
              )}
            </div>
          </div>

          {/* NEW PROJECT section */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              New Project
            </p>

            {/* Project Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                PROJECT NAME *
              </label>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. 3BHK Renovation — Coimbatore"
                className="studio-input w-full text-sm"
              />
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                PROJECT TYPE
              </label>
              <div className="relative">
                <select
                  value={projectType}
                  onChange={e => setProjectType(e.target.value)}
                  className="studio-input w-full text-sm appearance-none pr-8"
                  style={{ color: projectType ? 'var(--text-heading)' : 'var(--text-tertiary)' }}
                >
                  <option value="">Select type</option>
                  {PROJECT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>

            {/* Site City */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                SITE CITY
              </label>
              <input
                value={siteCity}
                onChange={e => setSiteCity(e.target.value)}
                placeholder="e.g. Coimbatore"
                className="studio-input w-full text-sm"
              />
            </div>

            {/* Estimated Budget */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                ESTIMATED BUDGET (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>₹</span>
                <input
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="studio-input w-full text-sm"
                  style={{ paddingLeft: '1.75rem' }}
                />
              </div>
            </div>

            {/* Expected Start Date */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                EXPECTED START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="studio-input w-full text-sm"
              />
            </div>

            {/* Requirement */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                REQUIREMENT
              </label>
              <textarea
                value={requirement}
                onChange={e => setRequirement(e.target.value)}
                placeholder="Describe the client's requirements…"
                rows={3}
                className="studio-input w-full text-sm resize-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={submitting || !projectName.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent-base, #0D7F6E)', color: '#fff' }}>
            <UserCheck className="h-4 w-4" />
            {submitting ? 'Converting…' : 'Convert & Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
