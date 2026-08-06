'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Package, X, ChevronUp, ChevronDown,
  Grid3X3, List, MoreVertical, Download, Users, Tag, Clock,
  CheckCircle, XCircle, ArrowUpDown, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────────────── */
type MaterialCategory =
  | 'wood_plywood'
  | 'laminates_veneers'
  | 'tiles_flooring'
  | 'hardware_fittings'
  | 'paints_finishes'
  | 'fabrics_upholstery'
  | 'lighting'
  | 'other';

type SortKey = 'name' | 'category' | 'sellPricePaise' | 'costPricePaise' | 'margin';
type ViewMode = 'table' | 'grid';
type StatusFilter = 'all' | 'in_stock' | 'out_of_stock';

interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  description?: string;
  unit: string;
  costPricePaise: number;
  sellPricePaise: number;
  vendorName?: string;
  imageUrl?: string;
  inStock: boolean;
  createdAt: string;
}

interface MaterialForm {
  name: string;
  category: MaterialCategory;
  description: string;
  unit: string;
  costPriceRupees: string;
  sellPriceRupees: string;
  vendorName: string;
  imageUrl: string;
  inStock: boolean;
}

const INITIAL_FORM: MaterialForm = {
  name: '', category: 'wood_plywood', description: '', unit: 'sqft',
  costPriceRupees: '', sellPriceRupees: '', vendorName: '', imageUrl: '', inStock: true,
};

/* ── Category config ──────────────────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<MaterialCategory, { label: string; emoji: string; bg: string; color: string }> = {
  wood_plywood:       { label: 'Wood / Plywood',       emoji: '🪵', bg: '#FDF3E8', color: '#92400E' },
  laminates_veneers:  { label: 'Laminates & Veneers',  emoji: '📋', bg: '#F0FDF4', color: '#14532D' },
  tiles_flooring:     { label: 'Tiles & Flooring',     emoji: '🏛️', bg: '#EFF6FF', color: '#1E40AF' },
  hardware_fittings:  { label: 'Hardware & Fittings',  emoji: '🔩', bg: '#F5F5F5', color: '#374151' },
  paints_finishes:    { label: 'Paints & Finishes',    emoji: '🎨', bg: '#FDF2F8', color: '#BE185D' },
  fabrics_upholstery: { label: 'Fabrics & Upholstery', emoji: '🧵', bg: '#F5F3FF', color: '#6B21A8' },
  lighting:           { label: 'Lighting',             emoji: '💡', bg: '#FEFCE8', color: '#713F12' },
  other:              { label: 'Other',                emoji: '📦', bg: '#FAF9F6', color: '#24211E' },
};

const UNIT_OPTIONS = ['sqft', 'piece', 'running ft', 'box', 'litre', 'kg', 'set', 'pair'];
const PAGE_SIZE = 20;

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function marginPct(sell: number, cost: number): number {
  if (sell === 0 || cost === 0) return 0;
  return Math.round(((sell - cost) / sell) * 100);
}

function exportCSV(list: Material[]) {
  const rows = [
    ['Name', 'Category', 'Unit', 'Vendor', 'Cost Price (₹)', 'Sell Price (₹)', 'Margin %', 'Status'],
    ...list.map(m => [
      m.name,
      CATEGORY_CONFIG[m.category].label,
      m.unit,
      m.vendorName ?? '',
      (m.costPricePaise / 100).toFixed(2),
      (m.sellPricePaise / 100).toFixed(2),
      String(marginPct(m.sellPricePaise, m.costPricePaise)),
      m.inStock ? 'In Stock' : 'Out of Stock',
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'materials.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, iconBg, iconColor, icon: Icon,
}: {
  label: string; value: number | string; sub?: string;
  iconBg: string; iconColor: string; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border p-4 flex items-start justify-between gap-3"
      style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
      <div className="min-w-0">
        <p className="text-xs font-medium mb-1 truncate" style={{ color: '#6B6459' }}>{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: '#1C1916' }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: '#A79E8E' }}>{sub}</p>}
      </div>
      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: iconBg, color: iconColor }}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

/* ── Adjust Stock Modal ───────────────────────────────────────────────────── */
function AdjustStockModal({
  material, onClose, onSave,
}: {
  material: Material;
  onClose: () => void;
  onSave: (id: string, inStock: boolean) => Promise<void>;
}) {
  const [inStock, setInStock] = useState(material.inStock);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const cat                   = CATEGORY_CONFIG[material.category];

  async function handleSave() {
    if (inStock === material.inStock) { onClose(); return; }
    setSaving(true); setErr(null);
    try {
      await onSave(material.id, inStock);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update stock status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #F0EEE9' }}>
          <h2 className="text-base font-bold" style={{ color: '#1C1916' }}>Adjust Stock Status</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#F0EEE9]">
            <X className="h-4 w-4" style={{ color: '#6B6459' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: cat.bg }}>
            <span className="text-2xl">{cat.emoji}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#1C1916' }}>{material.name}</p>
              <p className="text-xs" style={{ color: '#6B6459' }}>{cat.label}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: '#6B6459' }}>Stock Status</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setInStock(true)}
                className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: inStock ? '#16A34A' : '#E2DED5',
                  background: inStock ? '#F0FDF4' : '#FFFFFF',
                  color: inStock ? '#14532D' : '#6B6459',
                }}>
                <CheckCircle className="h-4 w-4" />
                In Stock
              </button>
              <button type="button" onClick={() => setInStock(false)}
                className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
                style={{
                  borderColor: !inStock ? '#DC2626' : '#E2DED5',
                  background: !inStock ? '#FEF2F2' : '#FFFFFF',
                  color: !inStock ? '#DC2626' : '#6B6459',
                }}>
                <XCircle className="h-4 w-4" />
                Out of Stock
              </button>
            </div>
          </div>
          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{err}</div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EEE9' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Material Modal ───────────────────────────────────────────────────────── */
