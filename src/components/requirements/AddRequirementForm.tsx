'use client';

import { useState } from 'react';
import type { RequirementRow } from '@/types/site-visits';

interface AddRequirementFormProps {
  leadId: string;
  onSuccess: (row: RequirementRow) => void;
}

export function AddRequirementForm({ leadId, onSuccess }: AddRequirementFormProps) {
  const [roomName, setRoomName] = useState('');
  const [stylePreference, setStylePreference] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const budgetBandPaise =
      budgetInput.trim() !== '' ? Math.round(Number(budgetInput) * 100) : undefined;

    try {
      const res = await fetch('/api/v1/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          roomName: roomName.trim(),
          stylePreference: stylePreference.trim() || undefined,
          budgetBandPaise,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const { data } = (await res.json()) as { data: RequirementRow };
      onSuccess(data);
      setRoomName('');
      setStylePreference('');
      setBudgetInput('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      console.error('[AddRequirementForm]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Room</h3>

      <div>
        <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Room Name <span className="text-red-500">*</span>
        </label>
        <input id="roomName" type="text" required value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="e.g. Master Bedroom, Living Room"
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </div>

      <div>
        <label htmlFor="stylePreference" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Style Preference
        </label>
        <input id="stylePreference" type="text" value={stylePreference}
          onChange={(e) => setStylePreference(e.target.value)}
          placeholder="e.g. Contemporary, Minimalist"
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </div>

      <div>
        <label htmlFor="budgetBand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Budget Band (₹)
        </label>
        <input id="budgetBand" type="number" min={0} value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 250000"
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </div>

      <div>
        <label htmlFor="reqNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
        <textarea id="reqNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Client preferences, must-haves…"
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900">
        {loading ? 'Adding…' : 'Add Room'}
      </button>
    </form>
  );
}
