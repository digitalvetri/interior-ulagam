'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  other: 'bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-subtle)]',
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
      <Badge variant="outline" className="bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]">
        —
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={CATEGORY_BADGE_CLASSES[category]}>
      {CATEGORY_LABELS[category]}
    </Badge>
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">+ Add Vendor</button>
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden">
        {loading && (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading vendors…</div>
        )}
        {fetchError && !loading && (
          <div className="p-10 text-center text-sm text-red-600">{fetchError}</div>
        )}
        {!loading && !fetchError && vendors.length === 0 && (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            No vendors yet. Add your first vendor.
          </div>
        )}
        {!loading && !fetchError && vendors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {['Name', 'Category', 'Phone', 'Email', 'GSTIN', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => {
                  const isExpanded = expandedId === vendor.id;
                  return (
                    <React.Fragment key={vendor.id}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onClick={() => setExpandedId(isExpanded ? null : vendor.id)}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{vendor.name}</td>
                        <td className="px-4 py-3"><CategoryBadge category={vendor.category} /></td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{vendor.phone ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{vendor.email ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{vendor.gstin ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs select-none" style={{ color: 'var(--text-secondary)' }}>{isExpanded ? '▲' : '▼'}</span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4 pt-2" style={{ background: 'var(--surface-muted)' }}>
                            <div className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 mb-3">
                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Address: </span>
                                <span style={{ color: 'var(--text-primary)' }}>{vendor.address ?? '—'}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Notes: </span>
                                <span style={{ color: 'var(--text-primary)' }}>{vendor.notes ?? '—'}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Added: </span>
                                <span style={{ color: 'var(--text-primary)' }}>{new Date(vendor.createdAt).toLocaleDateString('en-IN')}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="btn-secondary px-3 py-1.5 text-xs"
                                onClick={(e) => { e.stopPropagation(); openEdit(vendor); }}
                              >Edit</button>
                              <button
                                className="px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors text-red-600 border-red-200 hover:bg-red-50"
                                onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(vendor); }}
                              >Delete</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
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
