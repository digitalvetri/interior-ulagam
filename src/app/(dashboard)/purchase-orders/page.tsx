'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Trash2, FileText, PackageCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import type { PurchaseOrder, POStatus, POLine } from '@/types/purchase-orders';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<POStatus, string> = {
  draft:        'Draft',
  sent:         'Sent',
  acknowledged: 'Acknowledged',
  partial:      'Partial',
  complete:     'Complete',
  cancelled:    'Cancelled',
};

const STATUS_STYLES: Record<POStatus, { bg: string; fg: string; border: string }> = {
  draft:        { bg: 'var(--surface-muted)',    fg: 'var(--text-secondary)',  border: 'var(--border-subtle)' },
  sent:         { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)',     border: 'rgba(37,99,235,0.22)' },
  acknowledged: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)',   border: 'rgba(124,58,237,0.22)' },
  partial:      { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)',   border: 'rgba(194,65,12,0.22)' },
  complete:     { bg: 'var(--success-soft)',      fg: 'var(--success-text)',    border: 'rgba(15,157,110,0.24)' },
  cancelled:    { bg: '#FEE2E2',                 fg: '#B91C1C',                border: '#FCA5A5' },
};

const STATUS_ORDER: POStatus[] = ['draft', 'sent', 'acknowledged', 'partial', 'complete', 'cancelled'];

// ─── Form types ───────────────────────────────────────────────────────────────

interface FormLine {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitRatePaise: string; // stored as rupees for input UX, converted on submit
}

interface NewPOForm {
  projectId: string;
  vendorId: string;
  lines: FormLine[];
  expectedDeliveryAt: string;
}

function makeEmptyLine(): FormLine {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: '',
    unit: '',
    unitRatePaise: '',
  };
}

const EMPTY_FORM: NewPOForm = {
  projectId: '',
  vendorId: '',
  lines: [makeEmptyLine()],
  expectedDeliveryAt: '',
};

// ─── Referenced entities (dropdowns) ─────────────────────────────────────────

