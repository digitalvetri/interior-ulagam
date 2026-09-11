'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Package, X, AlertTriangle } from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────────────── */

type MaterialCategory =
  | 'laminate' | 'hardware' | 'furniture' | 'fabric'
  | 'lighting' | 'flooring' | 'sanitary' | 'other';

interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  currentRatePaise: number;
  sellingRatePaise: number;
  lastPurchasePricePaise: number | null;
  brand: string | null;
  hsnSac: string | null;
  notes: string | null;
  createdAt: string;
}

interface MaterialForm {
  name: string;
  category: MaterialCategory;
  unit: string;
  currentRateRupees: string;
  brand: string;
  hsnSac: string;
  notes: string;
}

const INITIAL_FORM: MaterialForm = {
  name: '', category: 'laminate', unit: 'sqft',
  currentRateRupees: '', brand: '', hsnSac: '', notes: '',
};

/* ── Config ───────────────────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<MaterialCategory, { label: string; bg: string; color: string }> = {
  laminate:  { label: 'Laminates',        bg: 'var(--success-soft)',  color: 'var(--success-text)' },
  hardware:  { label: 'Hardware',         bg: 'var(--surface-muted)', color: 'var(--text-primary)' },
  furniture: { label: 'Furniture',        bg: '#FDF3E8',              color: '#92400E' },
  fabric:    { label: 'Fabrics',          bg: 'var(--accent-soft)',   color: '#6B21A8' },
  lighting:  { label: 'Lighting',         bg: '#FEFCE8',              color: '#713F12' },
  flooring:  { label: 'Flooring & Tiles', bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
  sanitary:  { label: 'Sanitary',         bg: '#EFF6FF',              color: '#1D4ED8' },
  other:     { label: 'Other',            bg: '#FAF9F6',              color: 'var(--text-primary)' },
};

const UNIT_OPTIONS = ['sqft', 'piece', 'running ft', 'box', 'litre', 'kg', 'set', 'pair', 'nos'];
const CATEGORIES = Object.keys(CATEGORY_CONFIG) as MaterialCategory[];

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/* ── Add / Edit Modal ─────────────────────────────────────────────────────── */

