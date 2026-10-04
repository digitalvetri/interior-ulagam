'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { CivilBranchCard, CivilCity } from './types';
import { Field } from './StatusActionDialog';
import { apiError } from './format';

interface Props {
  open: boolean;
  companyId: string;
  branch?: CivilBranchCard;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = { name: '', city: '', address: '', contactName: '', contactPhone: '' };

export function BranchDialog({ open, companyId, branch, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [cities, setCities] = useState<CivilCity[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(branch ? {
      name: branch.name, city: branch.cityName, address: branch.address ?? '',
      contactName: branch.contactName ?? '', contactPhone: branch.contactPhone ?? '',
    } : EMPTY);
    setError(null);
    fetch('/api/v1/civil/cities')
      .then(r => r.json() as Promise<{ data?: CivilCity[] }>)
      .then(j => setCities(j.data ?? []))
      .catch(() => setCities([]));
  }, [open, branch]);

  async function save() {
    if (!form.name.trim()) { setError('Branch name is required.'); return; }
    if (!form.city.trim()) { setError('Pick a city or type a new one.'); return; }
    const match = cities.find(c => c.name.toLowerCase() === form.city.trim().toLowerCase());
    const body = {
      companyId,
      ...(match ? { cityId: match.id } : { cityName: form.city.trim() }),
      name: form.name.trim(),
      address: form.address,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
    };
    setSaving(true); setError(null);
    try {
      const res = await fetch(branch ? `/api/v1/civil/branches/${branch.id}` : '/api/v1/civil/branches', {
        method: branch ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(await apiError(res, 'Failed to save branch.')); return; }
      onSaved();
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const isNewCity = form.city.trim() !== '' &&
    !cities.some(c => c.name.toLowerCase() === form.city.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{branch ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4 py-2" onSubmit={e => { e.preventDefault(); void save(); }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Branch name" required>
              <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Singanallur"
                className="studio-input h-9 w-full text-sm" />
            </Field>
            <Field label="City" required>
              <input value={form.city} onChange={set('city')} list="civil-city-options" placeholder="e.g. Coimbatore"
                className="studio-input h-9 w-full text-sm" />
              <datalist id="civil-city-options">
                {cities.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              {isNewCity && (
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  New city — it will be added for every company.
                </p>
              )}
            </Field>
          </div>
          <Field label="Address">
            <textarea rows={2} value={form.address} onChange={set('address')} placeholder="Store address"
              className="studio-input w-full text-sm resize-none" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact person">
              <input value={form.contactName} onChange={set('contactName')} placeholder="Store manager"
                className="studio-input h-9 w-full text-sm" />
            </Field>
            <Field label="Contact phone">
              <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+91 98765 43210"
                className="studio-input h-9 w-full text-sm" />
            </Field>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : branch ? 'Save changes' : 'Add branch'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
