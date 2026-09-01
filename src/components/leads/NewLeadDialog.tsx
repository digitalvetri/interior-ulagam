'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
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
import { Lead, LeadSource, LeadPriority, LeadStage } from '@/types/leads';

interface NewLeadDialogProps {
  onSuccess: (lead: Lead) => void;
  defaultOpen?: boolean;
  triggerLabel?: string;
  onClose?: () => void;
  preselectedCustomer?: {
    fullName: string;
    phone: string;
    city?: string | null;
  };
}

interface Employee {
  id: string;
  fullName: string;
  role: string;
}

interface CustomerResult {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  city: string | null;
  company: string | null;
}

type CustomerType = 'new' | 'existing';

const PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: 'hot',  label: 'Hot — High urgency, likely to convert soon' },
  { value: 'warm', label: 'Warm — Interested but not yet urgent' },
  { value: 'cold', label: 'Cold — Early stage or low engagement' },
];

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'new',         label: 'New' },
  { value: 'contacted',   label: 'Contacted' },
  { value: 'qualified',   label: 'Qualified' },
  { value: 'site_visit',  label: 'Site Visit' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'quotation',   label: 'Quotation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won',         label: 'Won' },
  { value: 'lost',        label: 'Lost' },
];

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
  source: LeadSource;
  priority: LeadPriority | '';
  stage: LeadStage | '';
  ownerId: string;
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
  priority:        '',
  stage:           'new',
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