function MaterialModal({
  open, onClose, onSave, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: MaterialForm) => Promise<void>;
  initial?: Material;
}) {
  const [form,     setForm]     = useState<MaterialForm>(INITIAL_FORM);
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Partial<Record<keyof MaterialForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name:              initial.name,
        category:          initial.category,
        unit:              initial.unit,
        currentRateRupees: String(initial.currentRatePaise / 100),
        brand:             initial.brand ?? '',
        hsnSac:            initial.hsnSac ?? '',
        notes:             initial.notes ?? '',
      } : INITIAL_FORM);
      setErrors({}); setApiError(null);
    }
  }, [initial, open]);

  function set<K extends keyof MaterialForm>(k: K, v: MaterialForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  async function handleSave() {
    const errs: Partial<Record<keyof MaterialForm, string>> = {};
    if (!form.name.trim())       errs.name             = 'Name is required';
    if (!form.currentRateRupees) errs.currentRateRupees = 'Rate is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Failed to save material');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-card)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
            {initial ? 'Edit Item' : 'Add Item to Catalog'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="studio-label block mb-1.5">Item Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Marine Plywood 19mm" className="studio-input w-full text-sm" />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value as MaterialCategory)}
                className="studio-input w-full text-sm">
                {CATEGORIES.map(k => (
                  <option key={k} value={k}>{CATEGORY_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="studio-label block mb-1.5">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="studio-input w-full text-sm">
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="studio-label block mb-1.5">Brand / Supplier</label>
            <input type="text" value={form.brand} onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Merino, Greenlam, Hafele" className="studio-input w-full text-sm" />
          </div>

          <div>
            <label className="studio-label block mb-1.5">Purchase Cost per {form.unit || 'unit'} (₹) *</label>
            <input type="number" min={0} step={0.01} value={form.currentRateRupees}
              onChange={e => set('currentRateRupees', e.target.value)}
              placeholder="0.00" className="studio-input w-full text-sm" />
            {errors.currentRateRupees && <p className="text-xs text-red-600 mt-1">{errors.currentRateRupees}</p>}
          </div>

          <div>
            <label className="studio-label block mb-1.5">HSN / SAC Code</label>
            <input type="text" value={form.hsnSac} onChange={e => set('hsnSac', e.target.value)}
              placeholder="e.g. 4412" className="studio-input w-full text-sm" />
          </div>

          <div>
            <label className="studio-label block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Specs, thickness, finish, supplier notes…"
              className="studio-input w-full text-sm resize-none" />
          </div>
        </div>

        {apiError && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex-shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{apiError}
          </div>
        )}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add to Catalog'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function MaterialsPage() {
  const [materials,       setMaterials]       = useState<Material[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [activeCategory,  setActiveCategory]  = useState<MaterialCategory | 'all'>('all');
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editTarget,      setEditTarget]      = useState<Material | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/materials')
      .then(r => r.json())
      .then(({ data }: { data: Material[] | null }) => { setMaterials(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* ── Derived ──────────────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalValue = materials.reduce((s, m) => s + m.currentRatePaise, 0);
    const uniqueCats = new Set(materials.map(m => m.category)).size;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = materials.filter(m => new Date(m.createdAt).getTime() > thirtyDaysAgo).length;
    return { total: materials.length, uniqueCats, totalValue, recentCount };
  }, [materials]);

  const filtered = useMemo(() => {
    let result = materials;
    if (activeCategory !== 'all') result = result.filter(m => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.brand ?? '').toLowerCase().includes(q) ||
        (m.hsnSac ?? '').toLowerCase().includes(q) ||
        (m.notes ?? '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, activeCategory, search]);

  /* ── Handlers ─────────────────────────────────────────────────────────────── */

  const handleSave = useCallback(async (form: MaterialForm) => {
    const currentRatePaise = Math.round(Number(form.currentRateRupees) * 100);

    if (editTarget) {
      const body: Record<string, unknown> = { name: form.name.trim() };
      if (form.unit)                                          body.unit  = form.unit;
      if (currentRatePaise !== editTarget.currentRatePaise)  body.currentRatePaise = currentRatePaise;
      if (form.brand.trim())  body.brand  = form.brand.trim();
      if (form.hsnSac.trim()) body.hsnSac = form.hsnSac.trim();
      if (form.notes.trim())  body.notes  = form.notes.trim();

      const res  = await fetch(`/api/v1/materials/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: unknown };
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Failed (${res.status})`);
      setMaterials(prev => prev.map(m => m.id === editTarget.id ? json.data! : m));
    } else {
      const body: Record<string, unknown> = {
        name: form.name.trim(), category: form.category, unit: form.unit, currentRatePaise,
      };
      if (form.brand.trim())  body.brand  = form.brand.trim();
      if (form.hsnSac.trim()) body.hsnSac = form.hsnSac.trim();
      if (form.notes.trim())  body.notes  = form.notes.trim();

      const res  = await fetch('/api/v1/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: unknown };
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Failed (${res.status})`);
      setMaterials(prev => [json.data!, ...prev]);
    }
    setEditTarget(undefined);
  }, [editTarget]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/v1/materials/${id}`, { method: 'DELETE' });
    if (res.ok) setMaterials(prev => prev.filter(m => m.id !== id));
    setDeleteConfirmId(null);
  }

  function openEdit(m: Material) { setEditTarget(m); setModalOpen(true); }
  function openAdd()              { setEditTarget(undefined); setModalOpen(true); }

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Materials</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Catalog of materials used across your projects
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'ITEMS',
            value: loading ? '—' : String(stats.total),
            sub: 'in catalog',
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            ),
          },
          {
            label: 'CATEGORIES',
            value: loading ? '—' : String(stats.uniqueCats),
            sub: 'material types',
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            ),
          },
          {
            label: 'CATALOG VALUE',
            value: loading ? '—' : fmt(stats.totalValue),
            sub: 'sum of purchase rates',
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'ADDED RECENTLY',
            value: loading ? '—' : String(stats.recentCount),
            sub: 'in last 30 days',
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {label}
              </p>
              <span style={{ color: 'var(--accent-base)' }}>{icon}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Add item button */}
      <div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--surface-card)' }}>
          <Plus className="h-4 w-4" />Add item (to catalog)
        </button>
      </div>

      {/* Category pills + search */}
      <div className="rounded-2xl border p-4 space-y-3"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveCategory('all')}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={{
              background: activeCategory === 'all' ? 'var(--accent-base)' : 'var(--surface-muted)',
              color:      activeCategory === 'all' ? '#fff' : 'var(--text-secondary)',
            }}>
            All
          </button>
          {CATEGORIES.filter(cat => materials.some(m => m.category === cat)).map(cat => {
            const cfg    = CATEGORY_CONFIG[cat];
            const active = activeCategory === cat;
            return (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all border"
                style={{
                  background:  active ? cfg.color : 'transparent',
                  color:       active ? '#fff' : cfg.color,
                  borderColor: active ? cfg.color : `${cfg.color}44`,
                }}>
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item, brand, HSN…"
            className="studio-input w-full text-sm" style={{ paddingLeft: '2.25rem' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>

      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border-2 border-dashed"
          style={{ borderColor: 'var(--border-subtle)' }}>
          <Package className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search || activeCategory !== 'all' ? 'No items match your filters.' : 'No materials in catalog yet.'}
          </p>
          {search || activeCategory !== 'all' ? (
            <button type="button" onClick={() => { setSearch(''); setActiveCategory('all'); }}
              className="text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
              Clear filters
            </button>
          ) : (
            <button type="button" onClick={openAdd} className="btn-secondary px-4 py-2 text-sm">
              Add first item
            </button>
          )}
        </div>

      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>ITEM</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>CATEGORY</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>BRAND</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>UNIT</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>COST</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>HSN / SAC</th>
                  <th className="px-3 py-3" style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const cat = CATEGORY_CONFIG[m.category];
                  return (
                    <tr key={m.id}
                      className="transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>

                      {/* Item */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg flex-shrink-0 flex items-center justify-center text-sm"
                            style={{ background: cat.bg, color: cat.color, fontWeight: 700 }}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{m.name}</p>
                            {m.notes && (
                              <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--text-tertiary)' }}>
                                {m.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ background: cat.bg, color: cat.color }}>
                          {cat.label}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.brand ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      {/* Unit */}
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.unit}
                      </td>

                      {/* Cost */}
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold whitespace-nowrap text-xs"
                        style={{ color: 'var(--text-heading)' }}>
                        {fmt(m.currentRatePaise)}
                        <span className="font-normal ml-0.5" style={{ color: 'var(--text-tertiary)' }}>/{m.unit}</span>
                      </td>

                      {/* HSN/SAC */}
                      <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {m.hsnSac ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3.5">
                        {deleteConfirmId === m.id ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => handleDelete(m.id)}
                              className="px-2 py-1 rounded text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                              Delete
                            </button>
                            <button type="button" onClick={() => setDeleteConfirmId(null)}
                              className="p-1 rounded hover:bg-[var(--border-subtle)]">
                              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button type="button" onClick={() => openEdit(m)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
                              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
                              <Edit2 className="h-3 w-3" />Edit
                            </button>
                            <button type="button" onClick={() => setDeleteConfirmId(m.id)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-50">
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
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 text-xs" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {(search || activeCategory !== 'all') && ` · `}
            {(search || activeCategory !== 'all') && (
              <button type="button" onClick={() => { setSearch(''); setActiveCategory('all'); }}
                className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <MaterialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  );
}
