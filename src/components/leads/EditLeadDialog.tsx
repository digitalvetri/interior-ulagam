'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lead, LeadSource, LeadPriority, LeadStage } from '@/types/leads';

interface EditLeadDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: Lead) => void;
}

interface Employee {
  id: string;
  fullName: string;
  role: string;
}

// ─── Options (mirrors NewLeadDialog) ─────────────────────────────────────────

const PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: 'hot',  label: '🔥 Hot'  },
  { value: 'warm', label: '☀️ Warm' },
  { value: 'cold', label: '🧊 Cold' },
];

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'new',         label: 'New Inquiry'  },
  { value: 'contacted',   label: 'Contacted'    },
  { value: 'site_visit',  label: 'Site Visit'   },
  { value: 'measured',    label: 'Measured'     },
  { value: 'quotation',   label: 'Quotation'    },
  { value: 'negotiation', label: 'Negotiation'  },
  { value: 'booked',      label: 'Booked'       },
  { value: 'lost',        label: 'Lost'         },
];

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'referral',  label: 'Referral'  },
  { value: 'website',   label: 'Website'   },
  { value: 'walk_in',   label: 'Walk-in'   },
  { value: 'other',     label: 'Other'     },
];

const PROPERTY_TYPE_OPTIONS = [
  'Apartment',
  'Villa',
  'Independent House',
  'Row House',
  'Commercial Space',
  'Plot / Land',
  'Other',
];

const BUDGET_OPTIONS = [
  { value: 'under_5l',  label: 'Under ₹5 Lakhs'  },
  { value: '5l_10l',    label: '₹5L – ₹10L'      },
  { value: '10l_25l',   label: '₹10L – ₹25L'     },
  { value: '25l_50l',   label: '₹25L – ₹50L'     },
  { value: '50l_1cr',   label: '₹50L – ₹1 Crore' },
  { value: 'above_1cr', label: 'Above ₹1 Crore'  },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  propertyType: string;
  contactCity: string;
  pincode: string;
  projectLocation: string;
  source: LeadSource;
  priority: LeadPriority | '';
  stage: LeadStage;
  ownerId: string;
  requirement: string;
  expectedBudget: string;
  notes: string;
}

function fromLead(lead: Lead): FormState {
  return {
    contactName:     lead.contactName ?? '',
    contactPhone:    lead.contactPhone ?? '',
    contactEmail:    lead.contactEmail ?? '',
    propertyType:    lead.propertyType ?? '',
    contactCity:     lead.contactCity ?? '',
    pincode:         lead.pincode ?? '',
    projectLocation: lead.projectLocation ?? '',
    source:          lead.source ?? 'whatsapp',
    priority:        lead.priority ?? '',
    stage:           lead.stage ?? 'new',
    ownerId:         lead.ownerId ?? '',
    requirement:     lead.notes ?? '',
    expectedBudget:  lead.budgetBand ?? '',
    notes:           '',
  };
}

// ─── Helper components (mirrors NewLeadDialog) ────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
      style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

