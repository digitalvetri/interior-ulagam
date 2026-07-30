'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lead, LeadSource } from '@/types/leads';

interface NewLeadDialogProps {
  onSuccess: (lead: Lead) => void;
  defaultOpen?: boolean;
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
  // Contact
  contactName: string;
  contactPhone: string;
  alternatePhone: string;
  contactEmail: string;
  // Location
  contactCity: string;
  pincode: string;
  projectLocation: string;
  // Project
  projectName: string;
  propertyType: string;
  // Lead
  budgetBand: string;
  source: LeadSource;
  ownerId: string;
  // Notes
  notes: string;
}

const INITIAL: FormState = {
  contactName:     '',
  contactPhone:    '',
  alternatePhone:  '',
  contactEmail:    '',
  contactCity:     '',
  pincode:         '',
  projectLocation: '',
  projectName:     '',
  propertyType:    '',
  budgetBand:      '',
  source:          'whatsapp',
  ownerId:         '',
  notes:           '',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider mb-3 mt-1"
      style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

function Field({
  id, label, required, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
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

export function NewLeadDialog({ onSuccess, defaultOpen = false }: NewLeadDialogProps) {
  const [open, setOpen]           = useState(defaultOpen);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(INITIAL);
  const [employees, setEmployees] = useState<Employee[]>([]);

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

  function reset() {
    setForm(INITIAL);
    setError(null);
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

    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const { data } = await res.json() as { data: Lead };
      onSuccess(data);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'h-9 text-sm';

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>+ New Lead</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
            Add New Lead
          </DialogTitle>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Capture all enquiry details upfront to avoid repeat data entry later.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">

          {/* ── 1. Contact Information ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Contact Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="contactName" label="Customer Name" required>
                <Input id="contactName" className={inputCls}
                  placeholder="e.g. Priya Sharma"
                  value={form.contactName}
                  onChange={e => set('contactName', e.target.value)}
                  required />
              </Field>

              <Field id="contactPhone" label="Mobile Number" required>
                <Input id="contactPhone" type="tel" className={inputCls}
                  placeholder="e.g. 9876543210"
                  value={form.contactPhone}
                  onChange={e => set('contactPhone', e.target.value)}
                  required />
              </Field>

              <Field id="alternatePhone" label="Alternate Mobile">
                <Input id="alternatePhone" type="tel" className={inputCls}
                  placeholder="e.g. 9123456789"
                  value={form.alternatePhone}
                  onChange={e => set('alternatePhone', e.target.value)} />
              </Field>

              <Field id="contactEmail" label="Email Address">
                <Input id="contactEmail" type="email" className={inputCls}
                  placeholder="e.g. priya@email.com"
                  value={form.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── 2. Location ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Location</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="contactCity" label="City">
                <Input id="contactCity" className={inputCls}
                  placeholder="e.g. Coimbatore"
                  value={form.contactCity}
                  onChange={e => set('contactCity', e.target.value)} />
              </Field>

              <Field id="pincode" label="Pincode">
                <Input id="pincode" className={inputCls}
                  placeholder="e.g. 641001"
                  value={form.pincode}
                  onChange={e => set('pincode', e.target.value)} />
              </Field>

              <div className="sm:col-span-2">
                <Field id="projectLocation" label="Site Address">
                  <Input id="projectLocation" className={inputCls}
                    placeholder="Full site / property address"
                    value={form.projectLocation}
                    onChange={e => set('projectLocation', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {/* ── 3. Project Details ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Project Details</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field id="projectName" label="Project Name">
                  <Input id="projectName" className={inputCls}
                    placeholder="e.g. Sharma Residence – 3BHK"
                    value={form.projectName}
                    onChange={e => set('projectName', e.target.value)} />
                </Field>
              </div>

              <Field id="propertyType" label="Project Type">
                <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
                  <SelectTrigger id="propertyType" className={inputCls}>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="budgetBand" label="Budget Range">
                <Input id="budgetBand" className={inputCls}
                  placeholder="e.g. 15L–20L"
                  value={form.budgetBand}
                  onChange={e => set('budgetBand', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── 4. Lead Info ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Lead Info</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="source" label="Lead Source" required>
                <Select value={form.source} onValueChange={v => set('source', v as LeadSource)}>
                  <SelectTrigger id="source" className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="ownerId" label="Assigned Sales Executive">
                <Select value={form.ownerId} onValueChange={v => set('ownerId', v)}>
                  <SelectTrigger id="ownerId" className={inputCls}>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* ── 5. Requirements & Notes ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
            <SectionLabel>Project Requirements &amp; Notes</SectionLabel>
            <Textarea
              id="notes"
              placeholder="Client's requirements, style preferences, referral context, site visit preference, expected start date, or any other relevant details…"
              rows={4}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline"
              onClick={() => { setOpen(false); reset(); }}
              disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
