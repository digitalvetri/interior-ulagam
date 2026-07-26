'use client';

import { useState, FormEvent } from 'react';
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
}

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
];

export function NewLeadDialog({ onSuccess }: NewLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('whatsapp');
  const [budgetBand, setBudgetBand] = useState('');
  const [notes, setNotes] = useState('');

  function resetForm() {
    setContactName('');
    setContactPhone('');
    setSource('whatsapp');
    setBudgetBand('');
    setNotes('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      source,
      budgetBand: budgetBand.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const { data } = (await res.json()) as { data: Lead };
      onSuccess(data);
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>+ New Lead</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="contactName">Contact Name <span className="text-red-500">*</span></Label>
            <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Priya Sharma" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactPhone">Phone <span className="text-red-500">*</span></Label>
            <Input id="contactPhone" type="tel" value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="e.g. 9876543210" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
              <SelectTrigger id="source"><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="budgetBand">Budget Range</Label>
            <Input id="budgetBand" value={budgetBand} onChange={(e) => setBudgetBand(e.target.value)}
              placeholder="e.g. 5L–10L or 50k–1L" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context..." rows={3} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline"
              onClick={() => { setOpen(false); resetForm(); }} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