export function NewLeadDialog({ onSuccess, defaultOpen = false, triggerLabel, onClose, preselectedCustomer }: NewLeadDialogProps) {
  const preselectedResult: CustomerResult | null = preselectedCustomer
    ? { id: '', fullName: preselectedCustomer.fullName, phone: preselectedCustomer.phone, email: null, city: preselectedCustomer.city ?? null, company: null }
    : null;

  const [open, setOpen]               = useState(defaultOpen);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [form, setForm]               = useState<FormState>(
    preselectedCustomer
      ? { ...INITIAL, contactName: preselectedCustomer.fullName, contactPhone: preselectedCustomer.phone, contactCity: preselectedCustomer.city ?? '' }
      : INITIAL
  );
  const [employees, setEmployees]     = useState<Employee[]>([]);

  // Customer type gate
  const [customerType, setCustomerType]         = useState<CustomerType | null>(preselectedCustomer ? 'existing' : null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [customerResults, setCustomerResults]   = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(preselectedResult);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [showDropdown, setShowDropdown]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(({ data }: { data?: Employee[] }) => {
        setEmployees((data ?? []).filter(e => e.role === 'owner' || e.role === 'designer'));
      })
      .catch(() => {});
  }, [open]);

  // Debounced customer search — fires when query ≥ 2 chars
  useEffect(() => {
    if (customerType !== 'existing' || customerSearch.trim().length < 2) {
      setCustomerResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/v1/customers?q=${encodeURIComponent(customerSearch.trim())}`);
        const { data } = await res.json() as { data?: CustomerResult[] };
        setCustomerResults(data ?? []);
        setShowDropdown(true);
      } catch {
        setCustomerResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectCustomer(c: CustomerResult) {
    setSelectedCustomer(c);
    setCustomerSearch('');
    setCustomerResults([]);
    setShowDropdown(false);
    setForm(prev => ({
      ...prev,
      contactName:  c.fullName,
      contactPhone: c.phone,
      contactEmail: c.email ?? '',
      contactCity:  c.city ?? '',
    }));
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setForm(INITIAL);
  }

  function handleCustomerTypeChange(type: CustomerType) {
    setCustomerType(type);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setShowDropdown(false);
    setForm(INITIAL);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (preselectedCustomer) {
      setForm({ ...INITIAL, contactName: preselectedCustomer.fullName, contactPhone: preselectedCustomer.phone, contactCity: preselectedCustomer.city ?? '' });
      setCustomerType('existing');
      setSelectedCustomer(preselectedResult);
    } else {
      setForm(INITIAL);
      setCustomerType(null);
      setSelectedCustomer(null);
    }
    setError(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setShowDropdown(false);
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
    if (form.priority)               payload.priority        = form.priority;
    if (form.stage)                  payload.stage           = form.stage;
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
  const showForm = customerType === 'new' || (customerType === 'existing' && selectedCustomer !== null);

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { reset(); onClose?.(); } }}>
      {!defaultOpen && (
        <DialogTrigger asChild>
          <Button suppressHydrationWarning>{triggerLabel ?? '+ New Lead'}</Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
            {preselectedCustomer ? 'Add New Enquiry' : 'Add New Lead'}
          </DialogTitle>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {preselectedCustomer
              ? `Adding a new enquiry for ${preselectedCustomer.fullName}.`
              : 'Capture all enquiry details upfront to avoid repeat data entry later.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">

          {/* ── 0. Customer — read-only when preselected, type selector otherwise ── */}
          {preselectedCustomer ? (
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
              <SectionLabel>Customer</SectionLabel>
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'var(--brand-light, #eef2ff)', border: '1px solid var(--brand, #6366f1)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                    {preselectedCustomer.fullName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {preselectedCustomer.phone}{preselectedCustomer.city ? ` · ${preselectedCustomer.city}` : ''}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                  Existing Customer
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
              <SectionLabel>Customer Type</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {(['new', 'existing'] as const).map(type => {
                  const isSelected = customerType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleCustomerTypeChange(type)}
                      className="rounded-lg px-4 py-3 text-left transition-all"
                      style={{
                        border: isSelected ? '2px solid var(--brand, #6366f1)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'var(--brand-light, #eef2ff)' : 'var(--surface-base, white)',
                      }}
                    >
                      <p className="text-sm font-semibold" style={{ color: isSelected ? 'var(--brand, #6366f1)' : 'var(--text-heading)' }}>
                        {type === 'new' ? 'New Customer' : 'Existing Customer'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {type === 'new'
                          ? 'First-time enquiry from a new contact'
                          : 'Returning client or known contact'}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Existing customer search */}
              {customerType === 'existing' && !selectedCustomer && (
                <div className="mt-4 relative" ref={searchRef}>
                  <Label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-heading)' }}>
                    Search Customer
                  </Label>
                  <Input
                    autoFocus
                    className={inputCls}
                    placeholder="Type name, phone, or email…"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                  />
                  {searchLoading && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Searching…</p>
                  )}
                  {showDropdown && customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 rounded-lg shadow-lg mt-1 overflow-hidden"
                      style={{ background: 'var(--surface-base, white)', border: '1px solid var(--border-subtle)', maxHeight: '13rem', overflowY: 'auto' }}>
                      {customerResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2.5 text-left hover:bg-[var(--surface-muted)] transition-colors border-b last:border-b-0"
                          style={{ borderColor: 'var(--border-subtle)' }}
                          onClick={() => selectCustomer(c)}
                        >
                          <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{c.fullName}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {c.phone}{c.city ? ` · ${c.city}` : ''}{c.company ? ` · ${c.company}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && !searchLoading && customerSearch.trim().length >= 2 && customerResults.length === 0 && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                      No customers found. Try a different search or choose &quot;New Customer&quot;.
                    </p>
                  )}
                </div>
              )}

              {/* Selected customer chip */}
              {customerType === 'existing' && selectedCustomer && (
                <div className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--brand-light, #eef2ff)', border: '1px solid var(--brand, #6366f1)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                      {selectedCustomer.fullName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {selectedCustomer.phone}{selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedCustomer}
                    className="text-xs font-medium shrink-0 hover:underline"
                    style={{ color: 'var(--brand, #6366f1)' }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Remaining form sections (shown only after type + customer selection) ── */}
          {showForm && (
            <>
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

                  <Field id="priority" label="Lead Priority">
                    <Select value={form.priority} onValueChange={v => set('priority', v as LeadPriority)}>
                      <SelectTrigger id="priority" className={inputCls}>
                        <SelectValue placeholder="Select priority…" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field id="stage" label="Lead Stage">
                    <Select value={form.stage} onValueChange={v => set('stage', v as LeadStage)}>
                      <SelectTrigger id="stage" className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_OPTIONS.map(o => (
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
                  {submitting ? 'Creating…' : preselectedCustomer ? 'Add Enquiry' : 'Create Lead'}
                </Button>
              </div>
            </>
          )}

          {/* Cancel button visible before type is selected */}
          {!showForm && (
            <div className="flex justify-end pt-1">
              <Button type="button" variant="outline"
                onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
            </div>
          )}

        </form>
      </DialogContent>
    </Dialog>
  );
}
