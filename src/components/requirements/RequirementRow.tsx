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
    try {
      await onDelete();
    } catch {
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

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Style Preference
            </label>
            <input type="text" value={stylePreference}
              onChange={(e) => setStylePreference(e.target.value)}
              placeholder="e.g. Contemporary, Minimalist"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Budget Band (₹)
            </label>
            <input type="number" min={0} value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{room.name}</p>
        {room.stylePreference && (
          <p className="text-xs text-gray-500 dark:text-gray-400">Style: {room.stylePreference}</p>
        )}
        {room.budgetBandPaise != null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Budget: {formatRupees(room.budgetBandPaise)}
          </p>
        )}
        {room.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{room.notes}</p>
        )}
      </div>
      <div className="ml-4 flex shrink-0 gap-2">
        <button onClick={() => setEditing(true)} aria-label="Edit"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} disabled={deleting} aria-label="Delete"
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
