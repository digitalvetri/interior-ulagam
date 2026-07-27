'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, ChevronDown, Package, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Vendor, MaterialCategory } from '@/types/vendors';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  laminate: 'Laminate',
  hardware: 'Hardware',
  furniture: 'Furniture',
  fabric: 'Fabric',
  lighting: 'Lighting',
  flooring: 'Flooring',
  sanitary: 'Sanitary',
  other: 'Other',
};

const CATEGORY_BADGE_CLASSES: Record<MaterialCategory, string> = {
  laminate: 'bg-purple-100 text-purple-700 border-purple-200',
  hardware: 'bg-blue-100 text-blue-700 border-blue-200',
  furniture: 'bg-orange-100 text-orange-700 border-orange-200',
  fabric: 'bg-pink-100 text-pink-700 border-pink-200',
  lighting: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  flooring: 'bg-amber-100 text-amber-800 border-amber-200',
  sanitary: 'bg-teal-100 text-teal-700 border-teal-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

const CATEGORIES: MaterialCategory[] = [
  'laminate',
  'hardware',
  'furniture',
  'fabric',
  'lighting',
  'flooring',
  'sanitary',
  'other',
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface VendorFormState {
  name: string;
  phone: string;
  email: string;
  gstin: string;
  category: MaterialCategory | '';
  address: string;
  notes: string;
}

const EMPTY_FORM: VendorFormState = {
  name: '',
  phone: '',
  email: '',
  gstin: '',
  category: '',
  address: '',
  notes: '',
};

function formFromVendor(v: Vendor): VendorFormState {
  return {
    name: v.name,
    phone: v.phone ?? '',
    email: v.email ?? '',
    gstin: v.gstin ?? '',
    category: v.category ?? '',
    address: v.address ?? '',
    notes: v.notes ?? '',
  };
}

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: MaterialCategory | null }) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}>
        —
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${CATEGORY_BADGE_CLASSES[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ─── VendorForm ───────────────────────────────────────────────────────────────

interface VendorFormProps {
  form: VendorFormState;
  onChange: (form: VendorFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
}

function VendorForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  error,
}: VendorFormProps) {
  const set = (key: keyof VendorFormState) => (val: string) =>
    onChange({ ...form, [key]: val });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v-name">Name *</Label>
          <Input
            id="v-name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="Vendor name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-phone">Phone</Label>
          <Input
            id="v-phone"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-email">Email</Label>
          <Input
            id="v-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            placeholder="vendor@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-gstin">GSTIN</Label>
          <Input
            id="v-gstin"
            value={form.gstin}
            onChange={(e) => set('gstin')(e.target.value)}
            placeholder="29AABCU9603R1ZX"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="v-category">Category</Label>
          <Select
            value={form.category}
            onValueChange={(val) => set('category')(val)}
          >
            <SelectTrigger id="v-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="v-address">Address</Label>
          <Textarea
            id="v-address"
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
            placeholder="Full address"
            rows={2}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="v-notes">Notes</Label>
          <Textarea
            id="v-notes"
            value={form.notes}
            onChange={(e) => set('notes')(e.target.value)}
            placeholder="Any internal notes"
            rows={2}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={submitting || !form.name.trim()}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter + search
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<MaterialCategory | 'all'>('all');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<VendorFormState>(EMPTY_FORM);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit dialog
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState<VendorFormState>(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/v1/vendors');
      if (!res.ok) {
        setFetchError('Failed to load vendors');
        return;
      }
      const json = (await res.json()) as { data: Vendor[] };
      setVendors(json.data ?? []);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Add ────────────────────────────────────────────────────────────────────

  function openAdd() {
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAdd() {
    setAddError(null);
    setAddSubmitting(true);
    try {
      const res = await fetch('/api/v1/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          phone: addForm.phone.trim() || null,
          email: addForm.email.trim() || null,
          gstin: addForm.gstin.trim() || null,
          category: addForm.category || null,
          address: addForm.address.trim() || null,
          notes: addForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: unknown };
        setAddError(typeof body.error === 'string' ? body.error : 'Failed to create vendor');
        return;
      }
      setAddOpen(false);
      await loadVendors();
    } catch {
      setAddError('Network error — please try again');
    } finally {
      setAddSubmitting(false);
    }
  }

  // ─── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(vendor: Vendor) {
    setEditVendor(vendor);
    setEditForm(formFromVendor(vendor));
    setEditError(null);
  }

  async function handleEdit() {
    if (!editVendor) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v1/vendors/${editVendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          gstin: editForm.gstin.trim() || null,
          category: editForm.category || null,
          address: editForm.address.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: unknown };
        setEditError(typeof body.error === 'string' ? body.error : 'Failed to update vendor');
        return;
      }
      setEditVendor(null);
      await loadVendors();
    } catch {
      setEditError('Network error — please try again');
    } finally {
      setEditSubmitting(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/vendors/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: unknown };
        setDeleteError(typeof body.error === 'string' ? body.error : 'Failed to delete vendor');
        return;
      }
      setDeleteTarget(null);
      setExpandedId(null);
      await loadVendors();
    } catch {
      setDeleteError('Network error — please try again');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Filtered results — memoized so the table doesn't re-map on every keystroke
  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter(v => {
      if (filterCategory !== 'all' && v.category !== filterCategory) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.phone ?? '').toLowerCase().includes(q) ||
        (v.email ?? '').toLowerCase().includes(q) ||
        (v.gstin ?? '').toLowerCase().includes(q)
      );
    });
  }, [vendors, search, filterCategory]);

  const totalShown = filteredVendors.length;
  const isFiltered = search.trim() !== '' || filterCategory !== 'all';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
      {/* Page header */}
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading…'
              : `${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'} in your directory`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add vendor
        </button>
      </div>

      {/* Search + category filter */}
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
            placeholder="Search by name, phone, email, GSTIN…"
            className="studio-input w-full h-9 pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip
            active={filterCategory === 'all'}
            onClick={() => setFilterCategory('all')}
            label="All"
            count={vendors.length}
          />
          {CATEGORIES.map(cat => {
            const count = vendors.filter(v => v.category === cat).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={cat}
                active={filterCategory === cat}
                onClick={() => setFilterCategory(cat)}
                label={CATEGORY_LABELS[cat]}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* Table / empty / loading */}
      <div className="premium-card overflow-hidden">
        {loading && <VendorsSkeleton />}
        {fetchError && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{fetchError}</p>
            <button
              onClick={() => void loadVendors()}
              className="text-[12px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--forest)' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !fetchError && vendors.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'var(--mint-mist)' }}
            >
              <Package className="h-5 w-5" style={{ color: 'var(--forest)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              No vendors yet
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Add your first vendor to start building your directory.
            </p>
            <button
              onClick={openAdd}
              className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Add vendor
            </button>
          </div>
        )}
        {!loading && !fetchError && vendors.length > 0 && totalShown === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
              No vendors match your filters
            </p>
            <button
              onClick={() => { setSearch(''); setFilterCategory('all'); }}
              className="text-[12px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--forest)' }}
            >
              Clear filters
            </button>
          </div>
        )}
        {!loading && !fetchError && totalShown > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead
                style={{
                  background: 'var(--surface-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <tr>
                  {['Name', 'Category', 'Phone', 'Email', 'GSTIN', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => {
                  const isExpanded = expandedId === vendor.id;
                  return (
                    <React.Fragment key={vendor.id}>
                      <tr
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isExpanded ? 'var(--mint-mist-soft)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) e.currentTarget.style.background = 'var(--surface-muted)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) e.currentTarget.style.background = 'transparent';
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : vendor.id)}
                      >
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {vendor.name}
                        </td>
                        <td className="px-4 py-2.5">
                          <CategoryBadge category={vendor.category} />
                        </td>
                        <td className="px-4 py-2.5 tnum" style={{ color: 'var(--text-secondary)' }}>
                          {vendor.phone ?? '—'}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {vendor.email ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] tnum" style={{ color: 'var(--text-secondary)' }}>
                          {vendor.gstin ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ChevronDown
                            className="inline-block h-3.5 w-3.5 transition-transform"
                            style={{
                              color: 'var(--text-secondary)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                            }}
                          />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 pb-4 pt-3"
                            style={{
                              background: 'var(--mint-mist-soft)',
                              borderBottom: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3 mb-3">
                              <DetailField label="Address" value={vendor.address ?? '—'} />
                              <DetailField label="Notes" value={vendor.notes ?? '—'} />
                              <DetailField
                                label="Added"
                                value={new Date(vendor.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors"
                                style={{
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--text-heading)',
                                  background: 'var(--surface-card)',
                                }}
                                onClick={(e) => { e.stopPropagation(); openEdit(vendor); }}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors hover:bg-red-50"
                                style={{ color: '#DC2626', borderColor: '#FEE2E2', background: 'var(--surface-card)' }}
                                onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(vendor); }}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {isFiltered && (
              <div
                className="flex items-center justify-between px-4 py-2 text-[11px]"
                style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <span>Showing {totalShown} of {vendors.length}</span>
                <button
                  onClick={() => { setSearch(''); setFilterCategory('all'); }}
                  className="font-medium underline-offset-4 hover:underline"
                  style={{ color: 'var(--forest)' }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
          </DialogHeader>
          <VendorForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
            submitting={addSubmitting}
            submitLabel="Add Vendor"
            error={addError}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={!!editVendor} onOpenChange={(open) => { if (!open) setEditVendor(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <VendorForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={handleEdit}
            onCancel={() => setEditVendor(null)}
            submitting={editSubmitting}
            submitLabel="Save Changes"
            error={editError}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete{' '}
            <span className="font-medium" style={{ color: 'var(--text-heading)' }}>
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
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
          ? { background: 'var(--mint-mist)', color: 'var(--forest-deep)', borderColor: 'color-mix(in oklab, var(--forest) 30%, transparent)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span
        className="tnum text-[11px] font-medium"
        style={{ color: active ? 'var(--forest)' : 'var(--text-secondary)', opacity: active ? 1 : 0.7 }}
      >
        {count}
      </span>
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function VendorsSkeleton() {
  return (
    <div>
      <div className="h-10" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }} />
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-5 w-16 rounded-md" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton ml-auto h-4 w-4" />
        </div>
      ))}
    </div>
  );
}
