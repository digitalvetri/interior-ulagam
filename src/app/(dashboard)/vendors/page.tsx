'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Store, AlertTriangle, Trash2, Tags } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { responseError, NETWORK_ERROR } from '@/lib/client-feedback';
import { useUser } from '@/components/providers/user-provider';
import { categoryBadge } from '@/lib/vendor-categories';
import {
  useVendorCategories, VendorCategorySelect, ManageVendorCategoriesDialog,
} from '@/components/vendors/vendor-categories';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Vendor {
  id:          string;
  name:        string;
  phone:       string | null;
  email:       string | null;
  gstin:       string | null;
  category:    string | null;
  address:     string | null;
  notes:       string | null;
  createdAt:   string;
  openPOCount: number;
}

interface PO {
  id:               string;
  vendorId:         string | null;
  status:           string;
  totalPaise:       number;
  advancePaidPaise: number;
}

interface VendorForm {
  name: string; phone: string; email: string;
  gstin: string; category: string; address: string; notes: string;
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

const EMPTY_FORM: VendorForm = {
  name: '', phone: '', email: '', gstin: '', category: '', address: '', notes: '',
};

const OPEN_STATUSES = new Set(['draft', 'sent', 'acknowledged', 'partial']);

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function VendorsPage() {
  const { isAdmin } = useUser(); // editing / removing a vendor is owner-only on the API
  const router = useRouter();

  const [vendors,  setVendors]  = useState<Vendor[]>([]);
  const [pos,      setPos]      = useState<PO[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Studio-managed categories
  const { categories, setCategories, canManage, loadError: catLoadError, reload: reloadCategories } = useVendorCategories();
  const [manageOpen, setManageOpen] = useState(false);

  // Add/Edit dialog
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<Vendor | undefined>();
  const [form,         setForm]         = useState<VendorForm>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  /* ── Load ─────────────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vnRes, poRes] = await Promise.all([
        fetch('/api/v1/vendors').then(r => r.json()),
        fetch('/api/v1/purchase-orders').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setVendors(vnRes.data ?? []);
      setPos(poRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── Derived ──────────────────────────────────────────────────────────────── */

  const toPayByVendor = useMemo(() => {
    const map = new Map<string, number>();
    for (const po of pos) {
      if (!po.vendorId || !OPEN_STATUSES.has(po.status)) continue;
      const outstanding = Math.max(0, po.totalPaise - (po.advancePaidPaise ?? 0));
      map.set(po.vendorId, (map.get(po.vendorId) ?? 0) + outstanding);
    }
    return map;
  }, [pos]);

  // A filter on a category that was just renamed or deleted falls back to "All".
  const activeCat = categories.some(c => c.name === catFilter) ? catFilter : '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cf = activeCat.toLowerCase();
    return vendors.filter(v => {
      if (cf && (v.category ?? '').toLowerCase() !== cf) return false;
      if (!q) return true;
      return v.name.toLowerCase().includes(q) ||
        (v.phone ?? '').includes(q) ||
        (v.gstin ?? '').toLowerCase().includes(q) ||
        (v.category ?? '').toLowerCase().includes(q);
    });
  }, [vendors, search, activeCat]);

  async function onCategoriesChanged() {
    // A rename or delete rewrites vendors' categories too.
    await Promise.all([reloadCategories(), load()]);
  }

  /* ── Handlers ─────────────────────────────────────────────────────────────── */

  function openAdd() {
    setEditTarget(undefined);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditTarget(v);
    setForm({
      name: v.name, phone: v.phone ?? '', email: v.email ?? '',
      gstin: v.gstin ?? '', category: v.category ?? '',
      address: v.address ?? '', notes: v.notes ?? '',
    });
    setSaveError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Vendor name is required.'); return; }
    setSaving(true); setSaveError(null);
    const body: Record<string, unknown> = { name: form.name.trim() };
    // On edit an emptied field is sent as null so the server clears it.
    for (const k of ['phone', 'email', 'gstin', 'address', 'notes'] as const) {
      const v = form[k].trim();
      if (v) body[k] = v;
      else if (editTarget) body[k] = null;
    }
    if (form.category)       body.category = form.category;
    else if (editTarget)     body.category = null;
    try {
      const url    = editTarget ? `/api/v1/vendors/${editTarget.id}` : '/api/v1/vendors';
      const method = editTarget ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { setSaveError(await responseError(res, 'Failed to save.')); return; }
      const json   = await res.json() as { data?: Vendor };
      void reloadCategories(); // vendor counts per category
      setVendors(prev =>
        editTarget
          ? prev.map(v => v.id === editTarget.id ? json.data! : v)
          : [json.data!, ...prev],
      );
      setDialogOpen(false);
    } catch { setSaveError(NETWORK_ERROR); }
    finally  { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/vendors/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) { setDeleteError(await responseError(res, 'Could not remove this vendor.')); return; }
      setVendors(prev => prev.filter(v => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError(NETWORK_ERROR);
    } finally { setDeleteBusy(false); }
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setManageOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Tags className="h-4 w-4" />Categories
          </button>
          <button type="button" onClick={openAdd}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.25} />New vendor
          </button>
        </div>
      </div>

      {catLoadError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{catLoadError}
        </div>
      )}

