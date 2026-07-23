'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Plus, Grid3X3, List, Edit2, Trash2, Package, X, Upload,
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
  other:              { label: 'Other',                emoji: '📦', bg: '#F8F5F2', color: '#6F4E37' },
};

const UNIT_OPTIONS = ['sqft', 'piece', 'running ft', 'box', 'litre', 'kg', 'set', 'pair'];

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function marginPct(sell: number, cost: number): number {
  if (sell === 0 || cost === 0) return 0;
  return Math.round(((sell - cost) / sell) * 100);
}

/* ── Material Card (grid view) ────────────────────────────────────────────── */
function MaterialCard({
  material, isOwner, onEdit, onDelete,
}: {
  material: Material;
  isOwner: boolean;
  onEdit: (m: Material) => void;
  onDelete: (id: string) => void;
}) {
  const cat    = CATEGORY_CONFIG[material.category];
  const margin = marginPct(material.sellPricePaise, material.costPricePaise);

  return (
    <div className="premium-card overflow-hidden relative">
      {/* Image / placeholder */}
      <div
        className="h-40 flex items-center justify-center"
        style={{
          background: material.imageUrl
            ? `url(${material.imageUrl}) center/cover no-repeat`
            : cat.bg,
          borderBottom: '1px solid #E9DFD3',
        }}
      >
        {!material.imageUrl && <span className="text-4xl">{cat.emoji}</span>}
      </div>

      {/* Stock badge */}
      <div className="absolute top-2 right-2">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: material.inStock ? '#F0FDF4' : '#FEF2F2',
            color:      material.inStock ? '#14532D' : '#DC2626',
          }}
        >
          {material.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      <div className="p-4">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.emoji} {cat.label}
        </span>
        <h3 className="text-sm font-bold mb-1 leading-snug" style={{ color: '#1C1C1C' }}>
          {material.name}
        </h3>
        {material.description && (
          <p className="text-xs mb-2" style={{ color: '#6B6B6B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {material.description}
          </p>
        )}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-base font-bold" style={{ color: '#C89B3C' }}>
              {fmt(material.sellPricePaise)}
            </p>
            <p className="text-[10px]" style={{ color: '#A8927F' }}>
              per {material.unit} · Cost: {fmt(material.costPricePaise)}
            </p>
          </div>
          {margin > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#F0FDF4', color: '#14532D' }}>
              {margin}%
            </span>
          )}
        </div>
        {material.vendorName && (
          <p className="text-xs mb-3" style={{ color: '#6B6B6B' }}>
            Vendor: <span className="font-medium" style={{ color: '#6F4E37' }}>{material.vendorName}</span>
          </p>
        )}
        {isOwner && (
          <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #E9DFD3' }}>
            <button type="button" onClick={() => onEdit(material)}
              className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[#E9DFD3] transition-colors"
              style={{ color: '#6F4E37' }}>
              <Edit2 className="h-3.5 w-3.5" />Edit
            </button>
            <button type="button" onClick={() => onDelete(material.id)}
              className="flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
              style={{ color: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Material Row (list view) ─────────────────────────────────────────────── */
function MaterialRow({
  material, isOwner, onEdit, onDelete,
}: {
  material: Material;
  isOwner: boolean;
  onEdit: (m: Material) => void;
  onDelete: (id: string) => void;
}) {
  const cat    = CATEGORY_CONFIG[material.category];
  const margin = marginPct(material.sellPricePaise, material.costPricePaise);

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[#FDFCFB] transition-colors mb-1.5"
      style={{ border: '1px solid #E9DFD3' }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: cat.bg }}>
        {cat.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#1C1C1C' }}>{material.name}</p>
        <p className="text-xs" style={{ color: '#6B6B6B' }}>
          {cat.label} · {material.unit}
          {material.vendorName && ` · ${material.vendorName}`}
        </p>
      </div>
      <div className="text-right flex-shrink-0 w-32">
        <p className="text-sm font-bold" style={{ color: '#C89B3C' }}>{fmt(material.sellPricePaise)}</p>
        <p className="text-xs" style={{ color: '#A8927F' }}>Cost: {fmt(material.costPricePaise)}</p>
      </div>
      {margin > 0 && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: '#F0FDF4', color: '#14532D' }}>{margin}%</span>
      )}
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: material.inStock ? '#F0FDF4' : '#FEF2F2', color: material.inStock ? '#14532D' : '#DC2626' }}>
        {material.inStock ? 'In Stock' : 'OOS'}
      </span>
      {isOwner && (
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={() => onEdit(material)}
            className="p-1.5 rounded-lg hover:bg-[#E9DFD3] transition-colors" title="Edit">
            <Edit2 className="h-3.5 w-3.5" style={{ color: '#6F4E37' }} />
          </button>
          <button type="button" onClick={() => onDelete(material.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" style={{ color: '#DC2626' }} />
          </button>
        </div>
      )}
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
  const [form, setForm]     = useState<MaterialForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof MaterialForm, string>>>({});

  /* eslint-disable react-hooks/set-state-in-effect */
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
    setErrors({});
  }, [initial, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  if (!open) return null;

  const sellPaise = Number(form.sellPriceRupees) * 100;
  const costPaise = Number(form.costPriceRupees) * 100;
  const margin    = marginPct(sellPaise, costPaise);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #E9DFD3' }}>
          <h2 className="text-base font-bold" style={{ color: '#3D2314' }}>
            {initial ? 'Edit Material' : 'Add Material'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#E9DFD3]">
            <X className="h-4 w-4" style={{ color: '#6B6B6B' }} />
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
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="studio-input w-full text-sm">
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="studio-label block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Optional details, specs, brand…" className="studio-input w-full text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Cost Price ₹ *</label>
              <input type="number" min={0} step={0.01} value={form.costPriceRupees}
                onChange={e => set('costPriceRupees', e.target.value)} placeholder="0" className="studio-input w-full text-sm" />
              {errors.costPriceRupees && <p className="text-xs text-red-600 mt-1">{errors.costPriceRupees}</p>}
            </div>
            <div>
              <label className="studio-label block mb-1.5">Sell Price ₹ *</label>
              <input type="number" min={0} step={0.01} value={form.sellPriceRupees}
                onChange={e => set('sellPriceRupees', e.target.value)} placeholder="0" className="studio-input w-full text-sm" />
              {errors.sellPriceRupees && <p className="text-xs text-red-600 mt-1">{errors.sellPriceRupees}</p>}
            </div>
          </div>
          {margin > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
              <span className="text-xs font-semibold" style={{ color: '#14532D' }}>Margin: {margin}% on sell price</span>
            </div>
          )}
          <div>
            <label className="studio-label block mb-1.5">Vendor Name</label>
            <input type="text" value={form.vendorName} onChange={e => set('vendorName', e.target.value)}
              placeholder="e.g. Kitply Industries" className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Image URL</label>
            <div className="flex gap-2">
              <input type="url" value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)}
                placeholder="https://…" className="studio-input flex-1 text-sm" />
              <button type="button" className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
                <Upload className="h-3.5 w-3.5" />Upload
              </button>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: form.inStock ? '#6F4E37' : '#D1D5DB' }}
              onClick={() => set('inStock', !form.inStock)}
            >
              <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                style={{ left: form.inStock ? 22 : 4 }} />
            </div>
            <span className="text-sm font-medium" style={{ color: '#1C1C1C' }}>
              {form.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </label>
        </div>
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #E9DFD3' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2 text-sm">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Material'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function MaterialsPage() {
  const [materials, setMaterials]           = useState<Material[]>([]);
  const [loading, setLoading]               = useState(true);
  const [viewMode, setViewMode]             = useState<'grid' | 'list'>('grid');
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'all'>('all');
  const [modalOpen, setModalOpen]           = useState(false);
  const [editTarget, setEditTarget]         = useState<Material | undefined>();
  const isOwner                             = true; // TODO: pull from Supabase auth context

  useEffect(() => {
    fetch('/api/v1/materials')
      .then(r => r.json())
      .then(({ data }: { data: Material[] | null }) => { setMaterials(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = materials;
    if (activeCategory !== 'all') result = result.filter(m => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.vendorName ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [materials, activeCategory, search]);

  const handleSave = useCallback(async (form: MaterialForm) => {
    const body = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      unit: form.unit,
      costPricePaise:  Math.round(Number(form.costPriceRupees)  * 100),
      sellPricePaise:  Math.round(Number(form.sellPriceRupees)  * 100),
      vendorName: form.vendorName.trim() || undefined,
      imageUrl:   form.imageUrl.trim()   || undefined,
      inStock: form.inStock,
    };
    if (editTarget) {
      const res = await fetch(`/api/v1/materials/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: Material };
        setMaterials(prev => prev.map(m => m.id === editTarget.id ? data : m));
      }
    } else {
      const res = await fetch('/api/v1/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: Material };
        setMaterials(prev => [data, ...prev]);
      }
    }
    setEditTarget(undefined);
  }, [editTarget]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this material? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/materials/${id}`, { method: 'DELETE' });
    if (res.ok) setMaterials(prev => prev.filter(m => m.id !== id));
  }

  function openEdit(m: Material) { setEditTarget(m); setModalOpen(true); }
  function openAdd() { setEditTarget(undefined); setModalOpen(true); }

  const categories = Object.keys(CATEGORY_CONFIG) as MaterialCategory[];

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Material Library</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>
            {materials.length} items · {filtered.length} shown
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" />Add Material
          </button>
        )}
      </div>

      {/* ── Search + view toggle ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8927F' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search materials…" className="studio-input w-full pl-9 text-sm py-2" />
        </div>
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #C8B7A6' }}>
          <button type="button" onClick={() => setViewMode('grid')} className="px-3 py-2 transition-colors"
            style={{ background: viewMode === 'grid' ? '#6F4E37' : '#FFFFFF', color: viewMode === 'grid' ? '#FFFFFF' : '#6F4E37' }}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setViewMode('list')} className="px-3 py-2 transition-colors"
            style={{ background: viewMode === 'list' ? '#6F4E37' : '#FFFFFF', color: viewMode === 'list' ? '#FFFFFF' : '#6F4E37' }}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setActiveCategory('all')}
          className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors"
          style={{ background: activeCategory === 'all' ? '#6F4E37' : '#FFFFFF', color: activeCategory === 'all' ? '#FFFFFF' : '#6F4E37', border: '1px solid #C8B7A6' }}>
          All ({materials.length})
        </button>
        {categories.map(cat => {
          const count = materials.filter(m => m.category === cat).length;
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
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

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
          style={{ borderColor: '#E9DFD3' }}>
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(111,78,55,0.08)' }}>
            <Package className="h-7 w-7" style={{ color: '#C8B7A6' }} />
          </div>
          <p className="text-sm" style={{ color: '#6B6B6B' }}>
            {search || activeCategory !== 'all' ? 'No materials match your filters.' : 'No materials yet.'}
          </p>
          {isOwner && !search && activeCategory === 'all' && (
            <button type="button" onClick={openAdd} className="btn-secondary px-4 py-2 text-sm">
              Add your first material
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => (
            <MaterialCard key={m.id} material={m} isOwner={isOwner} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div>
          {filtered.map(m => (
            <MaterialRow key={m.id} material={m} isOwner={isOwner} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <MaterialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  );
}