function MaterialModal({
  open, onClose, onSave, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: MaterialForm) => Promise<void>;
  initial?: Material;
}) {
  const [form, setForm]       = useState<MaterialForm>(INITIAL_FORM);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof MaterialForm, string>>>({});
  const [apiError, setApiErr] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category,
        description: initial.description ?? '',
        unit: initial.unit,
        costPriceRupees: String(initial.costPricePaise / 100),
        sellPriceRupees: String(initial.sellPricePaise / 100),
        vendorName: initial.vendorName ?? '',
        imageUrl: initial.imageUrl ?? '',
        inStock: initial.inStock,
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({}); setApiErr(null);
  }, [initial, open]);

  function set<K extends keyof MaterialForm>(k: K, v: MaterialForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  async function handleSave() {
    const errs: Partial<Record<keyof MaterialForm, string>> = {};
    if (!form.name.trim())     errs.name            = 'Name is required';
    if (!form.costPriceRupees) errs.costPriceRupees = 'Cost price is required';
    if (!form.sellPriceRupees) errs.sellPriceRupees = 'Sell price is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setApiErr(e instanceof Error ? e.message : 'Failed to save material');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const sellPaise = Number(form.sellPriceRupees) * 100;
  const costPaise = Number(form.costPriceRupees) * 100;
  const margin    = marginPct(sellPaise, costPaise);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #F0EEE9' }}>
          <h2 className="text-base font-bold" style={{ color: '#1C1916' }}>
            {initial ? 'Edit Material' : 'Add Material'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#F0EEE9]">
            <X className="h-4 w-4" style={{ color: '#6B6459' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="studio-label block mb-1.5">Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Marine Plywood 19mm" className="studio-input w-full text-sm" />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value as MaterialCategory)}
                className="studio-input w-full text-sm">
                {(Object.keys(CATEGORY_CONFIG) as MaterialCategory[]).map(k => (
                  <option key={k} value={k}>{CATEGORY_CONFIG[k].emoji} {CATEGORY_CONFIG[k].label}</option>
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
            <label className="studio-label block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Optional details, specs, brand…"
              className="studio-input w-full text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Cost Price ₹ *</label>
              <input type="number" min={0} step={0.01} value={form.costPriceRupees}
                onChange={e => set('costPriceRupees', e.target.value)} placeholder="0"
                className="studio-input w-full text-sm" />
              {errors.costPriceRupees && <p className="text-xs text-red-600 mt-1">{errors.costPriceRupees}</p>}
            </div>
            <div>
              <label className="studio-label block mb-1.5">Sell Price ₹ *</label>
              <input type="number" min={0} step={0.01} value={form.sellPriceRupees}
                onChange={e => set('sellPriceRupees', e.target.value)} placeholder="0"
                className="studio-input w-full text-sm" />
              {errors.sellPriceRupees && <p className="text-xs text-red-600 mt-1">{errors.sellPriceRupees}</p>}
            </div>
          </div>
          {margin > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
              <span className="text-xs font-semibold" style={{ color: '#14532D' }}>
                Margin: {margin}% on sell price
              </span>
            </div>
          )}
          <div>
            <label className="studio-label block mb-1.5">Vendor Name</label>
            <input type="text" value={form.vendorName} onChange={e => set('vendorName', e.target.value)}
              placeholder="e.g. Kitply Industries" className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Image URL</label>
            <input type="url" value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)}
              placeholder="https://…" className="studio-input w-full text-sm" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: form.inStock ? '#24211E' : '#D1D5DB' }}
              onClick={() => set('inStock', !form.inStock)}>
              <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                style={{ left: form.inStock ? 22 : 4 }} />
            </div>
            <span className="text-sm font-medium" style={{ color: '#221F1B' }}>
              {form.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </label>
        </div>
        {apiError && (
          <div className="mx-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex-shrink-0">
            {apiError}
          </div>
        )}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F0EEE9' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2 text-sm">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Material'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sort icon ────────────────────────────────────────────────────────────── */
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronUp className="h-3 w-3 opacity-20" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-violet-600" />
    : <ChevronDown className="h-3 w-3 text-violet-600" />;
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

/* ── Table header cell ────────────────────────────────────────────────────────
   Declared at module scope. Defining a component inside another component's
   body creates a brand-new component type on every render, so React unmounts
   and remounts the entire header each time state changes. */
function Th({
  col, label, align = 'left', sortKey, sortDir, onSort,
}: {
  col: SortKey;
  label: string;
  align?: 'left' | 'right';
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (col: SortKey) => void;
}) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: '#6B6459', background: '#FAFAF8', whiteSpace: 'nowrap' }}
      onClick={() => onSort(col)}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

/* ── Row action menu ─────────────────────────────────────────────────────── */
function RowMenu({
  m, open, onToggle, onEdit, onAdjust, onDelete,
}: {
  m: Material;
  open: boolean;
  onToggle: (id: string | null) => void;
  onEdit: (m: Material) => void;
  onAdjust: (m: Material) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button type="button"
        onClick={e => { e.stopPropagation(); onToggle(open ? null : m.id); }}
        className="p-1.5 rounded-lg transition-colors hover:bg-[#F0EEE9]">
        <MoreVertical className="h-3.5 w-3.5" style={{ color: '#6B6459' }} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border shadow-lg overflow-hidden"
          style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
          <button type="button" onClick={() => onEdit(m)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[#FAFAF8] transition-colors">
            <Edit2 className="h-3.5 w-3.5" style={{ color: '#6B6459' }} />
            <span style={{ color: '#1C1916' }}>Edit</span>
          </button>
          <button type="button" onClick={() => onAdjust(m)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[#FAFAF8] transition-colors">
            {m.inStock
              ? <ToggleRight className="h-3.5 w-3.5" style={{ color: '#16A34A' }} />
              : <ToggleLeft  className="h-3.5 w-3.5" style={{ color: '#6B6459' }} />}
            <span style={{ color: '#1C1916' }}>Adjust Stock</span>
          </button>
          <div style={{ borderTop: '1px solid #F0EEE9' }} />
          <button type="button" onClick={() => onDelete(m.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
            <span className="text-red-600">Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function MaterialsPage() {
  const [materials, setMaterials]           = useState<Material[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'all'>('all');
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all');
  const [vendorFilter, setVendorFilter]     = useState<string>('all');
  const [sortKey, setSortKey]               = useState<SortKey>('name');
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode]             = useState<ViewMode>('table');
  const [page, setPage]                     = useState(1);
  const [menuOpenId, setMenuOpenId]         = useState<string | null>(null);
  const [modalOpen, setModalOpen]           = useState(false);
  const [editTarget, setEditTarget]         = useState<Material | undefined>();
  const [adjustTarget, setAdjustTarget]     = useState<Material | undefined>();
  const isOwner                             = true;
  // Stamped when the data arrives rather than read during render: Date.now() is
  // impure, and inside the stats memo it would only be re-read when `materials`
  // changed, quietly ageing the "last 30 days" cutoff.
  const [loadedAt, setLoadedAt]             = useState<number>(() => 0);

  useEffect(() => {
    fetch('/api/v1/materials')
      .then(r => r.json())
      .then(({ data }: { data: Material[] | null }) => {
        setMaterials(data ?? []); setLoadedAt(Date.now()); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ── Derived stats ──────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const thirtyDaysAgo = loadedAt - 30 * 24 * 60 * 60 * 1000;
    const inStockCount   = materials.filter(m => m.inStock).length;
    const outStockCount  = materials.filter(m => !m.inStock).length;
    const uniqueVendors  = new Set(materials.map(m => m.vendorName).filter(Boolean)).size;
    const recentCount    = materials.filter(m => new Date(m.createdAt).getTime() > thirtyDaysAgo).length;
    const uniqueCats     = new Set(materials.map(m => m.category)).size;
    return { total: materials.length, inStockCount, outStockCount, uniqueVendors, recentCount, uniqueCats };
  }, [materials, loadedAt]);

  const vendorOptions = useMemo(() => (
    Array.from(new Set(materials.map(m => m.vendorName).filter((v): v is string => !!v))).sort()
  ), [materials]);

  /* ── Filter + sort ──────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = materials;
    if (activeCategory !== 'all') result = result.filter(m => m.category === activeCategory);
    if (statusFilter === 'in_stock')    result = result.filter(m => m.inStock);
    if (statusFilter === 'out_of_stock') result = result.filter(m => !m.inStock);
    if (vendorFilter !== 'all') result = result.filter(m => m.vendorName === vendorFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.vendorName ?? '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'margin') {
        av = marginPct(a.sellPricePaise, a.costPricePaise);
        bv = marginPct(b.sellPricePaise, b.costPricePaise);
      } else if (sortKey === 'category') {
        av = CATEGORY_CONFIG[a.category].label;
        bv = CATEGORY_CONFIG[b.category].label;
      } else {
        av = a[sortKey] as number | string;
        bv = b[sortKey] as number | string;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [materials, activeCategory, statusFilter, vendorFilter, search, sortKey, sortDir]);

  /* ── Pagination ─────────────────────────────────────────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ── Handlers ───────────────────────────────────────────────────────────── */
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  function clearFilters() {
    setSearch(''); setActiveCategory('all');
    setStatusFilter('all'); setVendorFilter('all');
    setPage(1);
  }

  const hasFilters = search || activeCategory !== 'all' || statusFilter !== 'all' || vendorFilter !== 'all';

  const handleSave = useCallback(async (form: MaterialForm) => {
    const body = {
      name: form.name.trim(), category: form.category,
      description: form.description.trim() || undefined, unit: form.unit,
      costPricePaise: Math.round(Number(form.costPriceRupees) * 100),
      sellPricePaise: Math.round(Number(form.sellPriceRupees) * 100),
      vendorName: form.vendorName.trim() || undefined,
      imageUrl:   form.imageUrl.trim()   || undefined,
      inStock: form.inStock,
    };
    if (editTarget) {
      const res = await fetch(`/api/v1/materials/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed to update (${res.status})`);
      setMaterials(prev => prev.map(m => m.id === editTarget.id ? json.data! : m));
    } else {
      const res = await fetch('/api/v1/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed to add material (${res.status})`);
      setMaterials(prev => [json.data!, ...prev]);
    }
    setEditTarget(undefined);
  }, [editTarget]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this material? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/materials/${id}`, { method: 'DELETE' });
    if (res.ok) setMaterials(prev => prev.filter(m => m.id !== id));
    setMenuOpenId(null);
  }

  async function handleAdjustStock(id: string, inStock: boolean) {
    const res = await fetch(`/api/v1/materials/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock }),
    });
    if (!res.ok) throw new Error('Failed to update stock status');
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, inStock } : m));
  }

  function openEdit(m: Material) { setEditTarget(m); setModalOpen(true); setMenuOpenId(null); }
  function openAdd()              { setEditTarget(undefined); setModalOpen(true); }
  function openAdjust(m: Material){ setAdjustTarget(m); setMenuOpenId(null); }

  const categories = Object.keys(CATEGORY_CONFIG) as MaterialCategory[];

  /* ── Sortable TH ────────────────────────────────────────────────────────── */
  /* ── Row action menu ────────────────────────────────────────────────────── */
  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-5">

      {/* Close menu on backdrop click */}
      {menuOpenId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#1C1916' }}>Material Library</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B6459' }}>
            Manage and track all materials across your projects
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={openAdd}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm flex-shrink-0">
            <Plus className="h-4 w-4" />Add Material
          </button>
        )}
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Materials" value={stats.total}
          icon={Package} iconBg="#F5F3FF" iconColor="#7C3AED" />
        <StatCard label="In Stock" value={stats.inStockCount}
          sub={stats.total ? `${Math.round(stats.inStockCount / stats.total * 100)}% available` : undefined}
          icon={CheckCircle} iconBg="#F0FDF4" iconColor="#16A34A" />
        <StatCard label="Out of Stock" value={stats.outStockCount}
          icon={XCircle} iconBg="#FEF2F2" iconColor="#DC2626" />
        <StatCard label="Vendors" value={stats.uniqueVendors}
          icon={Users} iconBg="#EFF6FF" iconColor="#2563EB" />
        <StatCard label="Recently Added" value={stats.recentCount} sub="last 30 days"
          icon={Clock} iconBg="#FEFCE8" iconColor="#D97706" />
      </div>

      {/* ── Search + Export ─────────────────────────────────────────────── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="studio-search-icon" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, vendor, or description…"
            className="studio-input w-full text-sm h-10" />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: '#A79E8E' }} />
            </button>
          )}
        </div>
        <button type="button"
          onClick={() => exportCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-[#FAFAF8]"
          style={{ borderColor: '#E2DED5', color: '#24211E', background: '#FFFFFF' }}>
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* ── Filter row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
          className="text-sm rounded-xl border px-3 py-2 h-9 pr-8 appearance-none cursor-pointer"
          style={{ borderColor: statusFilter !== 'all' ? '#7C3AED' : '#E2DED5', background: statusFilter !== 'all' ? '#F5F3FF' : '#FFFFFF', color: '#24211E' }}>
          <option value="all">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>

        {vendorOptions.length > 0 && (
          <select value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1); }}
            className="text-sm rounded-xl border px-3 py-2 h-9 pr-8 appearance-none cursor-pointer max-w-[180px] truncate"
            style={{ borderColor: vendorFilter !== 'all' ? '#7C3AED' : '#E2DED5', background: vendorFilter !== 'all' ? '#F5F3FF' : '#FFFFFF', color: '#24211E' }}>
            <option value="all">All Vendors</option>
            {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <select value={`${sortKey}:${sortDir}`}
          onChange={e => {
            const [k, d] = e.target.value.split(':');
            setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); setPage(1);
          }}
          className="text-sm rounded-xl border px-3 py-2 h-9 pr-8 appearance-none cursor-pointer"
          style={{ borderColor: '#E2DED5', background: '#FFFFFF', color: '#24211E' }}>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="sellPricePaise:desc">Price High–Low</option>
          <option value="sellPricePaise:asc">Price Low–High</option>
          <option value="margin:desc">Margin High–Low</option>
          <option value="costPricePaise:asc">Cost Low–High</option>
        </select>

        {hasFilters && (
          <button type="button" onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:bg-red-50"
            style={{ borderColor: '#FECACA', color: '#DC2626', background: '#FEF2F2' }}>
            <X className="h-3.5 w-3.5" />Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-xl border p-1"
          style={{ borderColor: '#E2DED5', background: '#FFFFFF' }}>
          <button type="button" onClick={() => setViewMode('table')}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: viewMode === 'table' ? '#24211E' : 'transparent' }}>
            <List className="h-4 w-4" style={{ color: viewMode === 'table' ? '#FFFFFF' : '#6B6459' }} />
          </button>
          <button type="button" onClick={() => setViewMode('grid')}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: viewMode === 'grid' ? '#24211E' : 'transparent' }}>
            <Grid3X3 className="h-4 w-4" style={{ color: viewMode === 'grid' ? '#FFFFFF' : '#6B6459' }} />
          </button>
        </div>
      </div>

      {/* ── Category pills ─────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => { setActiveCategory('all'); setPage(1); }}
          className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            background: activeCategory === 'all' ? '#24211E' : '#FFFFFF',
            color: activeCategory === 'all' ? '#FFFFFF' : '#24211E',
            border: '1px solid #E2DED5',
          }}>
          All ({materials.length})
        </button>
        {categories.map(cat => {
          const count = materials.filter(m => m.category === cat).length;
          if (count === 0) return null;
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button key={cat} type="button" onClick={() => { setActiveCategory(cat); setPage(1); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: activeCategory === cat ? cfg.color : cfg.bg,
                color:      activeCategory === cat ? '#FFFFFF' : cfg.color,
                border: `1px solid ${cfg.color}33`,
              }}>
              {cfg.emoji} {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Results header ─────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: '#A79E8E' }}>
            Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} material
            {filtered.length !== 1 ? 's' : ''}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="p-1 rounded-lg disabled:opacity-30 hover:bg-[#F0EEE9] transition-colors">
                <ChevronLeft className="h-4 w-4" style={{ color: '#6B6459' }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const n = i + 1;
                return (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    className="min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: safePage === n ? '#24211E' : 'transparent',
                      color: safePage === n ? '#FFFFFF' : '#6B6459',
                    }}>
                    {n}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-xs px-1" style={{ color: '#A79E8E' }}>…{totalPages}</span>}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="p-1 rounded-lg disabled:opacity-30 hover:bg-[#F0EEE9] transition-colors">
                <ChevronRight className="h-4 w-4" style={{ color: '#6B6459' }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
          style={{ borderColor: '#F0EEE9' }}>
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(36,33,30,0.08)' }}>
            <Package className="h-7 w-7" style={{ color: '#E2DED5' }} />
          </div>
          <p className="text-sm" style={{ color: '#6B6459' }}>
            {hasFilters ? 'No materials match your filters.' : 'No materials yet.'}
          </p>
          {isOwner && !hasFilters ? (
            <button type="button" onClick={openAdd} className="btn-secondary px-4 py-2 text-sm">
              Add your first material
            </button>
          ) : hasFilters ? (
            <button type="button" onClick={clearFilters} className="btn-secondary px-4 py-2 text-sm">
              Clear filters
            </button>
          ) : null}
        </div>

      ) : viewMode === 'table' ? (
        /* ── Table view ─────────────────────────────────────────────────── */
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: '#F0EEE9' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #F0EEE9' }}>
                  <Th col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="category" label="Category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                    style={{ color: '#6B6459', background: '#FAFAF8' }}>Unit</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                    style={{ color: '#6B6459', background: '#FAFAF8' }}>Vendor</th>
                  <Th col="costPricePaise" label="Cost" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="sellPricePaise" label="Sell Price" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="margin" label="Margin" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-center"
                    style={{ color: '#6B6459', background: '#FAFAF8' }}>Status</th>
                  {isOwner && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right"
                      style={{ color: '#6B6459', background: '#FAFAF8', width: 48 }} />
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((m, idx) => {
                  const cat    = CATEGORY_CONFIG[m.category];
                  const margin = marginPct(m.sellPricePaise, m.costPricePaise);
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-[#FDFCFB]"
                      style={{ borderBottom: idx < paginated.length - 1 ? '1px solid #F5F3F0' : undefined }}>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.name}
                              className="h-9 w-9 rounded-lg object-cover flex-shrink-0"
                              style={{ border: '1px solid #F0EEE9' }} />
                          ) : (
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: cat.bg }}>{cat.emoji}</div>
                          )}
                          <p className="font-semibold whitespace-nowrap" style={{ color: '#221F1B' }}>{m.name}</p>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ background: cat.bg, color: cat.color }}>
                          {cat.emoji} {cat.label}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#6B6459' }}>
                        {m.unit}
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3 text-xs max-w-[140px]" style={{ color: '#6B6459' }}>
                        <span className="truncate block">{m.vendorName ?? '—'}</span>
                      </td>

                      {/* Cost */}
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-medium" style={{ color: '#6B6459' }}>
                        {fmt(m.costPricePaise)}
                      </td>

                      {/* Sell Price */}
                      <td className="px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap"
                        style={{ color: '#8F6F2E' }}>
                        {fmt(m.sellPricePaise)}
                        <span className="text-[10px] font-normal ml-0.5" style={{ color: '#A79E8E' }}>/{m.unit}</span>
                      </td>

                      {/* Margin */}
                      <td className="px-4 py-3 text-right">
                        {margin > 0 ? (
                          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{ background: '#F0FDF4', color: '#14532D' }}>{margin}%</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#D1CBB8' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap"
                          style={{
                            background: m.inStock ? '#F0FDF4' : '#FEF2F2',
                            color:      m.inStock ? '#14532D' : '#DC2626',
                          }}>
                          <span className="h-1.5 w-1.5 rounded-full inline-block"
                            style={{ background: m.inStock ? '#16A34A' : '#DC2626' }} />
                          {m.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>

                      {/* Actions */}
                      {isOwner && (
                        <td className="px-3 py-3 text-right">
                          <RowMenu m={m} open={menuOpenId === m.id} onToggle={setMenuOpenId}
                            onEdit={openEdit} onAdjust={openAdjust} onDelete={handleDelete} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between px-4 py-2.5 text-xs"
            style={{ borderTop: '1px solid #F0EEE9', background: '#FAFAF8', color: '#A79E8E' }}>
            <span>{filtered.length} material{filtered.length !== 1 ? 's' : ''}</span>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="font-medium hover:underline"
                style={{ color: '#7C5CFC' }}>Clear filters</button>
            )}
          </div>
        </div>

      ) : (
        /* ── Grid view ──────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginated.map(m => {
            const cat    = CATEGORY_CONFIG[m.category];
            const margin = marginPct(m.sellPricePaise, m.costPricePaise);
            return (
              <div key={m.id} className="rounded-xl border p-4 hover:shadow-md transition-all"
                style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: cat.bg }}>{cat.emoji}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1C1916' }}>{m.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#A79E8E' }}>per {m.unit}</p>
                    </div>
                  </div>
                  {isOwner && <RowMenu m={m} open={menuOpenId === m.id} onToggle={setMenuOpenId}
                            onEdit={openEdit} onAdjust={openAdjust} onDelete={handleDelete} />}
                </div>

                {/* Category */}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mb-2"
                  style={{ background: cat.bg, color: cat.color }}>
                  {cat.emoji} {cat.label}
                </span>

                {/* Vendor */}
                {m.vendorName && (
                  <p className="text-xs mb-3 truncate" style={{ color: '#6B6459' }}>
                    <span style={{ color: '#A79E8E' }}>Vendor: </span>{m.vendorName}
                  </p>
                )}

                {/* Price row */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px]" style={{ color: '#A79E8E' }}>Sell Price</p>
                    <p className="font-bold text-sm" style={{ color: '#8F6F2E' }}>{fmt(m.sellPricePaise)}</p>
                  </div>
                  {margin > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: '#F0FDF4', color: '#14532D' }}>{margin}%</span>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      background: m.inStock ? '#F0FDF4' : '#FEF2F2',
                      color:      m.inStock ? '#14532D' : '#DC2626',
                    }}>
                    <span className="h-1.5 w-1.5 rounded-full"
                      style={{ background: m.inStock ? '#16A34A' : '#DC2626' }} />
                    {m.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <MaterialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        onSave={handleSave}
        initial={editTarget}
      />

      {adjustTarget && (
        <AdjustStockModal
          material={adjustTarget}
          onClose={() => setAdjustTarget(undefined)}
          onSave={handleAdjustStock}
        />
      )}
    </div>
  );
}
