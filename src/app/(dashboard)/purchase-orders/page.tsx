'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Trash2, FileText, PackageCheck, X, AlertTriangle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import type { POStatus, POLine } from '@/types/purchase-orders';
import type { PurchaseOrder as BasePurchaseOrder } from '@/types/purchase-orders';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface PurchaseOrder extends BasePurchaseOrder {
  projectName:       string | null;
  vendorName:        string | null;
  vendorContactName: string | null;
  lineCount:         number;
  totalPaise:        number;
}

interface ProjectOption { id: string; name: string; }
interface VendorOption  { id: string; name: string; }

/* ── Config ─────────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft', sent: 'Sent', acknowledged: 'Acknowledged',
  partial: 'Partial', complete: 'Received', cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<POStatus, { bg: string; fg: string; border: string }> = {
  draft:        { bg: 'var(--surface-muted)',  fg: 'var(--text-secondary)',  border: 'var(--border-subtle)' },
  sent:         { bg: '#EEF2FF',               fg: '#4338CA',                border: 'rgba(67,56,202,0.22)' },
  acknowledged: { bg: '#F5F3FF',               fg: '#7C3AED',                border: 'rgba(124,58,237,0.22)' },
  partial:      { bg: '#FFF7ED',               fg: '#C2410C',                border: 'rgba(194,65,12,0.22)' },
  complete:     { bg: 'var(--success-soft)',    fg: 'var(--success-text)',    border: 'rgba(15,157,110,0.24)' },
  cancelled:    { bg: '#FEE2E2',               fg: '#B91C1C',                border: '#FCA5A5' },
};

/* ── PO form ─────────────────────────────────────────────────────────────────── */

interface FormLine {
  id: string; description: string;
  qty: string; unit: string; unitRatePaise: string;
}

interface NewPOForm {
  projectId: string; vendorId: string;
  lines: FormLine[]; expectedDeliveryAt: string;
}

function makeEmptyLine(): FormLine {
  return { id: crypto.randomUUID(), description: '', qty: '', unit: '', unitRatePaise: '' };
}

const EMPTY_PO_FORM: NewPOForm = {
  projectId: '', vendorId: '', lines: [makeEmptyLine()], expectedDeliveryAt: '',
};

/* ── Tabs ────────────────────────────────────────────────────────────────────── */

type ActiveTab = 'pos' | 'items';
type POFilter  = POStatus | 'all' | 'open';

const OPEN_STATUSES = new Set<POStatus>(['draft', 'sent', 'acknowledged', 'partial']);

