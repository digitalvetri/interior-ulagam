'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { RoomEntry } from '@/types/site-visits';

interface RequirementRowProps {
  room: RoomEntry;
  onEdit: (updated: RoomEntry) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function RequirementRow({ room, onEdit, onDelete }: RequirementRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name);
  const [stylePreference, setStylePreference] = useState(room.stylePreference ?? '');
  const [budgetInput, setBudgetInput] = useState(
    room.budgetBandPaise != null ? String(Math.round(room.budgetBandPaise / 100)) : ''
  );
  const [notes, setNotes] = useState(room.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const updated: RoomEntry = {
      name: name.trim(),
      stylePreference: stylePreference.trim() || undefined,
      budgetBandPaise:
        budgetInput.trim() !== '' ? Math.round(Number(budgetInput) * 100) : undefined,
      notes: notes.trim() || undefined,
    };
    try {
      await onEdit(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed — please try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancel() {
    setName(room.name);
    setStylePreference(room.stylePreference ?? '');
    setBudgetInput(
      room.budgetBandPaise != null ? String(Math.round(room.budgetBandPaise / 100)) : ''
    );
    setNotes(room.notes ?? '');
    setError(null);
    setEditing(false);
  }

  if (confirmDelete) {
    return (
      <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800 mb-1">Delete &quot;{room.name}&quot;?</p>
        <p className="text-xs text-red-600 mb-3">This room entry will be permanently removed.</p>
        {error && <p className="text-xs text-red-700 mb-2 font-medium">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-red-700"
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button
            onClick={() => { setConfirmDelete(false); setError(null); }}
            disabled={deleting}
            className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)]">Style Preference</label>
            <input type="text" value={stylePreference}
              onChange={(e) => setStylePreference(e.target.value)}
              placeholder="e.g. Contemporary, Minimalist"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)]">Budget Band (₹)</label>
            <input type="number" min={0} value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)]">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-1.5 text-sm focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="rounded-md bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={saving}
              className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-[var(--text-heading)]">{room.name}</p>
        {room.stylePreference && (
          <p className="text-xs text-[var(--text-secondary)]">Style: {room.stylePreference}</p>
        )}
        {room.budgetBandPaise != null && (
          <p className="text-xs text-[var(--text-secondary)]">Budget: {formatRupees(room.budgetBandPaise)}</p>
        )}
        {room.notes && (
          <p className="text-xs text-[var(--text-secondary)]">{room.notes}</p>
        )}
        {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
      </div>
      <div className="ml-4 flex shrink-0 gap-2">
        <button onClick={() => setEditing(true)} aria-label="Edit"
          className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => setConfirmDelete(true)} aria-label="Delete"
          className="rounded p-1 text-[var(--text-tertiary)] hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
