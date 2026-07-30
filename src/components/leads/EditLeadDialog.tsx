'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lead, LeadSource, LeadStage } from '@/types/leads';

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

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral',  label: 'Referral'  },
  { value: 'website',   label: 'Website'   },
  { value: 'walk_in',   label: 'Walk-in'   },
  { value: 'other',     label: 'Other'     },
];

// Won / Lost are terminal — use the dedicated stage-transition buttons on the lead detail page.
const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'new',                  label: 'New'           },
  { value: 'site_visit_scheduled', label: 'Site Visit'    },
  { value: 'consultation_done',    label: 'Consultation'  },
  { value: 'proposal_sent',        label: 'Proposal Sent' },
  { value: 'negotiation',          label: 'Negotiation'   },
];

const TERMINAL_STAGES = new Set<LeadStage>(['won', 'lost']);

const PROPERTY_TYPES = [
  'Residential – Apartment',
  'Residential – Villa / Independent House',
  'Residential – Duplex / Penthouse',
  'Commercial – Office',
  'Commercial – Retail / Showroom',
  'Commercial – Restaurant / Café',
  'Other',
];

interface FormState {
  contactName: string;
  contactPhone: string;
  alternatePhone: string;
  contactEmail: string;
  contactCity: string;
  pincode: string;
  projectLocation: string;
  projectName: string;
  propertyType: string;
  budgetBand: string;
  finalPriceRupees: string;
  source: LeadSource;
  stage: LeadStage;
  ownerId: string;
  notes: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider mb-3 mt-1" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

function Field({ id, label, required, children }: {
  id: string; label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: EditLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<FormState>({
    contactName:      lead.contactName ?? '',
    contactPhone:     lead.contactPhone ?? '',
    alternatePhone:   lead.alternatePhone ?? '',
    contactEmail:     lead.contactEmail ?? '',
    contactCity:      lead.contactCity ?? '',
    pincode:          lead.pincode ?? '',
    projectLocation:  lead.projectLocation ?? '',
    projectName:      lead.projectName ?? '',
    propertyType:     lead.propertyType ?? '',
    budgetBand:       lead.budgetBand ?? '',
    finalPriceRupees: lead.projectValuePaise ? Math.round(lead.projectValuePaise / 100).toString() : '',
    source:           lead.source ?? 'whatsapp',
    stage:            lead.stage ?? 'new',
    ownerId:          lead.ownerId ?? '',
    notes:            lead.notes ?? '',
  });

  // Sync form when lead prop changes
  useEffect(() => {
    if (open) {
      setForm({
        contactName:      lead.contactName ?? '',
        contactPhone:     lead.contactPhone ?? '',
        alternatePhone:   lead.alternatePhone ?? '',
        contactEmail:     lead.contactEmail ?? '',
        contactCity:      lead.contactCity ?? '',
        pincode:          lead.pincode ?? '',
        projectLocation:  lead.projectLocation ?? '',
        projectName:      lead.projectName ?? '',
        propertyType:     lead.propertyType ?? '',
        budgetBand:       lead.budgetBand ?? '',
        finalPriceRupees: lead.projectValuePaise ? Math.round(lead.projectValuePaise / 100).toString() : '',
        source:           lead.source ?? 'whatsapp',
        stage:            lead.stage ?? 'new',
        ownerId:          lead.ownerId ?? '',
        notes:            lead.notes ?? '',
      });
      setError(null);
    }
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(({ data }: { data?: Employee[] }) => {
        setEmployees((data ?? []).filter(e => e.role === 'owner' || e.role === 'designer'));
      })
      .catch(() => {});
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.contactName.trim() || !form.contactPhone.trim()) return;
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      contactName:  form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      source:       form.source,
      // Only include stage for non-terminal leads (terminal changes go through the /stage endpoint)
      ...(!TERMINAL_STAGES.has(lead.stage) ? { stage: form.stage } : {}),
    };
    if (form.alternatePhone.trim())  payload.alternatePhone  = form.alternatePhone.trim();
    if (form.contactEmail.trim())    payload.contactEmail    = form.contactEmail.trim();
    if (form.contactCity.trim())     payload.contactCity     = form.contactCity.trim();
    if (form.pincode.trim())         payload.pincode         = form.pincode.trim();
    if (form.projectLocation.trim()) payload.projectLocation = form.projectLocation.trim();
    if (form.projectName.trim())     payload.projectName     = form.projectName.trim();
    if (form.propertyType)           payload.propertyType    = form.propertyType;
    if (form.budgetBand.trim())      payload.budgetBand      = form.budgetBand.trim();
    if (form.ownerId)                payload.ownerId         = form.ownerId;
    if (form.notes.trim())           payload.notes           = form.notes.trim();
    // Final Price: always send so the server can update or clear it
    const finalPriceRupees = parseFloat(form.finalPriceRupees);
    payload.projectValuePaise = (form.finalPriceRupees.trim() && !isNaN(finalPriceRupees) && finalPriceRupees > 0)
      ? Math.round(finalPriceRupees * 100)
      : 0;

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

  const cls = 'h-9 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
            Edit Lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">

          {/* Contact Information */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Contact Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="e-contactName" label="Customer Name" required>
                <Input id="e-contactName" className={cls} value={form.contactName}
                  onChange={e => set('contactName', e.target.value)} required />
              </Field>
              <Field id="e-contactPhone" label="Mobile Number" required>
                <Input id="e-contactPhone" type="tel" className={cls} value={form.contactPhone}
                  onChange={e => set('contactPhone', e.target.value)} required />
              </Field>
              <Field id="e-alternatePhone" label="Alternate Mobile">
                <Input id="e-alternatePhone" type="tel" className={cls} value={form.alternatePhone}
                  onChange={e => set('alternatePhone', e.target.value)} />
              </Field>
              <Field id="e-contactEmail" label="Email Address">
                <Input id="e-contactEmail" type="email" className={cls} value={form.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Location</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="e-contactCity" label="City">
                <Input id="e-contactCity" className={cls} value={form.contactCity}
                  onChange={e => set('contactCity', e.target.value)} />
              </Field>
              <Field id="e-pincode" label="Pincode">
                <Input id="e-pincode" className={cls} value={form.pincode}
                  onChange={e => set('pincode', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="e-projectLocation" label="Site Address">
                  <Input id="e-projectLocation" className={cls} value={form.projectLocation}
                    onChange={e => set('projectLocation', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Project Details</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field id="e-projectName" label="Project Name">
                  <Input id="e-projectName" className={cls} value={form.projectName}
                    onChange={e => set('projectName', e.target.value)} />
                </Field>
              </div>
              <Field id="e-propertyType" label="Project Type">
                <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
                  <SelectTrigger id="e-propertyType" className={cls}>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="e-budgetBand" label="Budget Range">
                <Input id="e-budgetBand" className={cls} value={form.budgetBand}
                  onChange={e => set('budgetBand', e.target.value)}
                  placeholder="e.g. 10–20 lakhs" />
              </Field>
              <Field id="e-finalPrice" label="Final Price (₹)">
                <Input id="e-finalPrice" type="number" min="0" step="1" className={cls}
                  value={form.finalPriceRupees}
                  onChange={e => set('finalPriceRupees', e.target.value)}
                  placeholder="e.g. 1500000 for ₹15 lakhs" />
              </Field>
            </div>
          </div>

          {/* Lead Info */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Lead Info</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TERMINAL_STAGES.has(lead.stage) ? (
                <div className="sm:col-span-2">
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    Stage is <strong>{lead.stage}</strong>. Use the Mark as Won / Mark as Lost buttons on the lead page to change terminal stages.
                  </p>
                </div>
              ) : (
                <Field id="e-stage" label="Stage">
                  <Select value={form.stage} onValueChange={v => set('stage', v as LeadStage)}>
                    <SelectTrigger id="e-stage" className={cls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field id="e-source" label="Lead Source">
                <Select value={form.source} onValueChange={v => set('source', v as LeadSource)}>
                  <SelectTrigger id="e-source" className={cls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field id="e-ownerId" label="Assigned Sales Executive">
                  <Select value={form.ownerId} onValueChange={v => set('ownerId', v)}>
                    <SelectTrigger id="e-ownerId" className={cls}>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Notes</SectionLabel>
            <Textarea id="e-notes" rows={3} value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="text-sm resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
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
