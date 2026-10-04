'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { responseError, NETWORK_ERROR } from '@/lib/client-feedback';
import { VENDOR_CATEGORY_MAX, type VendorCategory } from '@/lib/vendor-categories';

/* ── Data hook ─────────────────────────────────────────────────────────────── */

export function useVendorCategories() {
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [canManage,  setCanManage]  = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/vendor-categories');
      if (!res.ok) { setLoadError(await responseError(res, 'Could not load vendor categories.')); return; }
      const json = await res.json() as { data?: VendorCategory[]; canManage?: boolean };
      setCategories(json.data ?? []);
      setCanManage(json.canManage === true);
      setLoadError(null);
    } catch {
      setLoadError(NETWORK_ERROR);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { categories, setCategories, canManage, loadError, reload };
}

async function createCategory(name: string): Promise<{ data?: VendorCategory; error?: string }> {
  try {
    const res = await fetch('/api/v1/vendor-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    if (!res.ok) return { error: await responseError(res, 'Could not add the category.') };
    const json = await res.json() as { data: VendorCategory };
    return { data: json.data };
  } catch {
    return { error: NETWORK_ERROR };
  }
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{message}
    </div>
  );
}

/* ── Select with inline "+ Add category…" ──────────────────────────────────── */

const ADD_NEW = '__add_new__';

export function VendorCategorySelect({
  value, onChange, categories, onCreated,
}: {
  value: string;
  onChange: (name: string) => void;
  categories: VendorCategory[];
  onCreated: (cat: VendorCategory) => void;
}) {
  const [adding,  setAdding]  = useState(false);
  const [draft,   setDraft]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // A vendor may carry a name that is no longer in the list; keep it selectable.
  const known = categories.some(c => c.name === value);

  async function save() {
    const name = draft.trim();
    if (!name) { setError('Enter a category name.'); return; }
    setBusy(true); setError(null);
    const { data, error: err } = await createCategory(name);
    setBusy(false);
    if (!data) { setError(err ?? 'Could not add the category.'); return; }
    onCreated(data);
    onChange(data.name);
    setAdding(false); setDraft('');
  }

  if (adding) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input type="text" autoFocus value={draft} maxLength={VENDOR_CATEGORY_MAX}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void save(); }
              if (e.key === 'Escape') { e.preventDefault(); setAdding(false); setError(null); }
            }}
            placeholder="New category" className="studio-input h-9 w-full text-sm" />
          <button type="button" onClick={() => void save()} disabled={busy} aria-label="Save category"
            className="btn-primary h-9 px-2.5 text-sm disabled:opacity-50">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setAdding(false); setError(null); }} disabled={busy}
            aria-label="Cancel" className="btn-secondary h-9 px-2.5 text-sm">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <ErrorLine message={error} />}
      </div>
    );
  }

  return (
    <select value={value}
      onChange={e => {
        if (e.target.value === ADD_NEW) { setAdding(true); setDraft(''); setError(null); return; }
        onChange(e.target.value);
      }}
      className="studio-input h-9 w-full text-sm">
      <option value="">No category</option>
      {value && !known && <option value={value}>{value}</option>}
      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
      <option value={ADD_NEW}>+ Add category…</option>
    </select>
  );
}

/* ── Manage categories dialog ──────────────────────────────────────────────── */

