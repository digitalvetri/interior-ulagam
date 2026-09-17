'use client';

import { use, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MapPin, Edit2, Trash2, Package,
  AlertTriangle, Plus, ShoppingCart, Box,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import type { POStatus } from '@/types/purchase-orders';
import type { MaterialCategory } from '@/types/vendors';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface Vendor {
  id: string; name: string; phone: string | null; email: string | null;
  gstin: string | null; category: MaterialCategory | null;
  address: string | null; notes: string | null; createdAt: string;
}

interface PO {
  id: string; poNumber: string; vendorId: string | null; projectId: string;
  projectName: string | null; status: POStatus;
  advancePaidPaise: number; expectedDeliveryAt: string | null;
  lineCount: number; totalPaise: number; createdAt: string;
}

interface Material {
  id: string; name: string; brand: string | null; unit: string;
  category: MaterialCategory; currentRatePaise: number | null;
  sellingRatePaise: number | null; hsnSac: string | null; notes: string | null;
}

interface VendorForm {
  name: string; phone: string; email: string;
  gstin: string; category: MaterialCategory | ''; address: string; notes: string;
}

/* ── Config ───────────────────────────────────────────────────────────────── */

const CAT_LABEL: Partial<Record<MaterialCategory, string>> = {
  laminate: 'Laminate', hardware: 'Hardware', furniture: 'Furniture',
  fabric: 'Fabric', lighting: 'Lighting', flooring: 'Flooring',
  sanitary: 'Sanitary', other: 'Other',
};

const CAT_BADGE: Partial<Record<MaterialCategory, { bg: string; color: string }>> = {
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

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft', sent: 'Sent', acknowledged: 'Acknowledged',
  partial: 'Partial', complete: 'Received', cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<POStatus, { bg: string; fg: string }> = {
  draft:        { bg: 'var(--surface-muted)',  fg: 'var(--text-secondary)' },
  sent:         { bg: '#EEF2FF', fg: '#4338CA' },
  acknowledged: { bg: '#F5F3FF', fg: '#7C3AED' },
  partial:      { bg: '#FFF7ED', fg: '#C2410C' },
  complete:     { bg: '#D1FAE5', fg: '#065F46' },
  cancelled:    { bg: '#FEE2E2', fg: '#B91C1C' },
};

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [vendor,   setVendor]   = useState<Vendor | null>(null);
  const [pos,      setPos]      = useState<PO[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNF]       = useState(false);

  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState<VendorForm>({ name: '', phone: '', email: '', gstin: '', category: '', address: '', notes: '' });
  const [editBusy,   setEditBusy]   = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vnRes, poRes, matRes] = await Promise.all([
        fetch(`/api/v1/vendors/${id}`).then(r => r.json()),
        fetch('/api/v1/purchase-orders').then(r => r.json()),
        fetch(`/api/v1/materials?vendorId=${id}`).then(r => r.json()),
      ]);
      if (vnRes.error || !vnRes.data) { setNF(true); return; }
      setVendor(vnRes.data as Vendor);
      setPos(((poRes.data ?? []) as PO[]).filter(p => p.vendorId === id));
      setMaterials((matRes.data ?? []) as Material[]);
    } catch { setNF(true); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const open   = pos.filter(p => ['draft','sent','acknowledged','partial'].includes(p.status));
    const active = pos.filter(p => p.status !== 'cancelled');
    const totalOrdered  = active.reduce((s, p) => s + p.totalPaise, 0);
    const outstanding   = open.reduce((s, p) => s + Math.max(0, p.totalPaise - (p.advancePaidPaise ?? 0)), 0);
    const lastOrder     = pos.length
      ? pos.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b)
      : null;
    return { totalOrdered, openCount: open.length, outstanding, lastOrder, activeCount: active.length };
  }, [pos]);

  /* ── Edit ── */
  function openEdit() {
    if (!vendor) return;
    setEditForm({ name: vendor.name, phone: vendor.phone ?? '', email: vendor.email ?? '',
      gstin: vendor.gstin ?? '', category: vendor.category ?? '',
      address: vendor.address ?? '', notes: vendor.notes ?? '' });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editForm.name.trim()) { setEditError('Vendor name is required.'); return; }
    setEditBusy(true); setEditError(null);
    const body: Record<string, unknown> = { name: editForm.name.trim() };
    if (editForm.phone.trim())   body.phone    = editForm.phone.trim();
    if (editForm.email.trim())   body.email    = editForm.email.trim();
    if (editForm.gstin.trim())   body.gstin    = editForm.gstin.trim();
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

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await fetch(`/api/v1/vendors/${id}`, { method: 'DELETE' });
      router.replace('/purchase-orders');
    } catch { setDeleteBusy(false); }
  }

  /* ── Guards ── */
  if (loading) return <Skeleton />;

  if (notFound || !vendor) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-lg font-semibold text-[var(--text-heading)]">Vendor not found</p>
        <Link href="/purchase-orders" className="text-sm font-medium text-[var(--accent-base)]">
          ← Back to Purchase &amp; Vendors
        </Link>
      </div>
    );
  }

  const cat      = vendor.category ? CAT_BADGE[vendor.category] : undefined;
  const catLabel = vendor.category ? CAT_LABEL[vendor.category] : null;
  const activePOs = pos.filter(p => p.status !== 'cancelled');
  const openPOs   = pos.filter(p => !['complete', 'cancelled'].includes(p.status));

  return (
    <div className="p-6 space-y-5">

      {/* ── Back ── */}
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />Purchase &amp; Vendors
      </Link>

      {/* ── Vendor Header ── */}
      <div className="premium-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: cat?.bg ?? 'var(--accent-soft)', color: cat?.color ?? 'var(--accent-base)' }}
            >
              {vendor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-2xl font-bold text-[var(--text-heading)]">{vendor.name}</h1>
                {catLabel && cat && (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: cat.bg, color: cat.color }}>
                    {catLabel}
                  </span>
                )}
              </div>

              {/* Contact row */}
              <div className="flex flex-wrap gap-4">
                {vendor.phone && (
                  <a href={`tel:${vendor.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-base)] transition-colors">
                    <Phone className="h-3.5 w-3.5" />{vendor.phone}
                  </a>
                )}
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-base)] transition-colors">
                    <Mail className="h-3.5 w-3.5" />{vendor.email}
                  </a>
                )}
                {vendor.gstin && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-mono text-[var(--text-secondary)]">
                    GST: {vendor.gstin}
                  </span>
                )}
                {vendor.address && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{vendor.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />Edit
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />Remove
            </button>
          </div>
        </div>

        {vendor.notes && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm text-[var(--text-secondary)] bg-[var(--surface-muted)] border-l-2 border-[var(--accent-base)]">
            {vendor.notes}
          </div>
        )}
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-card p-4">
          <p className="text-[10px] font-semibold tracking-widest mb-2 text-[var(--text-secondary)] uppercase">Total Ordered</p>
          <p className="text-xl font-bold tabular-nums text-[var(--text-heading)]">{formatRupees(kpis.totalOrdered)}</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">{kpis.activeCount} order{kpis.activeCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="premium-card p-4">
          <p className="text-[10px] font-semibold tracking-widest mb-2 text-[var(--text-secondary)] uppercase">Open POs</p>
          <p className={`text-xl font-bold tabular-nums ${kpis.openCount > 0 ? 'text-amber-600' : 'text-[var(--text-heading)]'}`}>{kpis.openCount}</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">{kpis.openCount === 0 ? 'all received' : 'in progress'}</p>
        </div>
        <div className="premium-card p-4">
          <p className="text-[10px] font-semibold tracking-widest mb-2 text-[var(--text-secondary)] uppercase">Outstanding</p>
          <p className={`text-xl font-bold tabular-nums ${kpis.outstanding > 0 ? 'text-amber-600' : 'text-[var(--text-heading)]'}`}>{formatRupees(kpis.outstanding)}</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">net of advance</p>
        </div>
        <div className="premium-card p-4">
          <p className="text-[10px] font-semibold tracking-widest mb-2 text-[var(--text-secondary)] uppercase">Last Order</p>
          <p className="text-xl font-bold text-[var(--text-heading)]">
            {kpis.lastOrder
              ? new Date(kpis.lastOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '—'}
          </p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">{kpis.lastOrder?.poNumber ?? 'no orders yet'}</p>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Purchase Orders (2/3 width) ── */}
        <div className="lg:col-span-2">
          <div className="premium-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-bold text-[var(--text-heading)]">Purchase Orders</h2>
                <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                  {pos.length}
                </span>
              </div>
              <Link
                href="/purchase-orders"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-base)] hover:opacity-80 transition-opacity"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} />New PO
              </Link>
            </div>

            {pos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[var(--accent-soft)]">
                  <ShoppingCart className="h-5 w-5 text-[var(--accent-base)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-heading)]">No orders yet</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    Create a PO and assign it to <span className="font-semibold">{vendor.name}</span>.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        <th className="px-5 py-3 text-left">PO #</th>
                        <th className="px-4 py-3 text-left">Project</th>
                        <th className="px-4 py-3 text-right">Value</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-5 py-3 text-left">Expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.map((po, idx) => {
                        const s = STATUS_STYLE[po.status];
                        return (
                          <tr
                            key={po.id}
                            className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/purchase-orders/${po.id}`)}
                          >
                            <td className="px-5 py-3.5 font-mono font-semibold text-xs text-[var(--accent-base)]">
                              {po.poNumber}
                            </td>
                            <td className="px-4 py-3.5 max-w-[160px] truncate text-[var(--text-primary)]">
                              {po.projectName ?? <span className="text-[var(--text-secondary)]">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[var(--text-heading)]">
                              {formatRupees(po.totalPaise)}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                                style={{ background: s.bg, color: s.fg }}
                              >
                                {STATUS_LABEL[po.status]}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-[var(--text-secondary)]">
                              {po.expectedDeliveryAt
                                ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                : <span className="text-[var(--text-secondary)]">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-secondary)]">
                  <span>{activePOs.length} active order{activePOs.length !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-[var(--text-heading)]">
                    Total: {formatRupees(activePOs.reduce((s, p) => s + p.totalPaise, 0))}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right sidebar (1/3 width) ── */}
        <div className="space-y-5">

          {/* Materials Catalogue */}
          <div className="premium-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-bold text-[var(--text-heading)]">Materials</h2>
                <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                  {materials.length}
                </span>
              </div>
            </div>

            {materials.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Box className="h-8 w-8 text-[var(--text-secondary)] opacity-40" />
                <p className="text-sm text-[var(--text-secondary)]">No catalogue items linked</p>
                <p className="text-xs text-[var(--text-secondary)] opacity-70">Add materials and assign this vendor</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {materials.map(mat => (
                  <div key={mat.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-heading)] truncate">{mat.name}</p>
                        {mat.brand && (
                          <p className="text-xs text-[var(--text-secondary)]">{mat.brand}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {mat.currentRatePaise != null && (
                          <p className="text-sm font-semibold text-[var(--text-heading)]">
                            {formatRupees(mat.currentRatePaise)}
                          </p>
                        )}
                        <p className="text-xs text-[var(--text-secondary)]">per {mat.unit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendor Details Card */}
          <div className="premium-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-heading)]">Details</h2>
            <div className="space-y-3 text-sm">
              {vendor.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)] flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Phone</span>
                  <a href={`tel:${vendor.phone}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-base)] transition-colors">
                    {vendor.phone}
                  </a>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)] flex items-center gap-1.5 flex-shrink-0"><Mail className="h-3.5 w-3.5" />Email</span>
                  <a href={`mailto:${vendor.email}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-base)] transition-colors truncate">
                    {vendor.email}
                  </a>
                </div>
              )}
              {vendor.gstin && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)]">GSTIN</span>
                  <span className="font-mono text-xs font-medium text-[var(--text-primary)]">{vendor.gstin}</span>
                </div>
              )}
              {vendor.address && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[var(--text-secondary)] flex items-center gap-1.5 flex-shrink-0"><MapPin className="h-3.5 w-3.5" />Address</span>
                  <span className="font-medium text-[var(--text-primary)] text-right">{vendor.address}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Added</span>
                <span className="text-[var(--text-secondary)]">
                  {new Date(vendor.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => { if (!o) setEditOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Vendor name" required>
              <input type="text" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="studio-input h-9 w-full text-sm" placeholder="e.g. Hafele India" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input type="tel" value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="studio-input h-9 w-full text-sm" placeholder="+91 98765 43210" />
              </Field>
              <Field label="Category">
                <select value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value as MaterialCategory | '' }))}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">No category</option>
                  {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="studio-input h-9 w-full text-sm" placeholder="vendor@example.com" />
              </Field>
              <Field label="GSTIN">
                <input type="text" value={editForm.gstin}
                  onChange={e => setEditForm(f => ({ ...f, gstin: e.target.value }))}
                  className="studio-input h-9 w-full text-sm font-mono" placeholder="29AAAAA0000A1Z5" />
              </Field>
            </div>
            <Field label="Address">
              <textarea value={editForm.address} rows={2}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="studio-input w-full text-sm resize-none" placeholder="Shop / street / city" />
            </Field>
            <Field label="Notes">
              <textarea value={editForm.notes} rows={2}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="studio-input w-full text-sm resize-none" placeholder="Payment terms, lead time, quality notes…" />
            </Field>
            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{editError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button
              onClick={() => setEditOpen(false)} disabled={editBusy}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={editBusy}
              className="flex-1 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {editBusy ? 'Saving…' : 'Save changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o) setDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Remove vendor?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-heading)]">{vendor.name}</span> will be removed.
              Existing purchase orders won&apos;t be deleted.
            </p>
            {openPOs.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                This vendor has {openPOs.length} open PO{openPOs.length !== 1 ? 's' : ''}. Consider closing them first.
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button
              onClick={() => setDeleteOpen(false)} disabled={deleteBusy}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete} disabled={deleteBusy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Removing…' : 'Remove vendor'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--text-heading)]">
        {label}{required && <span className="text-[var(--accent-base)]"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="skeleton h-4 w-40 rounded" />
      <div className="premium-card p-5 space-y-4">
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
          <div key={i} className="premium-card p-4 space-y-3">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-6 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 premium-card overflow-hidden">
          <div className="h-12 skeleton border-b border-[var(--border-subtle)]" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton border-b border-[var(--border-subtle)]" />)}
        </div>
        <div className="space-y-5">
          <div className="premium-card overflow-hidden">
            <div className="h-12 skeleton border-b border-[var(--border-subtle)]" />
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton border-b border-[var(--border-subtle)]" />)}
          </div>
          <div className="premium-card p-5 space-y-3">
            <div className="skeleton h-4 w-16 rounded" />
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-4 w-full rounded" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