const PO_FILTER_PILLS: { key: POFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open' },
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Sent' },
  { key: 'partial',   label: 'Partial' },
  { key: 'complete',  label: 'Received' },
  { key: 'cancelled', label: 'Cancelled' },
];

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function PurchaseOrdersPage() {
  const router = useRouter();

  const [orders,   setOrders]   = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [vendors,  setVendors]  = useState<VendorOption[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');

  // PO filters
  const [poSearch,  setPoSearch]  = useState('');
  const [poFilter,  setPoFilter]  = useState<POFilter>('all');

  // New PO dialog
  const [poDialog,  setPoDialog]  = useState(false);
  const [poForm,    setPoForm]    = useState<NewPOForm>(EMPTY_PO_FORM);
  const [poSubmit,  setPoSubmit]  = useState(false);
  const [poError,   setPoError]   = useState<string | null>(null);

  // Delete confirm
  const [deletePO,      setDeletePO]      = useState<PurchaseOrder | null>(null);
  const [deletePOBusy,  setDeletePOBusy]  = useState(false);
  const [deletePOError, setDeletePOError] = useState<string | null>(null);

  /* ── Load ─────────────────────────────────────────────────────────────────── */

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, prRes, vnRes] = await Promise.all([
        fetch('/api/v1/purchase-orders').then(r => r.json()),
        fetch('/api/v1/projects').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/vendors').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setOrders(poRes.data ?? []);
      setProjects(Array.isArray(prRes.data) ? prRes.data : []);
      setVendors(Array.isArray(vnRes.data) ? vnRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  /* ── KPIs ─────────────────────────────────────────────────────────────────── */

  const kpis = useMemo(() => {
    const today   = new Date();
    const openPos = orders.filter(o => OPEN_STATUSES.has(o.status));
    return {
      openCount:  openPos.length,
      toPayPaise: openPos.reduce((s, o) => s + Math.max(0, o.totalPaise - (o.advancePaidPaise ?? 0)), 0),
      committed:  orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalPaise, 0),
      overdue:    openPos.filter(o => o.expectedDeliveryAt && new Date(o.expectedDeliveryAt) < today).length,
    };
  }, [orders]);

  /* ── Filtered POs ─────────────────────────────────────────────────────────── */

  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    return orders.filter(o => {
      if (poFilter === 'open'   && !OPEN_STATUSES.has(o.status))              return false;
      if (poFilter !== 'all' && poFilter !== 'open' && o.status !== poFilter) return false;
      if (!q) return true;
      return (
        o.poNumber.toLowerCase().includes(q) ||
        (o.projectName ?? '').toLowerCase().includes(q) ||
        (o.vendorName  ?? '').toLowerCase().includes(q)
      );
    });
  }, [orders, poSearch, poFilter]);

  /* ── All Items (flatten linesJson) ────────────────────────────────────────── */

  const allItems = useMemo(() =>
    orders.flatMap(o =>
      (o.linesJson ?? []).map(l => ({
        ...l,
        poNumber:    o.poNumber,
        poId:        o.id,
        projectName: o.projectName,
        vendorName:  o.vendorName,
        poStatus:    o.status,
      })),
    ),
  [orders]);

  /* ── PO handlers ──────────────────────────────────────────────────────────── */

  function openPoDialog() {
    setPoForm({ ...EMPTY_PO_FORM, lines: [makeEmptyLine()] });
    setPoError(null);
    setPoDialog(true);
  }

  function updateLine(id: string, patch: Partial<FormLine>) {
    setPoForm(prev => ({ ...prev, lines: prev.lines.map(l => l.id === id ? { ...l, ...patch } : l) }));
  }
  function addLine() { setPoForm(prev => ({ ...prev, lines: [...prev.lines, makeEmptyLine()] })); }
  function removeLine(id: string) {
    setPoForm(prev => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter(l => l.id !== id) : prev.lines,
    }));
  }

  const poTotal = useMemo(
    () => poForm.lines.reduce((s, l) => s + (Number(l.qty) || 0) * Math.round((Number(l.unitRatePaise) || 0) * 100), 0),
    [poForm.lines],
  );

  async function handleCreatePO() {
    setPoError(null);
    if (!poForm.projectId) { setPoError('Please choose a project.'); return; }
    const validLines: POLine[] = [];
    for (const l of poForm.lines) {
      const desc = l.description.trim();
      const qty  = Number(l.qty);
      const rate = Number(l.unitRatePaise);
      if (!desc && !l.qty && !l.unitRatePaise) continue;
      if (!desc)                              { setPoError('Every line needs a description.'); return; }
      if (!Number.isFinite(qty) || qty <= 0)  { setPoError(`"${desc}" — qty must be positive.`); return; }
      if (!Number.isFinite(rate) || rate < 0) { setPoError(`"${desc}" — rate must be valid.`); return; }
      const unitRatePaise = Math.round(rate * 100);
      validLines.push({ id: l.id, description: desc, qty, unit: l.unit.trim() || 'unit', unitRatePaise, totalPaise: Math.round(qty * unitRatePaise) });
    }
    if (!validLines.length) { setPoError('Add at least one line item.'); return; }

    const body: Record<string, unknown> = { projectId: poForm.projectId, linesJson: validLines };
    if (poForm.vendorId)           body.vendorId           = poForm.vendorId;
    if (poForm.expectedDeliveryAt) body.expectedDeliveryAt = new Date(poForm.expectedDeliveryAt).toISOString();

    setPoSubmit(true);
    try {
      const res  = await fetch('/api/v1/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: PurchaseOrder; error?: unknown };
      if (!res.ok) { setPoError(typeof json.error === 'string' ? json.error : 'Failed to create.'); return; }
      setOrders(prev => [json.data!, ...prev]);
      setPoDialog(false);
      router.push(`/purchase-orders/${json.data!.id}`);
    } catch { setPoError('Network error — please try again.'); }
    finally  { setPoSubmit(false); }
  }

  async function handleDeletePO() {
    if (!deletePO) return;
    setDeletePOBusy(true); setDeletePOError(null);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${deletePO.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setDeletePOError(b.error ?? 'Failed to delete');
        return;
      }
      setOrders(prev => prev.filter(o => o.id !== deletePO.id));
      setDeletePO(null);
    } catch { setDeletePOError('Network error'); }
    finally  { setDeletePOBusy(false); }
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Purchase Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${orders.length} order${orders.length !== 1 ? 's' : ''} across your projects`}
          </p>
        </div>
        <button type="button" onClick={openPoDialog}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" strokeWidth={2.25} />New PO
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'OPEN POS',             value: loading ? '—' : String(kpis.openCount),         sub: 'not yet received' },
          { label: 'TO PAY VENDORS',       value: loading ? '—' : formatRupees(kpis.toPayPaise),  sub: 'net of advance paid' },
          { label: 'COMMITTED',            value: loading ? '—' : formatRupees(kpis.committed),   sub: 'total order value' },
          { label: 'OVERDUE',              value: loading ? '—' : String(kpis.overdue),            sub: 'past expected date' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <div className="flex items-center gap-1 px-4 pt-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {([
            { key: 'pos',   label: 'Purchase Orders', count: orders.length },
            { key: 'items', label: 'Items',            count: allItems.length },
          ] as { key: ActiveTab; label: string; count: number }[]).map(({ key, label, count }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg transition-colors"
              style={{
                color:      activeTab === key ? 'var(--accent-base)' : 'var(--text-secondary)',
                background: activeTab === key ? 'var(--accent-soft)' : 'transparent',
                fontWeight: activeTab === key ? 700 : 500,
              }}>
              {label}
              <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === key ? 'var(--accent-base)' : 'var(--surface-muted)',
                  color:      activeTab === key ? '#fff' : 'var(--text-tertiary)',
                  fontWeight: 600,
                }}>
                {loading ? '…' : count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Purchase Orders tab ──────────────────────────────────────────── */}
        {activeTab === 'pos' && (
          <div>
            <div className="px-4 py-3 flex flex-wrap items-center gap-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap gap-1.5">
                {PO_FILTER_PILLS.map(({ key, label }) => {
                  const count = key === 'all'  ? orders.length
                              : key === 'open' ? orders.filter(o => OPEN_STATUSES.has(o.status)).length
                              : orders.filter(o => o.status === key).length;
                  if (key !== 'all' && key !== 'open' && count === 0) return null;
                  const active = poFilter === key;
                  return (
                    <button key={key} type="button" onClick={() => setPoFilter(key)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium border transition-all"
                      style={active
                        ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                        : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }
                      }>
                      {label}
                      <span className="tabular-nums" style={{ opacity: 0.8 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input type="text" value={poSearch} onChange={e => setPoSearch(e.target.value)}
                  placeholder="Search PO #, project, vendor…"
                  className="studio-input w-full text-sm h-8" style={{ paddingLeft: '2.25rem' }} />
                {poSearch && (
                  <button type="button" onClick={() => setPoSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <POSkeleton />
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="h-11 w-11 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent-soft)' }}>
                  <FileText className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No purchase orders yet.</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Raise your first PO to start tracking orders.{' '}
                  <button type="button" onClick={openPoDialog}
                    className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                    New PO →
                  </button>
                </p>
              </div>
            ) : filteredPOs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No orders match your filters.</p>
                <button type="button" onClick={() => { setPoSearch(''); setPoFilter('all'); }}
                  className="text-xs font-medium" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {['PO #', 'Project', 'Vendor', 'Items', 'Value', 'Status', 'Expected', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-xs font-semibold tracking-wide"
                          style={{ color: 'var(--text-secondary)', textAlign: ['Items', 'Value'].includes(h) ? 'right' : 'left' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPOs.map((po, idx) => {
                      const s = STATUS_STYLES[po.status];
                      return (
                        <tr key={po.id}
                          className="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                          style={{ borderBottom: idx < filteredPOs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                          onClick={() => router.push(`/purchase-orders/${po.id}`)}>
                          <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--text-heading)' }}>
                            {po.poNumber}
                          </td>
                          <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: 'var(--text-primary)' }}>
                            {po.projectName ?? <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{po.projectId.slice(0, 8)}…</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[130px] truncate" style={{ color: 'var(--text-secondary)' }}>
                            {po.vendorName ?? po.vendorContactName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {po.lineCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>
                            {formatRupees(po.totalPaise)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium border"
                              style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
                              {STATUS_LABELS[po.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {po.expectedDeliveryAt
                              ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {po.status === 'draft' && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setDeletePOError(null); setDeletePO(po); }}
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-all">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(poSearch || poFilter !== 'all') && (
                  <div className="px-4 py-2 text-xs flex justify-between"
                    style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
                    <span>{filteredPOs.length} of {orders.length}</span>
                    <button type="button" onClick={() => { setPoSearch(''); setPoFilter('all'); }}
                      className="font-medium" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Items tab ────────────────────────────────────────────────────── */}
        {activeTab === 'items' && (
          <div>
            {loading ? (
              <POSkeleton />
            ) : allItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PackageCheck className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No items ordered yet.</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Items from all purchase orders will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Description', 'PO #', 'Project', 'Vendor', 'Qty', 'Unit', 'Rate', 'Total', 'Status'].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold tracking-wide"
                          style={{ color: 'var(--text-secondary)', textAlign: ['Qty', 'Rate', 'Total'].includes(h) ? 'right' : 'left' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map((item, idx) => {
                      const s = STATUS_STYLES[item.poStatus as POStatus];
                      return (
                        <tr key={`${item.poId}-${item.id}`}
                          className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                          style={{ borderBottom: idx < allItems.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                          onClick={() => router.push(`/purchase-orders/${item.poId}`)}>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-heading)' }}>{item.description}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{item.poNumber}</td>
                          <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>{item.projectName ?? '—'}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.vendorName ?? '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.qty}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(item.unitRatePaise)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>{formatRupees(item.totalPaise)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium border"
                              style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
                              {STATUS_LABELS[item.poStatus as POStatus]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-xs"
                  style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
                  {allItems.length} line item{allItems.length !== 1 ? 's' : ''} across {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New PO Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={poDialog} onOpenChange={setPoDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Project" required>
                <select value={poForm.projectId} onChange={e => setPoForm(f => ({ ...f, projectId: e.target.value }))}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">Choose a project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Vendor" hint="Optional">
                <select value={poForm.vendorId} onChange={e => setPoForm(f => ({ ...f, vendorId: e.target.value }))}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">No vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </FormField>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Line items</span>
                <button type="button" onClick={addLine}
                  className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  <Plus className="h-3 w-3" strokeWidth={2.25} />Add line
                </button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', gridTemplateColumns: 'minmax(0,1fr) 70px 70px 110px 90px 28px', gap: 8 }}>
                  <span>Description</span><span className="text-right">Qty</span>
                  <span>Unit</span><span className="text-right">Rate (₹)</span>
                  <span className="text-right">Total</span><span />
                </div>
                {poForm.lines.map((l, idx) => {
                  const lineTotalPaise = Math.round((Number(l.qty) || 0) * (Number(l.unitRatePaise) || 0) * 100);
                  return (
                    <div key={l.id} className="grid px-3 py-2 items-center"
                      style={{ borderBottom: idx < poForm.lines.length - 1 ? '1px solid var(--border-subtle)' : 'none', gridTemplateColumns: 'minmax(0,1fr) 70px 70px 110px 90px 28px', gap: 8 }}>
                      <input type="text" value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })}
                        placeholder="e.g. Plywood 18mm" className="studio-input h-8 w-full text-xs" style={{ borderRadius: 6 }} />
                      <input type="number" min="0" step="any" value={l.qty} onChange={e => updateLine(l.id, { qty: e.target.value })}
                        placeholder="0" className="studio-input h-8 w-full text-xs text-right tabular-nums" style={{ borderRadius: 6 }} />
                      <input type="text" value={l.unit} onChange={e => updateLine(l.id, { unit: e.target.value })}
                        placeholder="sheets" className="studio-input h-8 w-full text-xs" style={{ borderRadius: 6 }} />
                      <input type="number" min="0" step="any" value={l.unitRatePaise} onChange={e => updateLine(l.id, { unitRatePaise: e.target.value })}
                        placeholder="0" className="studio-input h-8 w-full text-xs text-right tabular-nums" style={{ borderRadius: 6 }} />
                      <span className="text-xs text-right tabular-nums"
                        style={{ color: lineTotalPaise > 0 ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                        {formatRupees(lineTotalPaise)}
                      </span>
                      <button type="button" onClick={() => removeLine(l.id)} disabled={poForm.lines.length === 1}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  );
                })}
                <div className="grid px-3 py-2.5 items-center"
                  style={{ background: 'var(--accent-soft)', borderTop: '1px solid var(--border-subtle)', gridTemplateColumns: 'minmax(0,1fr) 70px 70px 110px 90px 28px', gap: 8 }}>
                  <span className="col-span-4 text-xs" style={{ color: 'var(--text-secondary)' }}>Order total</span>
                  <span className="text-right text-sm font-semibold tabular-nums" style={{ color: 'var(--accent-text)' }}>
                    {formatRupees(poTotal)}
                  </span>
                  <span />
                </div>
              </div>
            </div>

            <FormField label="Expected delivery" hint="Optional">
              <input type="date" value={poForm.expectedDeliveryAt}
                onChange={e => setPoForm(f => ({ ...f, expectedDeliveryAt: e.target.value }))}
                className="studio-input h-9 w-full sm:w-48 text-sm" />
            </FormField>

            {poError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{poError}
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setPoDialog(false)} disabled={poSubmit} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleCreatePO} disabled={poSubmit}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
              {poSubmit ? 'Creating…' : <><PackageCheck className="h-3.5 w-3.5" strokeWidth={2.25} />Create order</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete PO confirm ─────────────────────────────────────────────────── */}
      <Dialog open={!!deletePO} onOpenChange={open => { if (!open) { setDeletePO(null); setDeletePOError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete purchase order?</DialogTitle></DialogHeader>
          <div className="py-1 space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You&apos;re about to delete{' '}
              <span className="font-semibold font-mono" style={{ color: 'var(--text-heading)' }}>{deletePO?.poNumber}</span>.
              This can&apos;t be undone.
            </p>
            {deletePOError && <p className="text-xs text-red-600">{deletePOError}</p>}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDeletePO(null)} disabled={deletePOBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleDeletePO} disabled={deletePOBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />{deletePOBusy ? 'Deleting…' : 'Delete order'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function FormField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
          {label}{required && <span style={{ color: 'var(--accent-base)' }}> *</span>}
        </label>
        {hint && <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function POSkeleton() {
  return (
    <div>
      <div className="h-10" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }} />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-5 w-16 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}
