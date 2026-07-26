'use client';

import { useState, type FormEvent } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, CustomerSource } from '@/types/customers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}

const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'referral',  label: 'Referral'   },
  { value: 'instagram', label: 'Instagram'  },
  { value: 'whatsapp',  label: 'WhatsApp'   },
  { value: 'website',   label: 'Website'    },
  { value: 'walk_in',   label: 'Walk-in'    },
  { value: 'imported',  label: 'Imported'   },
  { value: 'other',     label: 'Other'      },
];

export function NewCustomerDialog({ open, onOpenChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<CustomerSource>('referral');
  const [notes, setNotes] = useState('');

  function reset() {
    setFullName(''); setPhone(''); setEmail(''); setCompany('');
    setCity(''); setSource('referral'); setNotes(''); setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          city: city.trim() || undefined,
          source,
          notes: notes.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);

      onCreated(body.data as Customer);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create customer</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-name">Full name *</Label>
              <Input id="cf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">Phone *</Label>
              <Input id="cf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-email">Email</Label>
              <Input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-company">Company</Label>
              <Input id="cf-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-city">City</Label>
              <Input id="cf-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-source">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as CustomerSource)}>
                <SelectTrigger id="cf-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cf-notes">Notes</Label>
              <Textarea id="cf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !fullName.trim() || !phone.trim()}>
              {submitting ? 'Creating…' : 'Create customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