export function ManageVendorCategoriesDialog({
  open, onOpenChange, categories, canManage, onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: VendorCategory[];
  canManage: boolean;
  /** Called after any change so the page can reload categories and vendors. */
  onChanged: () => void | Promise<void>;
}) {
  const [newName,   setNewName]   = useState('');
  const [adding,    setAdding]    = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editName,  setEditName]  = useState('');
  const [rowBusy,   setRowBusy]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [notice,    setNotice]    = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<VendorCategory | null>(null);
  const [reassignTo,   setReassignTo]   = useState('');
  const [deleteBusy,   setDeleteBusy]   = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  function reset() {
    setNewName(''); setEditId(null); setError(null); setNotice(null);
  }

  async function add() {
    const name = newName.trim();
    if (!name) { setError('Enter a category name.'); return; }
    setAdding(true); setError(null); setNotice(null);
    const { data, error: err } = await createCategory(name);
    setAdding(false);
    if (!data) { setError(err ?? 'Could not add the category.'); return; }
    setNewName('');
    await onChanged();
  }

  async function rename(cat: VendorCategory) {
    const name = editName.trim();
    if (!name) { setError('Enter a category name.'); return; }
    if (name === cat.name) { setEditId(null); return; }
    setRowBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/v1/vendor-categories/${cat.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError(await responseError(res, 'Could not rename the category.')); return; }
      const json = await res.json() as { vendorsUpdated?: number };
      const n = json.vendorsUpdated ?? 0;
      setNotice(n > 0 ? `Renamed — ${n} vendor${n === 1 ? '' : 's'} updated.` : 'Renamed.');
      setEditId(null);
      await onChanged();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setRowBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const qs = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
      const res = await fetch(`/api/v1/vendor-categories/${deleteTarget.id}${qs}`, { method: 'DELETE' });
      if (!res.ok) { setDeleteError(await responseError(res, 'Could not delete the category.')); return; }
      const json = await res.json() as { data?: { moved: number; cleared: number; reassignedTo: string | null } };
      const d = json.data;
      setNotice(
        d && d.moved > 0 ? `Deleted "${deleteTarget.name}" — ${d.moved} vendor${d.moved === 1 ? '' : 's'} moved to ${d.reassignedTo}.`
        : d && d.cleared > 0 ? `Deleted "${deleteTarget.name}" — ${d.cleared} vendor${d.cleared === 1 ? '' : 's'} now uncategorised.`
        : `Deleted "${deleteTarget.name}".`,
      );
      setDeleteTarget(null);
      await onChanged();
    } catch {
      setDeleteError(NETWORK_ERROR);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open && !deleteTarget} onOpenChange={o => { if (!o) { reset(); onOpenChange(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vendor categories</DialogTitle></DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex items-center gap-1.5">
              <input type="text" value={newName} maxLength={VENDOR_CATEGORY_MAX}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
                placeholder="New category, e.g. Glass & Mirror" className="studio-input h-9 w-full text-sm" />
              <button type="button" onClick={() => void add()} disabled={adding}
                className="btn-primary inline-flex items-center gap-1 h-9 px-3 text-sm whitespace-nowrap disabled:opacity-50">
                <Plus className="h-4 w-4" />{adding ? 'Adding…' : 'Add'}
              </button>
            </div>

            {error && <ErrorLine message={error} />}
            {notice && (
              <p className="text-xs rounded-lg px-3 py-2"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>{notice}</p>
            )}

            <ul className="max-h-80 overflow-y-auto rounded-xl border divide-y"
              style={{ borderColor: 'var(--border-subtle)' }}>
              {categories.length === 0 && (
                <li className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No categories yet.
                </li>
              )}
              {categories.map(c => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2"
                  style={{ borderColor: 'var(--border-subtle)' }}>
                  {editId === c.id ? (
                    <>
                      <input type="text" autoFocus value={editName} maxLength={VENDOR_CATEGORY_MAX}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); void rename(c); }
                          if (e.key === 'Escape') { e.preventDefault(); setEditId(null); }
                        }}
                        className="studio-input h-8 w-full text-sm" />
                      <button type="button" onClick={() => void rename(c)} disabled={rowBusy} aria-label="Save name"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] disabled:opacity-50">
                        <Check className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                      </button>
                      <button type="button" onClick={() => setEditId(null)} disabled={rowBusy} aria-label="Cancel rename"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)]">
                        <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-heading)' }}>{c.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                        {c.vendorCount} vendor{c.vendorCount === 1 ? '' : 's'}
                      </span>
                      {canManage && (
                        <>
                          <button type="button" aria-label={`Rename ${c.name}`}
                            onClick={() => { setEditId(c.id); setEditName(c.name); setError(null); setNotice(null); }}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)]">
                            <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                          </button>
                          <button type="button" aria-label={`Delete ${c.name}`}
                            onClick={() => { setDeleteTarget(c); setReassignTo(''); setDeleteError(null); setNotice(null); }}
                            className="p-1.5 rounded-lg hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {!canManage && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Only the studio owner can rename or delete categories.
              </p>
            )}
          </div>

          <DialogFooter>
            <button type="button" onClick={() => { reset(); onOpenChange(false); }} className="btn-secondary px-4 py-2 text-sm">
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o && !deleteBusy) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete category?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{deleteTarget?.name}</span>
              {deleteTarget && deleteTarget.vendorCount > 0
                ? <> is used by {deleteTarget.vendorCount} vendor{deleteTarget.vendorCount === 1 ? '' : 's'}.</>
                : <> is not used by any vendor.</>}
            </p>
            {deleteTarget && deleteTarget.vendorCount > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Move those vendors to
                </label>
                <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">No category (leave uncategorised)</option>
                  {categories.filter(c => c.id !== deleteTarget.id).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {deleteError && <ErrorLine message={deleteError} />}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}
              className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={() => void confirmDelete()} disabled={deleteBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Deleting…' : 'Delete category'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
