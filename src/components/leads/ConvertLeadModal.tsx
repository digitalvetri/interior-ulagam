'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, User, MapPin, Home } from 'lucide-react';
import type { Lead } from '@/types/leads';

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  acceptedQuoteTotalPaise?: number;
  acceptedQuoteRef?: string;
}

function rupeesToPaise(rupees: string): number | undefined {
  const n = parseFloat(rupees.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function fmt(paise: number) {
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export function ConvertLeadModal({ lead, open, onClose, acceptedQuoteTotalPaise, acceptedQuoteRef }: Props) {
  const router = useRouter();

  const defaultName =
    lead.projectName?.trim() ||
    `${lead.contactName}${lead.propertyType ? ` — ${lead.propertyType}` : ''} Project`;

  const sourcePaise = acceptedQuoteTotalPaise ?? lead.projectValuePaise ?? null;
  const defaultBudget = sourcePaise && sourcePaise > 0
    ? (sourcePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : '';

  const [projectName, setProjectName] = useState(defaultName);
  const [budget, setBudget]           = useState(defaultBudget);
  const [pincode, setPincode]         = useState(lead.pincode ?? '');
  const [siteAddress, setSiteAddress] = useState(lead.projectLocation ?? '');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  if (!open) return null;

  const missingPincode     = !lead.pincode;
  const missingSiteAddress = !lead.projectLocation;

  async function handleSubmit() {
    if (!projectName.trim()) { setError('Project name is required'); return; }
    setSubmitting(true); setError(null);

    const budgetPaise = budget.trim() ? rupeesToPaise(budget) : undefined;

    const body: Record<string, unknown> = { projectName: projectName.trim() };
    if (budgetPaise)               body.budgetPaise  = budgetPaise;
    if (missingPincode && pincode.trim())         body.pincode     = pincode.trim();
    if (missingSiteAddress && siteAddress.trim()) body.siteAddress = siteAddress.trim();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl w-full max-w-md shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Convert to Client</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Creates a project, seeds payment milestones, and marks this lead as won.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Carried-forward summary (read-only) */}
          <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Carried from lead</p>
            <div className="flex items-start gap-2.5">
              <User className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-base)' }} />
              <div className="text-xs" style={{ color: 'var(--text-heading)' }}>
                <span className="font-semibold">{lead.contactName}</span>
                {lead.contactPhone && <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</span>}
                {lead.contactEmail && <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactEmail}</span>}
              </div>
            </div>
            {(lead.contactCity || lead.pincode) && (
              <div className="flex items-center gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                {[lead.contactCity, lead.pincode].filter(Boolean).join(' ')}
              </div>
            )}
            {lead.propertyType && (
              <div className="flex items-center gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Home className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                {lead.propertyType}
              </div>
            )}
          </div>

          {/* Missing client fields — show only if blank on lead */}
          {(missingPincode || missingSiteAddress) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Missing details</p>
              <div className="space-y-2">
                {missingPincode && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pincode</label>
                    <input value={pincode} onChange={e => setPincode(e.target.value)}
                      placeholder="641001" className="studio-input w-full text-sm h-9" />
                  </div>
                )}
                {missingSiteAddress && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Site address</label>
                    <input value={siteAddress} onChange={e => setSiteAddress(e.target.value)}
                      placeholder="12, Saibaba Colony, Coimbatore" className="studio-input w-full text-sm h-9" />
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Budget */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Budget (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>₹</span>
              <input
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="studio-input w-full text-sm pl-7"
              />
            </div>
            {acceptedQuoteRef && acceptedQuoteTotalPaise && (
              <p className="text-xs mt-1" style={{ color: 'var(--success-text)' }}>
                From accepted quote {acceptedQuoteRef}: {fmt(acceptedQuoteTotalPaise)}
              </p>
            )}
            {!acceptedQuoteTotalPaise && lead.budgetBand && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Estimated band: {lead.budgetBand}</p>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit}
              disabled={submitting || !projectName.trim()}
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