      {/* Search + table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="studio-input w-full text-sm h-9" style={{ paddingLeft: '2.25rem' }} />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            )}
          </div>
          <select value={activeCat} onChange={e => setCatFilter(e.target.value)}
            aria-label="Filter by category" className="studio-input h-9 text-sm">
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-40 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Store className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              {search || activeCat ? 'No vendors match your filters.' : 'No vendors yet.'}
            </p>
            {!search && !activeCat && (
              <button type="button" onClick={openAdd} className="btn-secondary px-4 py-2 text-sm">
                Add first vendor
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Vendor', 'Category', 'Phone', 'GSTIN', 'Open POs', 'To Pay', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-semibold tracking-wide"
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => {
                  const cat        = v.category ? categoryBadge(v.category) : undefined;
                  const outstanding = toPayByVendor.get(v.id) ?? 0;
                  return (
                    <tr key={v.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                      style={{
                        borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        borderLeft: '3px solid var(--accent-base)',
                      }}
                      onClick={() => router.push(`/vendors/${v.id}`)}>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: cat?.bg ?? 'var(--accent-soft)', color: cat?.color ?? 'var(--accent-base)' }}>
                            {v.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--accent-base)' }}>{v.name}</p>
                            {v.email && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{v.email}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {v.category && cat ? (
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ background: cat.bg, color: cat.color }}>
                            {v.category}
                          </span>
                        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {v.phone ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {v.gstin ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      <td className="px-5 py-3.5 tabular-nums text-sm">
                        {v.openPOCount > 0
                          ? <span className="font-semibold" style={{ color: 'var(--accent-base)' }}>{v.openPOCount}</span>
                          : <span style={{ color: 'var(--text-tertiary)' }}>0</span>}
                      </td>

                      <td className="px-5 py-3.5 tabular-nums text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {outstanding > 0
                          ? formatRupees(outstanding)
                          : <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      <td className="px-3 py-3.5">
                        {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => openEdit(v)}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
                            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(v)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-2 text-xs"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
              {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
              {activeCat && ` in ${activeCat}`}
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Vendor name" required>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hafele India" className="studio-input h-9 w-full text-sm" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Phone">
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210" className="studio-input h-9 w-full text-sm" />
              </FormField>
              <FormField label="Category">
                <VendorCategorySelect value={form.category}
                  onChange={name => setForm(f => ({ ...f, category: name }))}
                  categories={categories}
                  onCreated={cat => setCategories(prev => [...prev, cat])} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email">
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="vendor@example.com" className="studio-input h-9 w-full text-sm" />
              </FormField>
              <FormField label="GSTIN">
                <input type="text" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))}
                  placeholder="29AAAAA0000A1Z5" className="studio-input h-9 w-full text-sm font-mono" />
              </FormField>
            </div>
            <FormField label="Address">
              <textarea value={form.address} rows={2} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Shop / street / city" className="studio-input w-full text-sm resize-none" />
            </FormField>
            <FormField label="Notes">
              <textarea value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment terms, lead time, quality notes…" className="studio-input w-full text-sm resize-none" />
            </FormField>
            {saveError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{saveError}
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Add vendor'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageVendorCategoriesDialog open={manageOpen} onOpenChange={setManageOpen}
        categories={categories} canManage={canManage} onChanged={onCategoriesChanged} />

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Remove vendor?</DialogTitle></DialogHeader>
          <p className="text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{deleteTarget?.name}</span> will be
            removed. Existing POs linked to this vendor won&apos;t be affected.
          </p>
          {deleteError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{deleteError}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleteBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleteBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Removing…' : 'Remove vendor'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
        {label}{required && <span style={{ color: 'var(--accent-base)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
