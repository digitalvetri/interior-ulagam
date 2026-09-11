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

function fromLead(lead: Lead): FormState {
  return {
    contactName:     lead.contactName ?? '',
    contactPhone:    lead.contactPhone ?? '',
    contactEmail:    lead.contactEmail ?? '',
    propertyType:    lead.propertyType ?? '',
    contactCity:     lead.contactCity ?? '',
    pincode:         lead.pincode ?? '',
    projectLocation: lead.projectLocation ?? '',
    source:          (lead.source as LeadSource) ?? 'whatsapp',
    priority:        (lead.priority as LeadPriority) ?? '',
    stage:           (lead.stage as LeadStage) ?? 'new',
    ownerId:         lead.ownerId ?? '',
    requirement:     lead.notes ?? '',
    expectedBudget:  lead.budgetBand ?? '',
    expectedStart:   '',
    notes:           '',
  };
}

interface NewLeadDialogProps {
  onSuccess: (lead: Lead) => void;
  defaultOpen?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  onClose?: () => void;
  preselectedCustomer?: {
    fullName: string;
    phone: string;
    city?: string | null;
  };
  // Edit mode
  editLead?: Lead;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

// ─── Options ──────────────────────────────────────────────────────────────────

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

const PROJECT_TYPE_OPTIONS = [
  'Design',
  'Architecture',
  'Construction',
  'Renovation',
];

const BUDGET_OPTIONS = [
  { value: 'under_5l',   label: 'Under ₹5 Lakhs'    },
  { value: '5l_10l',     label: '₹5L – ₹10L'        },
  { value: '10l_25l',    label: '₹10L – ₹25L'       },
  { value: '25l_50l',    label: '₹25L – ₹50L'       },
  { value: '50l_1cr',    label: '₹50L – ₹1 Crore'   },
  { value: 'above_1cr',  label: 'Above ₹1 Crore'    },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  // Contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  // Property / Site
  propertyType: string;
  contactCity: string;
  pincode: string;
  projectLocation: string;
  // Lead info
  source: LeadSource;
  priority: LeadPriority | '';
  stage: LeadStage | '';
  ownerId: string;
  // Project requirements
  requirement: string;
  expectedBudget: string;
  expectedStart: string;
  notes: string;
}

const INITIAL: FormState = {
  contactName:     '',
  contactPhone:    '',
  contactEmail:    '',
  propertyType:    '',
  contactCity:     '',
  pincode:         '',
  projectLocation: '',
  source:          'whatsapp',
  priority:        '',
  stage:           'new',
  ownerId:         '',
  requirement:     '',
  expectedBudget:  '',
  expectedStart:   '',
  notes:           '',
};

// ─── Helper components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
      style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

function Field({
  id, label, required, hint, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
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

export function NewLeadDialog({
  onSuccess, defaultOpen = false, triggerLabel, triggerClassName, onClose, preselectedCustomer,
  editLead, open: controlledOpen, onOpenChange: controlledOnOpenChange,
}: NewLeadDialogProps) {
  const isEditMode = !!editLead;

  const preselectedResult: CustomerResult | null = preselectedCustomer
    ? { id: '', fullName: preselectedCustomer.fullName, phone: preselectedCustomer.phone, email: null, city: preselectedCustomer.city ?? null, company: null }
    : null;

  const [open, setOpen]             = useState(defaultOpen);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>(
    isEditMode ? fromLead(editLead!)
    : preselectedCustomer
      ? { ...INITIAL, contactName: preselectedCustomer.fullName, contactPhone: preselectedCustomer.phone, contactCity: preselectedCustomer.city ?? '' }
      : INITIAL
  );
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Sync form when editLead changes (dialog re-opens with different lead)
  const effectiveOpen = isEditMode ? (controlledOpen ?? false) : open;
  useEffect(() => {
    if (isEditMode && controlledOpen && editLead) {
      setForm(fromLead(editLead));
      setError(null);
    }
  }, [isEditMode, controlledOpen, editLead]);

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
        setEmployees((data ?? []).filter(e => ['owner', 'admin', 'designer'].includes(e.role)));
      })
      .catch(() => {});
  }, [open]);

  // Debounced customer search
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

  // Close dropdown on outside click
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

    if (!form.contactName.trim()) { setError('Customer name is required.'); return; }
    if (!form.contactPhone.trim()) { setError('Mobile number is required.'); return; }
    if (!isEditMode && !form.source) { setError('Lead source is required.'); return; }
    if (!isEditMode && !form.ownerId) { setError('Please assign this lead to a team member.'); return; }
    if (!isEditMode && !form.requirement.trim()) { setError('Project requirement is required.'); return; }

    setSubmitting(true);
    setError(null);

    const combinedNotes = form.requirement.trim();

    const payload: Record<string, unknown> = {
      contactName:  form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      source:       form.source,
      notes:        combinedNotes,
    };

    if (!isEditMode) payload.ownerId = form.ownerId;
    else if (form.ownerId) payload.ownerId = form.ownerId;

    if (form.contactEmail.trim())    payload.contactEmail    = form.contactEmail.trim();
    if (form.propertyType)           payload.propertyType    = form.propertyType;
    if (form.contactCity.trim())     payload.contactCity     = form.contactCity.trim();
    if (form.pincode.trim())         payload.pincode         = form.pincode.trim();
    if (form.projectLocation.trim()) payload.projectLocation = form.projectLocation.trim();
    if (form.priority)               payload.priority        = form.priority;
    if (form.stage)                  payload.stage           = form.stage;
    if (form.expectedBudget)         payload.budgetBand      = form.expectedBudget;

    try {
      const url    = isEditMode ? `/api/v1/leads/${editLead!.id}` : '/api/v1/leads';
      const method = isEditMode ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const { data } = await res.json() as { data: Lead };
      onSuccess(data);
      if (isEditMode) {
        controlledOnOpenChange?.(false);
      } else {
        setOpen(false);
        reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'h-9 text-sm';
  const showForm = isEditMode || customerType === 'new' || (customerType === 'existing' && selectedCustomer !== null);

  function handleOpenChange(v: boolean) {
    if (isEditMode) {
      controlledOnOpenChange?.(v);
    } else {
      setOpen(v);
      if (!v) { reset(); onClose?.(); }
    }
  }

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      {!defaultOpen && (
        <DialogTrigger asChild>
          {triggerClassName ? (
            <button type="button" className={triggerClassName} suppressHydrationWarning>
              {triggerLabel ?? '+ New Lead'}
            </button>
          ) : (
            <Button suppressHydrationWarning>{triggerLabel ?? '+ New Lead'}</Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-[720px] w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
            {isEditMode ? 'Edit Lead' : preselectedCustomer ? 'Add New Enquiry' : 'New Lead'}
          </DialogTitle>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {isEditMode
              ? 'Update the lead details below.'
              : preselectedCustomer
                ? `Adding a new enquiry for ${preselectedCustomer.fullName}.`
                : 'Fill in the details below to capture the enquiry.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* ── Customer selection ── */}
          {preselectedCustomer ? (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-base)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                  {preselectedCustomer.fullName}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {preselectedCustomer.phone}{preselectedCustomer.city ? ` · ${preselectedCustomer.city}` : ''}
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--accent-base)', color: 'white' }}>
                Existing customer
              </span>
            </div>
          ) : !showForm ? (
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
              <SectionLabel>Is this a new or existing customer?</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {(['new', 'existing'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleCustomerTypeChange(type)}
                    className="rounded-lg px-4 py-3 text-left transition-all"
                    style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                      {type === 'new' ? 'New Customer' : 'Existing Customer'}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {type === 'new'
                        ? 'First-time enquiry from a new contact'
                        : 'Returning client or known contact'}
                    </p>
                  </button>
                ))}
              </div>

              {customerType === 'existing' && !selectedCustomer && (
                <div className="mt-4 relative" ref={searchRef}>
                  <Label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-heading)' }}>
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
                    <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>Searching…</p>
                  )}
                  {showDropdown && customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 rounded-lg shadow-lg mt-1 overflow-hidden"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', maxHeight: '13rem', overflowY: 'auto' }}>
                      {customerResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2.5 text-left transition-colors border-b last:border-b-0"
                          style={{ borderColor: 'var(--border-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => selectCustomer(c)}
                        >
                          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{c.fullName}</p>
                          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {c.phone}{c.city ? ` · ${c.city}` : ''}{c.company ? ` · ${c.company}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && !searchLoading && customerSearch.trim().length >= 2 && customerResults.length === 0 && (
                    <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                      No customers found. Try a different search or choose &quot;New Customer&quot;.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : customerType === 'existing' && selectedCustomer ? (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-base)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                  {selectedCustomer.fullName}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {selectedCustomer.phone}{selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSelectedCustomer}
                className="text-[12px] font-medium shrink-0 hover:underline"
                style={{ color: 'var(--accent-base)' }}
              >
                Change
              </button>
            </div>
          ) : null}

          {/* ── Remaining sections ── */}
          {showForm && (
            <>
              {/* ── 1. Contact Information ── */}
              <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                <SectionLabel>Contact Information</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                  <Field id="contactEmail" label="Email">
                    <Input id="contactEmail" type="email" className={inputCls}
                      placeholder="e.g. priya@email.com"
                      value={form.contactEmail}
                      onChange={e => set('contactEmail', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* ── 2. Property / Site ── */}
              <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                <SectionLabel>Property / Site</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field id="propertyType" label="Project Type">
                    <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
                      <SelectTrigger id="propertyType" className={inputCls}>
                        <SelectValue placeholder="Select type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPE_OPTIONS.map(pt => (
                          <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

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

                  <Field id="ownerId" label="Assigned To" required>
                    <Select value={form.ownerId} onValueChange={v => set('ownerId', v)}>
                      <SelectTrigger id="ownerId" className={inputCls}>
                        <SelectValue placeholder="Choose team member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

              {/* ── 3. Lead Information (edit mode only) ── */}
              {isEditMode && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                  <SectionLabel>Lead Information</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field id="ed-source" label="Lead Source">
                      <Select value={form.source} onValueChange={v => set('source', v as LeadSource)}>
                        <SelectTrigger id="ed-source" className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="ed-priority" label="Priority">
                      <Select value={form.priority} onValueChange={v => set('priority', v as LeadPriority)}>
                        <SelectTrigger id="ed-priority" className={inputCls}>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="ed-stage" label="Stage">
                      <Select value={form.stage} onValueChange={v => set('stage', v as LeadStage)}>
                        <SelectTrigger id="ed-stage" className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              )}

              {/* ── 4. Project Requirements ── */}
              <div className="rounded-xl p-5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                <SectionLabel>Project Requirements</SectionLabel>
                <div className="space-y-4">
                  <Field id="requirement" label="Requirement" required>
                    <Textarea
                      id="requirement"
                      placeholder="Describe what the client needs — e.g. Full home interior for 3BHK, modular kitchen, wardrobes for all rooms, false ceiling in living area…"
                      rows={3}
                      value={form.requirement}
                      onChange={e => set('requirement', e.target.value)}
                      className="text-sm resize-none"
                    />
                  </Field>

                  <Field id="expectedBudget" label="Expected Budget">
                    <Select value={form.expectedBudget} onValueChange={v => set('expectedBudget', v)}>
                      <SelectTrigger id="expectedBudget" className={inputCls}>
                        <SelectValue placeholder="Select range…" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>

              {error && (
                <p className="text-[13px] font-medium rounded-lg px-3 py-2.5" style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1 pb-1">
                <Button type="button" variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? (isEditMode ? 'Saving…' : 'Creating…')
                    : isEditMode ? 'Save Changes'
                    : preselectedCustomer ? 'Add Enquiry' : 'Create Lead'}
                </Button>
              </div>
            </>
          )}

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
