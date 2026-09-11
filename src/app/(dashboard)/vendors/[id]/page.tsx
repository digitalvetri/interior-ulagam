'use client';

import { use, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Edit2, Trash2,
  PackageCheck, AlertTriangle, X, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import type { POStatus } from '@/types/purchase-orders';
import type { MaterialCategory } from '@/types/vendors';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Vendor {
  id:        string;
  name:      string;
  phone:     string | null;
  email:     string | null;
  gstin:     string | null;
  category:  MaterialCategory | null;
  address:   string | null;
  notes:     string | null;
  createdAt: string;
}

interface PO {
  id:                 string;
  poNumber:           string;
  vendorId:           string | null;
  projectId:          string;
  projectName:        string | null;
  linesJson:          { qty: number; unitRatePaise?: number; totalPaise?: number }[];
  status:             POStatus;
  advancePaidPaise:   number;
  expectedDeliveryAt: string | null;
  lineCount:          number;
  totalPaise:         number;
  createdAt:          string;
}

interface VendorForm {
  name: string; phone: string; email: string;
  gstin: string; category: MaterialCategory | ''; address: string; notes: string;
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Partial<Record<MaterialCategory, string>> = {
  laminate: 'Laminate', hardware: 'Hardware', furniture: 'Furniture',
  fabric: 'Fabric', lighting: 'Lighting', flooring: 'Flooring',
  sanitary: 'Sanitary', other: 'Other',
};

const CATEGORY_BADGE: Partial<Record<MaterialCategory, { bg: string; color: string }>> = {
  laminate:  { bg: '#F3E8FF', color: '#7E22CE' },
  hardware:  { bg: '#DBEAFE', color: '#1D4ED8' },
  furniture: { bg: '#FEF3C7', color: '#92400E' },
  fabric:    { bg: '#FCE7F3', color: '#9D174D' },
  lighting:  { bg: '#FEFCE8', color: '#713F12' },
  flooring:  { bg: '#D1FAE5', color: '#065F46' },
  sanitary:  { bg: '#CCFBF1', color: '#0F766E' },
  other:     { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

const VENDOR_CATEGORIES: MaterialCategory[] = [
  'laminate', 'hardware', 'furniture', 'fabric', 'lighting', 'flooring', 'sanitary', 'other',
];

const STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft', sent: 'Sent', acknowledged: 'Acknowledged',
  partial: 'Partial', complete: 'Received', cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<POStatus, { bg: string; fg: string; border: string }> = {
  draft:        { bg: 'var(--surface-muted)',  fg: 'var(--text-secondary)', border: 'var(--border-subtle)' },
  sent:         { bg: '#EEF2FF', fg: '#4338CA', border: 'rgba(67,56,202,0.22)' },
  acknowledged: { bg: '#F5F3FF', fg: '#7C3AED', border: 'rgba(124,58,237,0.22)' },
  partial:      { bg: '#FFF7ED', fg: '#C2410C', border: 'rgba(194,65,12,0.22)' },
  complete:     { bg: 'var(--success-soft)', fg: 'var(--success-text)', border: 'rgba(15,157,110,0.24)' },
  cancelled:    { bg: '#FEE2E2', fg: '#B91C1C', border: '#FCA5A5' },
};

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [vendor,   setVendor]   = useState<Vendor | null>(null);
  const [pos,      setPos]      = useState<PO[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit dialog
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState<VendorForm>({ name: '', phone: '', email: '', gstin: '', category: '', address: '', notes: '' });
  const [editBusy,   setEditBusy]   = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /* ── Load ─────────────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vnRes, poRes] = await Promise.all([
        fetch(`/api/v1/vendors/${id}`).then(r => r.json()),
        fetch('/api/v1/purchase-orders').then(r => r.json()),
      ]);
      if (vnRes.error || !vnRes.data) { setNotFound(true); return; }
      setVendor(vnRes.data as Vendor);
      const allPos: PO[] = (poRes.data ?? []) as PO[];
      setPos(allPos.filter(p => p.vendorId === id));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  /* ── KPIs ─────────────────────────────────────────────────────────────────── */

  const kpis = useMemo(() => {
    const openStatuses = new Set<POStatus>(['draft', 'sent', 'acknowledged', 'partial']);
    const openPos      = pos.filter(p => openStatuses.has(p.status));
    const totalOrdered = pos.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.totalPaise, 0);
    const outstanding  = openPos.reduce((s, p) => s + Math.max(0, p.totalPaise - (p.advancePaidPaise ?? 0)), 0);
    const lastOrder    = pos.length ? pos.reduce((latest, p) =>
      new Date(p.createdAt) > new Date(latest.createdAt) ? p : latest, pos[0]) : null;
    return { totalOrdered, openCount: openPos.length, outstanding, lastOrder };
  }, [pos]);

  /* ── Edit ─────────────────────────────────────────────────────────────────── */

  function openEdit() {
    if (!vendor) return;
    setEditForm({
      name: vendor.name, phone: vendor.phone ?? '', email: vendor.email ?? '',
      gstin: vendor.gstin ?? '', category: vendor.category ?? '',
      address: vendor.address ?? '', notes: vendor.notes ?? '',
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editForm.name.trim()) { setEditError('Vendor name is required.'); return; }
    setEditBusy(true); setEditError(null);
    const body: Record<string, unknown> = { name: editForm.name.trim() };
    if (editForm.phone.trim())   body.phone   = editForm.phone.trim();
    if (editForm.email.trim())   body.email   = editForm.email.trim();
    if (editForm.gstin.trim())   body.gstin   = editForm.gstin.trim();
    if (editForm.category)       body.category = editForm.category;
    if (editForm.address.trim()) body.address  = editForm.address.trim();
    if (editForm.notes.trim())   body.notes    = editForm.notes.trim();
    try {
      const res  = await fetch(`/api/v1/vendors/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: Vendor; error?: unknown };
      if (!res.ok) { setEditError(typeof json.error === 'string' ? json.error : 'Failed to save.'); return; }
      setVendor(json.data!);
      setEditOpen(false);
    } catch { setEditError('Network error.'); }
    finally  { setEditBusy(false); }
  }

  /* ── Delete ───────────────────────────────────────────────────────────────── */

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await fetch(`/api/v1/vendors/${id}`, { method: 'DELETE' });
      router.replace('/purchase-orders');
    } catch { setDeleteBusy(false); }
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */

  if (loading) return <VendorDetailSkeleton />;

  if (notFound || !vendor) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>Vendor not found</p>
        <Link href="/purchase-orders" className="text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
          ← Back to Purchase &amp; Vendors
        </Link>
      </div>
    );
  }

  const cat    = vendor.category ? CATEGORY_BADGE[vendor.category] : undefined;
  const catLabel = vendor.category ? CATEGORY_LABELS[vendor.category] : null;
  const activePOs = pos.filter(p => p.status !== 'cancelled');

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Back */}
      <Link href="/purchase-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-heading)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
        <ArrowLeft className="h-3.5 w-3.5" />Purchase &amp; Vendors
      </Link>

      {/* Header */}
      <div className="rounded-2xl border p-5"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: cat?.bg ?? 'var(--accent-soft)', color: cat?.color ?? 'var(--accent-base)' }}>
              {vendor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{vendor.name}</h1>
                {catLabel && cat && (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: cat.bg, color: cat.color }}>
                    {catLabel}
                  </span>
                )}
              </div>
              {/* Contact chips */}
              <div className="flex flex-wrap gap-3 mt-2.5">
                {vendor.phone && (
                  <a href={`tel:${vendor.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-base)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    <Phone className="h-3.5 w-3.5" />{vendor.phone}
                  </a>
                )}
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`}
                    className="inline-flex items-center gap-1.5 text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-base)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    <Mail className="h-3.5 w-3.5" />{vendor.email}
                  </a>
                )}
                {vendor.gstin && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-mono"
                    style={{ color: 'var(--text-secondary)' }}>
                    GST: {vendor.gstin}
                  </span>
                )}
                {vendor.address && (
                  <span className="inline-flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-secondary)' }}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{vendor.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={openEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--surface-card)' }}>
              <Edit2 className="h-3.5 w-3.5" />Edit
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-red-50"
              style={{ borderColor: 'var(--border-subtle)', color: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />Remove
            </button>
          </div>
        </div>

        {/* Notes */}
        {vendor.notes && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-base)' }}>
            {vendor.notes}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL ORDERED',  value: formatRupees(kpis.totalOrdered), sub: `${activePOs.length} order${activePOs.length !== 1 ? 's' : ''}` },
          { label: 'OPEN POs',       value: String(kpis.openCount),           sub: kpis.openCount === 0 ? 'all received' : 'in progress' },
          { label: 'OUTSTANDING',    value: formatRupees(kpis.outstanding),    sub: 'net of advance' },
          {
            label: 'LAST ORDER',
            value: kpis.lastOrder
              ? new Date(kpis.lastOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—',
            sub: kpis.lastOrder ? kpis.lastOrder.poNumber : 'no orders yet',
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: 'var(--text-heading)' }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Purchase Orders */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
            Purchase Orders
            <span className="ml-2 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
              {pos.length}
            </span>
          </h2>
          <Link href="/purchase-orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--accent-base)' }}>
            <Plus className="h-3 w-3" strokeWidth={2.5} />New PO
          </Link>
        </div>

        {pos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent-soft)' }}>
              <FileText className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No orders from this vendor yet.</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Create a PO and assign it to{' '}
              <span className="font-semibold">{vendor.name}</span>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['PO #', 'Project', 'Items', 'Value', 'Status', 'Expected', 'Created'].map((h, i) => (
                    <th key={i}
                      className="px-5 py-3 text-left text-xs font-semibold tracking-wide"
                      style={{ color: 'var(--text-secondary)', textAlign: ['Items', 'Value'].includes(h) ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.map((po, idx) => {
                  const s = STATUS_STYLES[po.status];
                  return (
                    <tr key={po.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                      style={{
                        borderBottom: idx < pos.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        borderLeft: '3px solid var(--accent-base)',
                      }}
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}>
                      <td className="px-5 py-3.5 font-mono font-semibold text-xs" style={{ color: 'var(--accent-base)' }}>
                        {po.poNumber}
                      </td>
                      <td className="px-5 py-3.5 max-w-[180px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {po.projectName ?? <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{po.projectId.slice(0, 8)}…</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {po.lineCount}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(po.totalPaise)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium border"
                          style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
                          {STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {po.expectedDeliveryAt
                          ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(po.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary footer */}
            <div className="flex items-center justify-between px-5 py-3 text-xs"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              <span>{pos.length} order{pos.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                Total: {formatRupees(activePOs.reduce((s, p) => s + p.totalPaise, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={open => { if (!open) setEditOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Vendor name" required>
              <input type="text" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="studio-input h-9 w-full text-sm" placeholder="e.g. Hafele India" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Phone">
                <input type="tel" value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="studio-input h-9 w-full text-sm" placeholder="+91 98765 43210" />
              </FormField>
              <FormField label="Category">
                <select value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value as MaterialCategory | '' }))}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">No category</option>
                  {VENDOR_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email">
                <input type="email" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="studio-input h-9 w-full text-sm" placeholder="vendor@example.com" />
              </FormField>
              <FormField label="GSTIN">
                <input type="text" value={editForm.gstin}
                  onChange={e => setEditForm(f => ({ ...f, gstin: e.target.value }))}
                  className="studio-input h-9 w-full text-sm font-mono" placeholder="29AAAAA0000A1Z5" />
              </FormField>
            </div>
            <FormField label="Address">
              <textarea value={editForm.address} rows={2}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="studio-input w-full text-sm resize-none" placeholder="Shop / street / city" />
            </FormField>
            <FormField label="Notes">
              <textarea value={editForm.notes} rows={2}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="studio-input w-full text-sm resize-none" placeholder="Payment terms, lead time, quality notes…" />
            </FormField>
            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setEditOpen(false)} disabled={editBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleSave} disabled={editBusy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {editBusy ? 'Saving…' : 'Save changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={open => { if (!open) setDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Remove vendor?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{vendor.name}</span> will be removed.
              Existing purchase orders linked to this vendor won&apos;t be deleted.
            </p>
            {pos.filter(p => !['complete', 'cancelled'].includes(p.status)).length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                This vendor has {pos.filter(p => !['complete', 'cancelled'].includes(p.status)).length} open PO
                {pos.filter(p => !['complete', 'cancelled'].includes(p.status)).length !== 1 ? 's' : ''}.
                Consider closing them before removing.
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleteBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
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

function VendorDetailSkeleton() {
  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="skeleton h-4 w-40 rounded" />
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex gap-4">
          <div className="skeleton h-14 w-14 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-7 w-48 rounded" />
            <div className="skeleton h-4 w-72 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-6 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="h-12 skeleton" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton" style={{ borderBottom: '1px solid var(--border-subtle)' }} />)}
      </div>
    </div>
  );
}
