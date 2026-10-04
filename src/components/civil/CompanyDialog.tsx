'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { CivilCompany, CivilCompanyDetail } from './types';
import { Field } from './StatusActionDialog';
import { apiError } from './format';

interface Props {
  open: boolean;
  company?: CivilCompany | CivilCompanyDetail;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = { name: '', gstin: '', address: '', contactName: '', contactPhone: '', notes: '' };

export function CompanyDialog({ open, company, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(company ? {
      name: company.name, gstin: company.gstin ?? '', address: company.address ?? '',
      contactName: company.contactName ?? '', contactPhone: company.contactPhone ?? '', notes: company.notes ?? '',
    } : EMPTY);
    setError(null);
  }, [open, company]);

  async function save() {
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(company ? `/api/v1/civil/companies/${company.id}` : '/api/v1/civil/companies', {
        method: company ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError(await apiError(res, 'Failed to save company.')); return; }
      onSaved();
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company ? 'Edit Company' : 'Add Company'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4 py-2" onSubmit={e => { e.preventDefault(); void save(); }}>
          <Field label="Company name" required>
            <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. D-Mart"
              className="studio-input h-9 w-full text-sm" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GSTIN">
              <input value={form.gstin} onChange={set('gstin')} placeholder="33AAAAA0000A1Z5"
                className="studio-input h-9 w-full text-sm font-mono" />
            </Field>
            <Field label="Contact phone">
              <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+91 98765 43210"
                className="studio-input h-9 w-full text-sm" />
            </Field>
          </div>
          <Field label="Contact person">
            <input value={form.contactName} onChange={set('contactName')} placeholder="Facility manager name"
              className="studio-input h-9 w-full text-sm" />
          </Field>
          <Field label="Billing address">
            <textarea rows={2} value={form.address} onChange={set('address')} placeholder="Head office / billing address"
              className="studio-input w-full text-sm resize-none" />
          </Field>
          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Contract terms, billing contact…"
              className="studio-input w-full text-sm resize-none" />
          </Field>
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : company ? 'Save changes' : 'Add company'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