function Field({ id, label, required, hint, children }: {
  id: string; label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {hint && <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: EditLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [form, setForm]             = useState<FormState>(() => fromLead(lead));

  useEffect(() => {
    if (open) {
      setForm(fromLead(lead));
      setError(null);
    }
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(({ data }: { data?: Employee[] }) => {
        setEmployees((data ?? []).filter(e => ['owner', 'admin', 'designer'].includes(e.role)));
      })
      .catch(() => {});
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.contactName.trim()) { setError('Customer name is required.'); return; }
    if (!form.contactPhone.trim()) { setError('Mobile number is required.'); return; }

    setSubmitting(true);
    setError(null);

    // Combine notes the same way NewLeadDialog does
    const parts: string[] = [];
    if (form.requirement.trim()) parts.push(form.requirement.trim());
    if (form.notes.trim()) parts.push(`Notes: ${form.notes.trim()}`);
    const combinedNotes = parts.join('\n\n');

    const payload: Record<string, unknown> = {
      contactName:  form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      source:       form.source,
      stage:        form.stage,
      notes:        combinedNotes,
    };
    if (form.contactEmail.trim())    payload.contactEmail    = form.contactEmail.trim();
    if (form.propertyType)           payload.propertyType    = form.propertyType;
    if (form.contactCity.trim())     payload.contactCity     = form.contactCity.trim();
    if (form.pincode.trim())         payload.pincode         = form.pincode.trim();
    if (form.projectLocation.trim()) payload.projectLocation = form.projectLocation.trim();
    if (form.priority)               payload.priority        = form.priority;
    if (form.ownerId)                payload.ownerId         = form.ownerId;
    if (form.expectedBudget)         payload.budgetBand      = form.expectedBudget;

    try {
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
      onSuccess(body.data!);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'h-9 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
            Edit Lead
          </DialogTitle>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Update the lead details below.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* 1. Contact Information */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Contact Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field id="e-contactName" label="Customer Name" required>
                <Input id="e-contactName" className={inputCls}
                  placeholder="e.g. Priya Sharma"
                  value={form.contactName}
                  onChange={e => set('contactName', e.target.value)} required />
              </Field>
              <Field id="e-contactPhone" label="Mobile Number" required>
                <Input id="e-contactPhone" type="tel" className={inputCls}
                  placeholder="e.g. 9876543210"
                  value={form.contactPhone}
                  onChange={e => set('contactPhone', e.target.value)} required />
              </Field>
              <Field id="e-contactEmail" label="Email">
                <Input id="e-contactEmail" type="email" className={inputCls}
                  placeholder="e.g. priya@email.com"
                  value={form.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* 2. Property / Site */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Property / Site</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field id="e-propertyType" label="Property Type">
                <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
                  <SelectTrigger id="e-propertyType" className={inputCls}>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPE_OPTIONS.map(pt => (
                      <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="e-contactCity" label="City">
                <Input id="e-contactCity" className={inputCls}
                  placeholder="e.g. Coimbatore"
                  value={form.contactCity}
                  onChange={e => set('contactCity', e.target.value)} />
              </Field>
              <Field id="e-pincode" label="Pincode">
                <Input id="e-pincode" className={inputCls}
                  placeholder="e.g. 641001"
                  value={form.pincode}
                  onChange={e => set('pincode', e.target.value)} />
              </Field>
              <div className="sm:col-span-3">
                <Field id="e-projectLocation" label="Site Address">
                  <Input id="e-projectLocation" className={inputCls}
                    placeholder="Full site / property address"
                    value={form.projectLocation}
                    onChange={e => set('projectLocation', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {/* 3. Lead Information */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Lead Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="e-source" label="Lead Source" required>
                <Select value={form.source} onValueChange={v => set('source', v as LeadSource)}>
                  <SelectTrigger id="e-source" className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="e-priority" label="Lead Priority">
                <Select value={form.priority} onValueChange={v => set('priority', v as LeadPriority)}>
                  <SelectTrigger id="e-priority" className={inputCls}>
                    <SelectValue placeholder="Select priority…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="e-stage" label="Lead Stage">
                <Select value={form.stage} onValueChange={v => set('stage', v as LeadStage)}>
                  <SelectTrigger id="e-stage" className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="e-ownerId" label="Assigned To">
                <Select value={form.ownerId} onValueChange={v => set('ownerId', v)}>
                  <SelectTrigger id="e-ownerId" className={inputCls}>
                    <SelectValue placeholder="Choose team member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* 4. Project Requirements */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Project Requirements</SectionLabel>
            <div className="space-y-4">
              <Field id="e-requirement" label="Requirement">
                <Textarea
                  id="e-requirement"
                  placeholder="Describe what the client needs…"
                  rows={3}
                  value={form.requirement}
                  onChange={e => set('requirement', e.target.value)}
                  className="text-sm resize-none"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="e-expectedBudget" label="Expected Budget">
                  <Select value={form.expectedBudget} onValueChange={v => set('expectedBudget', v)}>
                    <SelectTrigger id="e-expectedBudget" className={inputCls}>
                      <SelectValue placeholder="Select range…" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="e-notes" label="Notes" hint="Optional">
                  <Input id="e-notes" className={inputCls}
                    placeholder="Any additional context…"
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[13px] font-medium rounded-lg px-3 py-2.5"
              style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1 pb-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
