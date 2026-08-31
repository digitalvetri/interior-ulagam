'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Package, X, ChevronUp, ChevronDown,
  Grid3X3, List, MoreVertical, Download, Clock,
  ChevronLeft, ChevronRight, Tag,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────────────── */
type MaterialCategory =
  | 'laminate'
  | 'hardware'
  | 'furniture'
  | 'fabric'
  | 'lighting'
  | 'flooring'
  | 'sanitary'
  | 'other';

type SortKey = 'name' | 'category' | 'currentRatePaise';
type ViewMode = 'table' | 'grid';

interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  currentRatePaise: number;
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

/* ── Category config ──────────────────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<MaterialCategory, { label: string; emoji: string; bg: string; color: string }> = {
  laminate:  { label: 'Laminates',        emoji: '📋', bg: 'var(--success-soft)',  color: 'var(--success-text)' },
  hardware:  { label: 'Hardware',         emoji: '🔩', bg: 'var(--surface-muted)', color: 'var(--text-primary)' },
  furniture: { label: 'Furniture',        emoji: '🪑', bg: '#FDF3E8',              color: '#92400E' },
  fabric:    { label: 'Fabrics',          emoji: '🧵', bg: 'var(--accent-soft)',   color: '#6B21A8' },
  lighting:  { label: 'Lighting',         emoji: '💡', bg: '#FEFCE8',              color: '#713F12' },
  flooring:  { label: 'Flooring & Tiles', emoji: '🏛️', bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
  sanitary:  { label: 'Sanitary',         emoji: '🚿', bg: '#EFF6FF',              color: '#1D4ED8' },
  other:     { label: 'Other',            emoji: '📦', bg: '#FAF9F6',              color: 'var(--text-primary)' },
};

const UNIT_OPTIONS = ['sqft', 'piece', 'running ft', 'box', 'litre', 'kg', 'set', 'pair', 'nos'];
const PAGE_SIZE = 20;

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function exportCSV(list: Material[]) {
  const rows = [
    ['Name', 'Category', 'Brand', 'Unit', 'Current Rate (₹)', 'Last Purchase (₹)', 'HSN/SAC', 'Notes'],
    ...list.map(m => [
      m.name,
      CATEGORY_CONFIG[m.category]?.label ?? m.category,
      m.brand ?? '',
      m.unit,
      (m.currentRatePaise / 100).toFixed(2),
      m.lastPurchasePricePaise != null ? (m.lastPurchasePricePaise / 100).toFixed(2) : '',
      m.hsnSac ?? '',
      m.notes ?? '',
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
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="min-w-0">
        <p className="text-xs font-medium mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: 'var(--text-heading)' }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>
      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: iconBg, color: iconColor }}>
        <Icon className="h-4 w-4" />
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
        name:               initial.name,
        category:           initial.category,
        unit:               initial.unit,
        currentRateRupees:  String(initial.currentRatePaise / 100),
        brand:              initial.brand ?? '',
        hsnSac:             initial.hsnSac ?? '',
        notes:              initial.notes ?? '',
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
    if (!form.name.trim())         errs.name             = 'Name is required';
    if (!form.currentRateRupees)   errs.currentRateRupees = 'Rate is required';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
            {initial ? 'Edit Material' : 'Add Material'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Name */}
          <div>
            <label className="studio-label block mb-1.5">Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Marine Plywood 19mm" className="studio-input w-full text-sm" />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Category + Unit */}
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

          {/* Brand */}
          <div>
            <label className="studio-label block mb-1.5">Brand</label>
            <input type="text" value={form.brand} onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Merino, Greenlam, Hafele" className="studio-input w-full text-sm" />
          </div>

          {/* Current Rate */}
          <div>
            <label className="studio-label block mb-1.5">Current Rate ₹ *</label>
            <input type="number" min={0} step={0.01} value={form.currentRateRupees}
              onChange={e => set('currentRateRupees', e.target.value)} placeholder="0"
              className="studio-input w-full text-sm" />
            {errors.currentRateRupees && <p className="text-xs text-red-600 mt-1">{errors.currentRateRupees}</p>}
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              This is your purchase cost per {form.unit}. The previous rate is saved automatically as history.
            </p>
          </div>

          {/* HSN/SAC */}
          <div>
            <label className="studio-label block mb-1.5">HSN / SAC Code</label>
            <input type="text" value={form.hsnSac} onChange={e => set('hsnSac', e.target.value)}
              placeholder="e.g. 4412" className="studio-input w-full text-sm" />
          </div>

          {/* Notes */}
          <div>
            <label className="studio-label block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Specs, thickness, finish, supplier notes…"
              className="studio-input w-full text-sm resize-none" />
          </div>

        </div>

        {apiError && (
          <div className="mx-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex-shrink-0">
            {apiError}
          </div>
        )}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
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

