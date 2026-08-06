'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Plus, X, Trash2, Search, ChevronRight,
  Clock, CheckCircle2, XCircle, Truck, FileText,
  Calendar, Package, AlertCircle,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { PurchaseOrder, POStatus } from '@/types/purchase-orders';

/* ── Status config ────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<POStatus, { label: string; bg: string; color: string; dot: string }> = {
  draft:        { label: 'Draft',        bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
  sent:         { label: 'Sent',         bg: 'var(--accent-soft)', color: '#6B21A8', dot: 'var(--accent-base)' },
  acknowledged: { label: 'Acknowledged', bg: 'var(--warning-soft)', color: 'var(--warning-text)', dot: 'var(--warning)' },
  partial:      { label: 'Partial',      bg: '#F0FDFA', color: '#115E59', dot: '#14B8A6' },
  complete:     { label: 'Complete',     bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
  cancelled:    { label: 'Cancelled',    bg: 'var(--danger-soft)', color: 'var(--danger)', dot: 'var(--danger)' },
};

const UNITS = ['sqft', 'piece', 'running ft', 'box', 'litre', 'kg', 'set', 'pair', 'bag', 'roll'];

/* ── Line item form row ───────────────────────────────────────────────────── */
interface LineRow {
  _key: string;
  description: string;
  qty: string;
  unit: string;
  unitRateRupees: string;
}

function emptyLine(): LineRow {
  return { _key: Math.random().toString(36).slice(2), description: '', qty: '', unit: 'piece', unitRateRupees: '' };
}

