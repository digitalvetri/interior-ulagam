'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lead } from '@/types/leads';

interface ProjectDetailsDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: Lead) => void;
}

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
  projectName: string;
  propertyType: string;
  budgetBand: string;
  finalPriceRupees: string;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ProjectDetailsDialog({ lead, open, onOpenChange, onSuccess }: ProjectDetailsDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    projectName:      lead.projectName ?? '',
    propertyType:     lead.propertyType ?? '',
    budgetBand:       lead.budgetBand ?? '',
    finalPriceRupees: lead.projectValuePaise ? Math.round(lead.projectValuePaise / 100).toString() : '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        projectName:      lead.projectName ?? '',
        propertyType:     lead.propertyType ?? '',
        budgetBand:       lead.budgetBand ?? '',
        finalPriceRupees: lead.projectValuePaise ? Math.round(lead.projectValuePaise / 100).toString() : '',
      });
      setError(null);
    }
  }, [open, lead]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const finalPriceRupees = parseFloat(form.finalPriceRupees);
    const payload: Record<string, unknown> = {
      projectName:       form.projectName.trim() || null,
      propertyType:      form.propertyType || null,
      budgetBand:        form.budgetBand.trim() || null,
      projectValuePaise: (form.finalPriceRupees.trim() && !isNaN(finalPriceRupees) && finalPriceRupees > 0)
        ? Math.round(finalPriceRupees * 100)
        : 0,
    };

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
            Project Details
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <Field id="pd-projectName" label="Project Name">
            <Input id="pd-projectName" className={cls} value={form.projectName}
              onChange={e => set('projectName', e.target.value)}
              placeholder="e.g. Sharma Residence" />
          </Field>

          <Field id="pd-propertyType" label="Project Type">
            <Select value={form.propertyType} onValueChange={v => set('propertyType', v)}>
              <SelectTrigger id="pd-propertyType" className={cls}>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="pd-budgetBand" label="Budget Range">
              <Input id="pd-budgetBand" className={cls} value={form.budgetBand}
                onChange={e => set('budgetBand', e.target.value)}
                placeholder="e.g. 10–20 lakhs" />
            </Field>
            <Field id="pd-finalPrice" label="Final Price (₹)">
              <Input id="pd-finalPrice" type="number" min="0" step="1" className={cls}
                value={form.finalPriceRupees}
                onChange={e => set('finalPriceRupees', e.target.value)}
                placeholder="e.g. 1500000" />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