interface ProjectOption { id: string; name: string; }
interface VendorOption  { id: string; name: string; category: string | null; }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders]         = useState<PurchaseOrder[]>([]);
  const [projects, setProjects]     = useState<ProjectOption[]>([]);
  const [vendors, setVendors]       = useState<VendorOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter + search
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<POStatus | 'all'>('all');

  // Dialog
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [form, setForm]                   = useState<NewPOForm>(EMPTY_FORM);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget]         = useState<PurchaseOrder | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError]           = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [poRes, prRes, vnRes] = await Promise.all([
        fetch('/api/v1/purchase-orders').then(r => r.json()),
        fetch('/api/v1/projects').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/vendors').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setOrders(poRes.data ?? []);
      setProjects(Array.isArray(prRes.data) ? prRes.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) : []);
      setVendors(Array.isArray(vnRes.data) ? vnRes.data : []);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadOrders(); }, [loadOrders]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach(p => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach(v => map.set(v.id, v.name));
    return map;
  }, [vendors]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (!q) return true;
      const projectName = projectNameById.get(o.projectId) ?? '';
      return (
        o.poNumber.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q)
      );
    });
  }, [orders, search, filterStatus, projectNameById]);

  const isFiltered = search.trim() !== '' || filterStatus !== 'all';

  // ─── Dialog handlers ────────────────────────────────────────────────────────

  function openDialog() {
    setForm({ ...EMPTY_FORM, lines: [makeEmptyLine()] });
    setSubmitError(null);
    setDialogOpen(true);
  }

  function updateLine(id: string, patch: Partial<FormLine>) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(l => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }
  function addLine() { setForm(prev => ({ ...prev, lines: [...prev.lines, makeEmptyLine()] })); }
  function removeLine(id: string) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter(l => l.id !== id) : prev.lines,
    }));
  }

  const totalPaise = useMemo(
    () => form.lines.reduce((sum, l) => {
      const qty = Number(l.qty) || 0;
      const rate = Math.round((Number(l.unitRatePaise) || 0) * 100);
      return sum + qty * rate;
    }, 0),
    [form.lines],
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setDeleteError(typeof body.error === 'string' ? body.error : 'Failed to delete');
        return;
      }
      setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError('Network error — please try again');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleCreate() {
    setSubmitError(null);

    if (!form.projectId) {
      setSubmitError('Please choose a project.');
      return;
    }
    const validLines: POLine[] = [];
    for (const l of form.lines) {
      const desc = l.description.trim();
      const qty = Number(l.qty);
      const rateRupees = Number(l.unitRatePaise);
      if (!desc && !l.qty && !l.unitRatePaise) continue; // blank row — skip
      if (!desc) { setSubmitError('Every line needs a description.'); return; }
      if (!Number.isFinite(qty) || qty <= 0) { setSubmitError(`Line "${desc}" — quantity must be a positive number.`); return; }
      if (!Number.isFinite(rateRupees) || rateRupees < 0) { setSubmitError(`Line "${desc}" — unit rate must be a valid number.`); return; }
      const unitRatePaise = Math.round(rateRupees * 100);
      validLines.push({
        id: l.id,
        description: desc,
        qty,
        unit: l.unit.trim() || 'unit',
        unitRatePaise,
        totalPaise: Math.round(qty * unitRatePaise),
      });
    }
    if (validLines.length === 0) { setSubmitError('Add at least one line item.'); return; }

    const body: Record<string, unknown> = {
      projectId: form.projectId,
      linesJson: validLines,
    };
    if (form.vendorId) body.vendorId = form.vendorId;
    if (form.expectedDeliveryAt) body.expectedDeliveryAt = new Date(form.expectedDeliveryAt).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: unknown };
        setSubmitError(
          typeof payload.error === 'string'
            ? payload.error
            : 'Failed to create purchase order.',
        );
        return;
      }
      const { data } = (await res.json()) as { data: PurchaseOrder };
      setOrders(prev => [data, ...prev]);
      setDialogOpen(false);
      router.push(`/purchase-orders/${data.id}`);
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
      {/* Page header */}
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <h1 className="page-title">Purchase orders</h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading…'
              : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'} across your projects`}
          </p>
        </div>
        <button
          onClick={openDialog}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New order
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number or project…"
            className="studio-input w-full h-9 pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
            label="All"
            count={orders.length}
          />
          {STATUS_ORDER.map(s => {
            const count = orders.filter(o => o.status === s).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={s}
                active={filterStatus === s}
                onClick={() => setFilterStatus(s)}
                label={STATUS_LABELS[s]}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* Table / states */}
      <div className="premium-card overflow-hidden">
        {loading && <POSkeleton />}
        {fetchError && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{fetchError}</p>
            <button
              onClick={() => void loadOrders()}
              className="text-[12px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--accent-base)' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !fetchError && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-soft)' }}
            >
              <FileText className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              No purchase orders yet
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Create your first order to send to a vendor.
            </p>
            <button
              onClick={openDialog}
              className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              New order
            </button>
          </div>
        )}
        {!loading && !fetchError && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              No orders match your filters
            </p>
            <button
              onClick={() => { setSearch(''); setFilterStatus('all'); }}
              className="text-[12px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--accent-base)' }}
            >
              Clear filters
            </button>
          </div>
        )}
        {!loading && !fetchError && filteredOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead
                style={{
                  background: 'var(--surface-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <tr>
                  {[
                    { label: 'PO number' },
                    { label: 'Project' },
                    { label: 'Vendor' },
                    { label: 'Status' },
                    { label: 'Advance paid', align: 'right' as const },
                    { label: 'Expected delivery' },
                    { label: 'Created' },
                    { label: '' },
                  ].map(h => (
                    <th
                      key={h.label || 'actions'}
                      className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        color: 'var(--text-secondary)',
                        textAlign: h.align ?? 'left',
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => {
                  const s = STATUS_STYLES[po.status];
                  const projectName = projectNameById.get(po.projectId);
                  const vendorName = po.vendorId ? vendorNameById.get(po.vendorId) : null;
                  return (
                    <tr
                      key={po.id}
                      className="group cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}
                    >
                      <td className="px-4 py-2.5 font-medium tnum" style={{ color: 'var(--text-heading)' }}>
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                        {projectName ?? (
                          <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {po.projectId.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                        {vendorName ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border"
                          style={{ background: s.bg, color: s.fg, borderColor: s.border }}
                        >
                          {STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tnum" style={{ color: 'var(--text-primary)' }}>
                        {formatRupees(po.advancePaidPaise)}
                      </td>
                      <td className="px-4 py-2.5 tnum" style={{ color: 'var(--text-secondary)' }}>
                        {po.expectedDeliveryAt
                          ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 tnum" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(po.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {po.status === 'draft' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteError(null);
                              setDeleteTarget(po);
                            }}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex h-7 w-7 items-center justify-center rounded-md transition-all hover:bg-red-50"
                            aria-label={`Delete ${po.poNumber}`}
                            title="Delete draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" style={{ color: '#DC2626' }} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isFiltered && (
              <div
                className="flex items-center justify-between px-4 py-2 text-[11px]"
                style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <span>Showing {filteredOrders.length} of {orders.length}</span>
                <button
                  onClick={() => { setSearch(''); setFilterStatus('all'); }}
                  className="font-medium underline-offset-4 hover:underline"
                  style={{ color: 'var(--accent-base)' }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New PO Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Project + Vendor row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Project" required>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))}
                  className="studio-input h-9 w-full"
                >
                  <option value="">Choose a project…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Vendor" hint="Optional">
                <select
                  value={form.vendorId}
                  onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))}
                  className="studio-input h-9 w-full"
                >
                  <option value="">No vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Line items editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Line items</FormLabel>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 text-[12px] font-medium"
                  style={{ color: 'var(--accent-base)' }}
                >
                  <Plus className="h-3 w-3" strokeWidth={2.25} />
                  Add line
                </button>
              </div>
              <div
                className="overflow-hidden rounded-lg"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                {/* Column headers */}
                <div
                  className="grid px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: 'var(--surface-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    gridTemplateColumns: 'minmax(0,1fr) 70px 80px 110px 90px 28px',
                    gap: 8,
                  }}
                >
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span>Unit</span>
                  <span className="text-right">Rate (₹)</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {/* Rows */}
                {form.lines.map((l, idx) => {
                  const qty = Number(l.qty) || 0;
                  const rate = Number(l.unitRatePaise) || 0;
                  const lineTotalPaise = Math.round(qty * rate * 100);
                  return (
                    <div
                      key={l.id}
                      className="grid px-3 py-2 items-center"
                      style={{
                        borderBottom: idx === form.lines.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                        gridTemplateColumns: 'minmax(0,1fr) 70px 80px 110px 90px 28px',
                        gap: 8,
                      }}
                    >
                      <input
                        type="text"
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        placeholder="e.g. Plywood 18mm"
                        className="studio-input h-8 w-full text-[13px]"
                        style={{ borderRadius: 6 }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={l.qty}
                        onChange={(e) => updateLine(l.id, { qty: e.target.value })}
                        placeholder="0"
                        className="studio-input h-8 w-full text-[13px] text-right tnum"
                        style={{ borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        value={l.unit}
                        onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                        placeholder="sheets"
                        className="studio-input h-8 w-full text-[13px]"
                        style={{ borderRadius: 6 }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={l.unitRatePaise}
                        onChange={(e) => updateLine(l.id, { unitRatePaise: e.target.value })}
                        placeholder="0"
                        className="studio-input h-8 w-full text-[13px] text-right tnum"
                        style={{ borderRadius: 6 }}
                      />
                      <span
                        className="text-[13px] text-right tnum"
                        style={{ color: lineTotalPaise > 0 ? 'var(--text-heading)' : 'var(--text-secondary)' }}
                      >
                        {formatRupees(lineTotalPaise)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(l.id)}
                        disabled={form.lines.length === 1}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  );
                })}
                {/* Total row */}
                <div
                  className="grid items-center px-3 py-2.5 text-[13px]"
                  style={{
                    background: 'var(--accent-soft)',
                    borderTop: '1px solid var(--border-subtle)',
                    gridTemplateColumns: 'minmax(0,1fr) 70px 80px 110px 90px 28px',
                    gap: 8,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }} className="col-span-4">
                    Order total
                  </span>
                  <span className="text-right font-semibold tnum" style={{ color: 'var(--accent-text)' }}>
                    {formatRupees(totalPaise)}
                  </span>
                  <span />
                </div>
              </div>
            </div>

            {/* Expected delivery */}
            <FormField label="Expected delivery" hint="Optional">
              <input
                type="date"
                value={form.expectedDeliveryAt}
                onChange={(e) => setForm(f => ({ ...f, expectedDeliveryAt: e.target.value }))}
                className="studio-input h-9 w-full sm:w-56 tnum"
              />
            </FormField>

            {submitError && (
              <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-heading)',
                background: 'var(--surface-card)',
              }}
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? 'Creating…' : (
                <>
                  <PackageCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Create order
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete purchase order?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              You&apos;re about to delete{' '}
              <span className="font-semibold tnum" style={{ color: 'var(--text-heading)' }}>
                {deleteTarget?.poNumber}
              </span>. This can&apos;t be undone.
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Only <span className="font-medium" style={{ color: 'var(--text-heading)' }}>draft</span> orders can be deleted. Once an order is sent to a vendor, cancel it via the status change instead so the history is preserved.
            </p>
            {deleteError && (
              <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-heading)',
                background: 'var(--surface-card)',
              }}
              onClick={() => setDeleteTarget(null)}
              disabled={deleteSubmitting}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}
              onClick={handleDelete}
              disabled={deleteSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              {deleteSubmitting ? 'Deleting…' : 'Delete order'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────

function FilterChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span
        className="tnum text-[11px] font-medium"
        style={{ color: active ? 'var(--accent-base)' : 'var(--text-secondary)', opacity: active ? 1 : 0.7 }}
      >
        {count}
      </span>
    </button>
  );
}

function FormField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <FormLabel>
          {label}
          {required && <span style={{ color: 'var(--accent-base)' }}> *</span>}
        </FormLabel>
        {hint && (
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
      {children}
    </label>
  );
}

function POSkeleton() {
  return (
    <div>
      <div className="h-10" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }} />
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="grid gap-4 items-center px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)', gridTemplateColumns: '110px 1fr 1fr 100px 100px 110px 110px' }}
        >
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-5 w-16 rounded-md" />
          <div className="skeleton h-4 w-16 justify-self-end" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