/* ── Table header cell ────────────────────────────────────────────────────── */
function Th({
  col, label, align = 'left', sortKey, sortDir, onSort,
}: {
  col: SortKey; label: string; align?: 'left' | 'right';
  sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (col: SortKey) => void;
}) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)', whiteSpace: 'nowrap' }}
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
  m, open, onToggle, onEdit, onDelete,
}: {
  m: Material; open: boolean;
  onToggle: (id: string | null) => void;
  onEdit: (m: Material) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button type="button"
        onClick={e => { e.stopPropagation(); onToggle(open ? null : m.id); }}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--border-subtle)]">
        <MoreVertical className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border shadow-lg overflow-hidden"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <button type="button" onClick={() => onEdit(m)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors">
            <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-heading)' }}>Edit</span>
          </button>
          <div style={{ borderTop: '1px solid var(--border-subtle)' }} />
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

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function MaterialsPage() {
  const [materialsList, setMaterialsList]   = useState<Material[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'all'>('all');
  const [sortKey, setSortKey]               = useState<SortKey>('name');
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode]             = useState<ViewMode>('table');
  const [page, setPage]                     = useState(1);
  const [menuOpenId, setMenuOpenId]         = useState<string | null>(null);
  const [modalOpen, setModalOpen]           = useState(false);
  const [editTarget, setEditTarget]         = useState<Material | undefined>();
  const isOwner                             = true;
  const [loadedAt, setLoadedAt]             = useState<number>(() => 0);

  useEffect(() => {
    fetch('/api/v1/materials')
      .then(r => r.json())
      .then(({ data }: { data: Material[] | null }) => {
        setMaterialsList(data ?? []); setLoadedAt(Date.now()); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ── Derived stats ──────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const thirtyDaysAgo  = loadedAt - 30 * 24 * 60 * 60 * 1000;
    const withBrand      = materialsList.filter(m => m.brand).length;
    const recentCount    = materialsList.filter(m => new Date(m.createdAt).getTime() > thirtyDaysAgo).length;
    const uniqueCats     = new Set(materialsList.map(m => m.category)).size;
    const avgRate        = materialsList.length
      ? Math.round(materialsList.reduce((s, m) => s + m.currentRatePaise, 0) / materialsList.length)
      : 0;
    return { total: materialsList.length, withBrand, recentCount, uniqueCats, avgRate };
  }, [materialsList, loadedAt]);

  /* ── Filter + sort ──────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = materialsList;
    if (activeCategory !== 'all') result = result.filter(m => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.brand ?? '').toLowerCase().includes(q) ||
        (m.notes ?? '').toLowerCase().includes(q) ||
        (m.hsnSac ?? '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'category') {
        av = CATEGORY_CONFIG[a.category]?.label ?? a.category;
        bv = CATEGORY_CONFIG[b.category]?.label ?? b.category;
      } else {
        av = a[sortKey] as number | string;
        bv = b[sortKey] as number | string;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [materialsList, activeCategory, search, sortKey, sortDir]);

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

  function clearFilters() { setSearch(''); setActiveCategory('all'); setPage(1); }
  const hasFilters = !!(search || activeCategory !== 'all');

  const handleSave = useCallback(async (form: MaterialForm) => {
    const currentRatePaise = Math.round(Number(form.currentRateRupees) * 100);

    if (editTarget) {
      // PATCH only accepts the strict subset: currentRatePaise, name, brand, unit, hsnSac, notes
      const body: Record<string, unknown> = { name: form.name.trim() };
      if (form.unit)  body.unit  = form.unit;
      if (currentRatePaise !== editTarget.currentRatePaise) body.currentRatePaise = currentRatePaise;
      if (form.brand.trim())  body.brand  = form.brand.trim();
      if (form.hsnSac.trim()) body.hsnSac = form.hsnSac.trim();
      if (form.notes.trim())  body.notes  = form.notes.trim();

      const res = await fetch(`/api/v1/materials/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: unknown };
      if (!res.ok) throw new Error(JSON.stringify(json.error) ?? `Failed (${res.status})`);
      setMaterialsList(prev => prev.map(m => m.id === editTarget.id ? json.data! : m));
    } else {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        currentRatePaise,
      };
      if (form.brand.trim())  body.brand  = form.brand.trim();
      if (form.hsnSac.trim()) body.hsnSac = form.hsnSac.trim();
      if (form.notes.trim())  body.notes  = form.notes.trim();

      const res = await fetch('/api/v1/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: Material; error?: unknown };
      if (!res.ok) throw new Error(JSON.stringify(json.error) ?? `Failed (${res.status})`);
      setMaterialsList(prev => [json.data!, ...prev]);
    }
    setEditTarget(undefined);
  }, [editTarget]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this material? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/materials/${id}`, { method: 'DELETE' });
    if (res.ok) setMaterialsList(prev => prev.filter(m => m.id !== id));
    setMenuOpenId(null);
  }

  function openEdit(m: Material) { setEditTarget(m); setModalOpen(true); setMenuOpenId(null); }
  function openAdd()              { setEditTarget(undefined); setModalOpen(true); }

  const categories = Object.keys(CATEGORY_CONFIG) as MaterialCategory[];

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
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Material Library</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
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
          icon={Package} iconBg="var(--accent-soft)" iconColor="var(--accent-base)" />
        <StatCard label="Categories" value={stats.uniqueCats}
          icon={Grid3X3} iconBg="var(--success-soft)" iconColor="var(--success)" />
        <StatCard label="Avg. Rate" value={stats.avgRate > 0 ? fmt(stats.avgRate) : '—'}
          sub="across all materials"
          icon={Tag} iconBg="var(--surface-muted)" iconColor="var(--text-secondary)" />
        <StatCard label="With Brand" value={stats.withBrand}
          sub={stats.total ? `${Math.round(stats.withBrand / stats.total * 100)}% catalogued` : undefined}
          icon={Tag} iconBg="#FDF3E8" iconColor="#92400E" />
        <StatCard label="Recently Added" value={stats.recentCount} sub="last 30 days"
          icon={Clock} iconBg="#FEFCE8" iconColor="var(--warning)" />
      </div>

      {/* ── Search + Export ─────────────────────────────────────────────── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="studio-search-icon" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, brand, notes, or HSN…"
            className="studio-input w-full text-sm h-10" />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </div>
        <button type="button" onClick={() => exportCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--surface-card)' }}>
          <Download className="h-4 w-4" />
          Export
        </button>

        {hasFilters && (
          <button type="button" onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:bg-red-50"
            style={{ borderColor: 'var(--danger-soft)', color: 'var(--danger)', background: 'var(--danger-soft)' }}>
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-xl border p-1"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-card)' }}>
          <button type="button" onClick={() => setViewMode('table')}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: viewMode === 'table' ? 'var(--text-primary)' : 'transparent' }}>
            <List className="h-4 w-4" style={{ color: viewMode === 'table' ? 'var(--surface-card)' : 'var(--text-secondary)' }} />
          </button>
          <button type="button" onClick={() => setViewMode('grid')}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: viewMode === 'grid' ? 'var(--text-primary)' : 'transparent' }}>
            <Grid3X3 className="h-4 w-4" style={{ color: viewMode === 'grid' ? 'var(--surface-card)' : 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* ── Category pills ─────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => { setActiveCategory('all'); setPage(1); }}
          className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            background: activeCategory === 'all' ? 'var(--text-primary)' : 'var(--surface-card)',
            color: activeCategory === 'all' ? 'var(--surface-card)' : 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          }}>
          All ({materialsList.length})
        </button>
        {categories.map(cat => {
          const count = materialsList.filter(m => m.category === cat).length;
          if (count === 0) return null;
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button key={cat} type="button" onClick={() => { setActiveCategory(cat); setPage(1); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: activeCategory === cat ? cfg.color : cfg.bg,
                color:      activeCategory === cat ? 'var(--surface-card)' : cfg.color,
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
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} material
            {filtered.length !== 1 ? 's' : ''}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="p-1 rounded-lg disabled:opacity-30 hover:bg-[var(--border-subtle)] transition-colors">
                <ChevronLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const n = i + 1;
                return (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    className="min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: safePage === n ? 'var(--text-primary)' : 'transparent',
                      color: safePage === n ? 'var(--surface-card)' : 'var(--text-secondary)',
                    }}>
                    {n}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>…{totalPages}</span>}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="p-1 rounded-lg disabled:opacity-30 hover:bg-[var(--border-subtle)] transition-colors">
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
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
          style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(36,33,30,0.08)' }}>
            <Package className="h-7 w-7" style={{ color: 'var(--border-strong)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <Th col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th col="category" label="Category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                    style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>Brand</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                    style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>Unit</th>
                  <Th col="currentRatePaise" label="Current Rate" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right"
                    style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>Last Purchase</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                    style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>HSN/SAC</th>
                  {isOwner && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right"
                      style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)', width: 48 }} />
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((m, idx) => {
                  const cat = CATEGORY_CONFIG[m.category];
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-[#FDFCFB]"
                      style={{ borderBottom: idx < paginated.length - 1 ? '1px solid #F5F3F0' : undefined }}>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: cat?.bg ?? '#FAF9F6' }}>{cat?.emoji ?? '📦'}</div>
                          <div>
                            <p className="font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                            {m.notes && (
                              <p className="text-[10px] truncate max-w-[180px]" style={{ color: 'var(--text-tertiary)' }}>{m.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ background: cat?.bg ?? '#FAF9F6', color: cat?.color ?? 'var(--text-primary)' }}>
                          {cat?.emoji ?? '📦'} {cat?.label ?? m.category}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.brand ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.unit}
                      </td>

                      {/* Current Rate */}
                      <td className="px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap"
                        style={{ color: '#8F6F2E' }}>
                        {fmt(m.currentRatePaise)}
                        <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-tertiary)' }}>/{m.unit}</span>
                      </td>

                      {/* Last Purchase */}
                      <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.lastPurchasePricePaise != null
                          ? <>{fmt(m.lastPurchasePricePaise)}</>
                          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      {/* HSN/SAC */}
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {m.hsnSac ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>

                      {/* Actions */}
                      {isOwner && (
                        <td className="px-3 py-3 text-right">
                          <RowMenu m={m} open={menuOpenId === m.id} onToggle={setMenuOpenId}
                            onEdit={openEdit} onDelete={handleDelete} />
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
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
            <span>{filtered.length} material{filtered.length !== 1 ? 's' : ''}</span>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="font-medium hover:underline"
                style={{ color: 'var(--accent-base)' }}>Clear filters</button>
            )}
          </div>
        </div>

      ) : (
        /* ── Grid view ──────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginated.map(m => {
            const cat = CATEGORY_CONFIG[m.category];
            return (
              <div key={m.id} className="rounded-xl border p-4 hover:shadow-md transition-all"
                style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: cat?.bg ?? '#FAF9F6' }}>{cat?.emoji ?? '📦'}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>{m.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>per {m.unit}</p>
                    </div>
                  </div>
                  {isOwner && <RowMenu m={m} open={menuOpenId === m.id} onToggle={setMenuOpenId}
                    onEdit={openEdit} onDelete={handleDelete} />}
                </div>

                {/* Category */}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mb-2"
                  style={{ background: cat?.bg ?? '#FAF9F6', color: cat?.color ?? 'var(--text-primary)' }}>
                  {cat?.emoji} {cat?.label ?? m.category}
                </span>

                {/* Brand */}
                {m.brand && (
                  <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Brand: </span>{m.brand}
                  </p>
                )}

                {/* Rate */}
                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Current Rate</p>
                    <p className="font-bold text-sm" style={{ color: '#8F6F2E' }}>{fmt(m.currentRatePaise)}</p>
                  </div>
                  {m.lastPurchasePricePaise != null && m.lastPurchasePricePaise !== m.currentRatePaise && (
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Prev. Rate</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{fmt(m.lastPurchasePricePaise)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      <MaterialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  );
}