function lineTotal(row: LineRow): number {
  const q = Number(row.qty);
  const r = Number(row.unitRateRupees);
  return isNaN(q) || isNaN(r) ? 0 : q * r;
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, iconBg, iconColor, active, onClick,
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-4 text-left transition-all hover:shadow-md w-full"
      style={{
        background: active ? iconBg : 'var(--surface-card)',
        borderColor: active ? iconColor + '66' : 'var(--border-subtle)',
        outline: active ? `2px solid ${iconColor}33` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
        </div>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg, color: iconColor }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

/* ── New PO Modal ─────────────────────────────────────────────────────────── */
function NewPOModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (po: PurchaseOrder) => void;
}) {
  const [projectId, setProjectId]         = useState('');
  const [expectedDate, setExpectedDate]   = useState('');
  const [lines, setLines]                 = useState<LineRow[]>([emptyLine()]);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [apiErr, setApiErr]               = useState<string | null>(null);

  function setLine(key: string, field: keyof Omit<LineRow, '_key'>, val: string) {
    setLines(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function addLine() { setLines(prev => [...prev, emptyLine()]); }

  function removeLine(key: string) {
    setLines(prev => prev.length > 1 ? prev.filter(r => r._key !== key) : prev);
  }

  const grandTotal = lines.reduce((s, r) => s + lineTotal(r), 0);

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!projectId.trim()) errs.projectId = 'Project ID is required';
    lines.forEach(r => {
      if (!r.description.trim()) errs[r._key] = 'Description required';
      else if (!r.qty || Number(r.qty) <= 0) errs[r._key] = 'Qty must be > 0';
      else if (!r.unitRateRupees || Number(r.unitRateRupees) <= 0) errs[r._key] = 'Rate must be > 0';
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setApiErr(null);
    try {
      const linesJson = lines.map(r => ({
        description:   r.description.trim(),
        qty:           Number(r.qty),
        unit:          r.unit,
        unitRatePaise: Math.round(Number(r.unitRateRupees) * 100),
        totalPaise:    Math.round(Number(r.qty) * Number(r.unitRateRupees) * 100),
      }));
      const body: Record<string, unknown> = { projectId: projectId.trim(), linesJson };
      if (expectedDate) body.expectedDeliveryAt = new Date(expectedDate).toISOString();

      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: PurchaseOrder; error?: string };
      if (!res.ok) { setApiErr(json.error ?? `Failed to create PO (${res.status})`); return; }
      onCreate(json.data!);
    } catch {
      setApiErr('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface-card)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-soft)' }}>
              <ShoppingCart className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>New Purchase Order</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Add line items and set delivery date</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* Project + Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="studio-label block mb-1.5">Project ID *</label>
              <input type="text" value={projectId} onChange={e => { setProjectId(e.target.value); setErrors(v => ({ ...v, projectId: '' })); }}
                placeholder="Paste project UUID…" className="studio-input w-full text-sm" />
              {errors.projectId && <p className="text-xs text-red-600 mt-1">{errors.projectId}</p>}
            </div>
            <div>
              <label className="studio-label block mb-1.5">Expected Delivery</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                  className="studio-input w-full text-sm pl-9" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="studio-label">Line Items *</label>
              <span className="text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                {lines.length} item{lines.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Column headers */}
              {/* Column template must match the line rows below exactly. */}
              <div className="grid text-[10px] font-semibold uppercase tracking-wide px-2 sm:px-3 py-2 gap-1.5 sm:gap-2 grid-cols-[1fr_44px_58px_64px_58px_26px] sm:grid-cols-[1fr_64px_80px_90px_80px_32px]"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="pl-2">Unit</span>
                <span className="text-right">Rate ₹</span>
                <span className="text-right">Total ₹</span>
                <span />
              </div>

              {/* Rows */}
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {lines.map(row => {
                  const total = lineTotal(row);
                  return (
                    <div key={row._key}
                      /* Was an inline template of 346px of fixed columns, which left
                         almost nothing for the description field on a phone. The
                         columns tighten below sm instead. */
                      className="grid items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 grid-cols-[1fr_44px_58px_64px_58px_26px] sm:grid-cols-[1fr_64px_80px_90px_80px_32px]">
                      <div>
                        <input type="text" value={row.description}
                          onChange={e => setLine(row._key, 'description', e.target.value)}
                          placeholder="e.g. Plywood 18mm" className="studio-input w-full text-xs py-1.5" />
                        {errors[row._key] && <p className="text-[10px] text-red-500 mt-0.5">{errors[row._key]}</p>}
                      </div>
                      <input type="number" min={0} step={1} value={row.qty}
                        onChange={e => setLine(row._key, 'qty', e.target.value)}
                        placeholder="0" className="studio-input w-full text-xs py-1.5 text-right" />
                      <select value={row.unit} onChange={e => setLine(row._key, 'unit', e.target.value)}
                        className="studio-input w-full text-xs py-1.5 pl-2">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" min={0} step={0.01} value={row.unitRateRupees}
                        onChange={e => setLine(row._key, 'unitRateRupees', e.target.value)}
                        placeholder="0" className="studio-input w-full text-xs py-1.5 text-right" />
                      <p className="text-xs font-semibold text-right tabular-nums pr-1"
                        style={{ color: total > 0 ? '#8F6F2E' : '#D1CBB8' }}>
                        {total > 0 ? `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                      </p>
                      <button type="button" onClick={() => removeLine(row._key)}
                        className="p-1 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center"
                        title="Remove">
                        <X className="h-3.5 w-3.5" style={{ color: lines.length > 1 ? 'var(--danger)' : '#D1CBB8' }} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer: add + grand total */}
              <div className="flex items-center justify-between px-3 py-2"
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                <button type="button" onClick={addLine}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
                  style={{ color: 'var(--accent-base)' }}>
                  <Plus className="h-3.5 w-3.5" />Add line
                </button>
                {grandTotal > 0 && (
                  <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    Grand Total: ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {apiErr && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {apiErr}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={saving}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {saving ? 'Creating…' : 'Create Purchase Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders]       = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');

  useEffect(() => {
    fetch('/api/v1/purchase-orders')
      .then(r => r.json())
      .then(({ data }: { data: PurchaseOrder[] }) => { setOrders(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* ── Stats ──────────────────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     orders.length,
    draft:     orders.filter(o => o.status === 'draft').length,
    active:    orders.filter(o => ['sent', 'acknowledged', 'partial'].includes(o.status)).length,
    complete:  orders.filter(o => o.status === 'complete').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders]);

  /* ── Filtered list ──────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => o.poNumber.toLowerCase().includes(q) || o.projectId.includes(q));
    }
    return list;
  }, [orders, statusFilter, search]);

  const handleCreate = useCallback((po: PurchaseOrder) => {
    setOrders(prev => [po, ...prev]);
    setModalOpen(false);
    router.push(`/purchase-orders/${po.id}`);
  }, [router]);

  /* ── Compute PO total value from lines ──────────────────────────────────── */
  function poValue(po: PurchaseOrder): number {
    if (!Array.isArray(po.linesJson)) return 0;
    return po.linesJson.reduce((s, l) => s + (l.totalPaise ?? 0), 0);
  }

  /* ── Status filter pills ────────────────────────────────────────────────── */
  const STATUS_PILLS: Array<{ key: POStatus | 'all'; label: string }> = [
    { key: 'all',       label: `All (${orders.length})` },
    { key: 'draft',     label: `Draft (${stats.draft})` },
    { key: 'sent',      label: `Sent` },
    { key: 'acknowledged', label: `Acknowledged` },
    { key: 'partial',   label: `Partial` },
    { key: 'complete',  label: `Complete (${stats.complete})` },
    { key: 'cancelled', label: `Cancelled (${stats.cancelled})` },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Purchase Orders</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Track procurement from vendors across all projects
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm flex-shrink-0 rounded-xl">
          <ShoppingCart className="h-4 w-4" />
          New Purchase Order
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total POs" value={stats.total}
            icon={FileText} iconBg="var(--accent-soft)" iconColor="var(--accent-base)"
            active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <StatCard label="Draft" value={stats.draft}
            icon={Package} iconBg="var(--surface-muted)" iconColor="var(--text-primary)"
            active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')} />
          <StatCard label="Active" value={stats.active}
            icon={Truck} iconBg="#F0FDFA" iconColor="#14B8A6"
            active={['sent','acknowledged','partial'].includes(statusFilter)}
            onClick={() => setStatusFilter('sent')} />
          <StatCard label="Complete" value={stats.complete}
            icon={CheckCircle2} iconBg="var(--success-soft)" iconColor="var(--success)"
            active={statusFilter === 'complete'} onClick={() => setStatusFilter('complete')} />
          <StatCard label="Cancelled" value={stats.cancelled}
            icon={XCircle} iconBg="var(--danger-soft)" iconColor="var(--danger)"
            active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
        </div>
      )}

      {/* ── Search + filter row ─────────────────────────────────────────── */}
      {!loading && orders.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="studio-search-icon" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by PO number…"
              className="studio-input w-full text-sm h-9" />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {STATUS_PILLS.filter(p => {
              if (p.key === 'all') return true;
              return orders.some(o => o.status === p.key);
            }).map(p => {
              const cfg = p.key !== 'all' ? STATUS_CONFIG[p.key] : null;
              const isActive = statusFilter === p.key ||
                (p.key === 'all' && statusFilter === 'all');
              return (
                <button key={p.key} type="button" onClick={() => setStatusFilter(p.key)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                  style={{
                    background: isActive ? (cfg?.bg ?? 'var(--accent-soft)') : 'var(--surface-card)',
                    color:      isActive ? (cfg?.color ?? 'var(--accent-base)') : 'var(--text-secondary)',
                    borderColor: isActive ? (cfg?.dot ?? 'var(--accent-base)') + '66' : 'var(--border-strong)',
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>

      ) : orders.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-24 w-24 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--accent-soft)' }}>
              <ShoppingCart className="h-12 w-12" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: '#EEF2FF', border: '2px solid var(--surface-card)' }}>
              <Plus className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
              No purchase orders yet
            </h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Create your first purchase order to start tracking material procurement for your projects.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-sm rounded-xl">
            <ShoppingCart className="h-4 w-4" />
            Create your first Purchase Order
          </button>
        </div>

      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-muted)' }}>
            <Search className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No purchase orders match your filters.</p>
          <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="btn-secondary text-sm px-4 py-2">Clear filters</button>
        </div>

      ) : (
        /* ── Table ────────────────────────────────────────────────────── */
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                  {['PO Number', 'Project', 'Status', 'PO Value', 'Advance Paid', 'Expected Delivery', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left"
                      style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po, idx) => {
                  const value = poValue(po);
                  return (
                    <tr key={po.id}
                      className="cursor-pointer transition-colors hover:bg-[#FDFCFB] group"
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F5F3F0' : undefined }}
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}>

                      {/* PO Number */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--accent-soft)' }}>
                            <ShoppingCart className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
                          </div>
                          <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{po.poNumber}</span>
                        </div>
                      </td>

                      {/* Project ID (truncated) */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs px-2 py-1 rounded-md"
                          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                          {po.projectId.slice(0, 8)}…
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={po.status} />
                      </td>

                      {/* PO Value */}
                      <td className="px-4 py-3.5 font-semibold tabular-nums"
                        style={{ color: value > 0 ? '#8F6F2E' : '#D1CBB8' }}>
                        {value > 0 ? formatRupees(value) : '—'}
                      </td>

                      {/* Advance Paid */}
                      <td className="px-4 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {po.advancePaidPaise > 0 ? formatRupees(po.advancePaidPaise) : '—'}
                      </td>

                      {/* Expected Delivery */}
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {po.expectedDeliveryAt ? (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                            {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN')}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          {new Date(po.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </td>

                      {/* Arrow */}
                      <td className="px-3 py-3.5">
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--accent-base)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 text-xs"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
            <span>{filtered.length} purchase order{filtered.length !== 1 ? 's' : ''}</span>
            {(search || statusFilter !== 'all') && (
              <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <NewPOModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
