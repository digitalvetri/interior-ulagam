'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Pencil, Plus, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { CivilManager } from './types';
import { apiError } from './format';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Managers are just names on jobs (no login). Deactivate instead of delete, so old jobs keep the name. */
export function ManagersDialog({ open, onClose }: Props) {
  const [managers, setManagers] = useState<CivilManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch('/api/v1/civil/managers').then(r => r.json()) as { data?: CivilManager[] };
      setManagers(j.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null); setEditing(null); setNewName(''); setNewPhone('');
    void load();
  }, [open, load]);

  async function add() {
    if (!newName.trim()) { setError('Enter the manager’s name.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/civil/managers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      });
      if (!res.ok) { setError(await apiError(res, 'Failed to add manager.')); return; }
      setNewName(''); setNewPhone('');
      await load();
    } catch { setError('Network error.'); }
    finally { setBusy(false); }
  }

  async function update(m: CivilManager, patch: Partial<Pick<CivilManager, 'name' | 'phone' | 'active'>>) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/v1/civil/managers/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: m.name, phone: m.phone ?? '', active: m.active, ...patch }),
      });
      if (!res.ok) { setError(await apiError(res, 'Failed to update manager.')); return; }
      setEditing(null);
      await load();
    } catch { setError('Network error.'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Managers</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          The site managers you assign to jobs. They don&apos;t need a login.
        </p>

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); void add(); }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name, e.g. Depak"
            className="studio-input h-9 flex-1 text-sm" />
          <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone (optional)"
            className="studio-input h-9 text-sm sm:w-40" />
          <button type="submit" disabled={busy} className="btn-primary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50">
            <Plus className="h-4 w-4" strokeWidth={2.25} />Add
          </button>
        </form>

        <div className="max-h-72 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          {loading ? (
            <div className="space-y-2 p-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 w-full rounded" />)}
            </div>
          ) : managers.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No managers yet.</p>
          ) : managers.map((m, idx) => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: idx < managers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              {editing?.id === m.id ? (
                <form className="flex flex-1 items-center gap-2"
                  onSubmit={e => { e.preventDefault(); void update(m, { name: editing.name.trim(), phone: editing.phone.trim() }); }}>
                  <input autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="studio-input h-8 flex-1 text-sm" />
                  <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="Phone" className="studio-input h-8 w-32 text-sm" />
                  <button type="submit" disabled={busy} className="rounded-lg p-1.5 hover:bg-[var(--surface-muted)]" title="Save">
                    <Check className="h-4 w-4" style={{ color: 'var(--success)' }} />
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 hover:bg-[var(--surface-muted)]" title="Cancel">
                    <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold"
                      style={{ color: m.active ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                      {m.name}{!m.active && ' (inactive)'}
                    </p>
                    {m.phone && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.phone}</p>}
                  </div>
                  <button type="button" onClick={() => setEditing({ id: m.id, name: m.name, phone: m.phone ?? '' })}
                    className="rounded-lg p-1.5 hover:bg-[var(--surface-muted)]" title="Rename">
                    <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button type="button" disabled={busy} onClick={() => void update(m, { active: !m.active })}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                    {m.active ? 'Deactivate' : 'Activate'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
          </div>
        )}

        <DialogFooter>
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Done</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
