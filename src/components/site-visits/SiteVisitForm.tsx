'use client';

import { useEffect, useState } from 'react';
import type { SiteVisit } from '@/types/site-visits';

interface TeamMember { id: string; fullName: string; role: string; }

interface SiteVisitFormProps {
  leadId: string;
  onSuccess: (visit: SiteVisit) => void;
}

export function SiteVisitForm({ leadId, onSuccess }: SiteVisitFormProps) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [address, setAddress]         = useState('');
  const [designerId, setDesignerId]   = useState('');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [team, setTeam]               = useState<TeamMember[]>([]);

  // Fetch designers/owners for the dropdown
  useEffect(() => {
    fetch('/api/v1/employees')
      .then(r => r.json())
      .then((res: { data?: TeamMember[] }) => {
        const members = (res.data ?? []).filter(
          m => m.role === 'designer' || m.role === 'owner',
        );
        setTeam(members);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scheduledAt) {
      setError('Please select a date and time.');
      return;
    }

    const parsedDate = new Date(scheduledAt);
    if (isNaN(parsedDate.getTime())) {
      setError('Invalid date — please pick again.');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        leadId,
        scheduledAt: parsedDate.toISOString(),
        address,
      };
      if (designerId) body.designerId = designerId;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch('/api/v1/site-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(json.error ?? json.message ?? `Request failed (${res.status})`);
      }

      const { data: visit } = (await res.json()) as { data: SiteVisit };
      setSuccess(true);
      onSuccess(visit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      console.error('[SiteVisitForm] submit error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        Site visit scheduled successfully.
      </div>
    );
  }

  const inputCls = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sv-scheduledAt" className={labelCls}>
          Date &amp; Time <span className="text-red-500">*</span>
        </label>
        <input
          id="sv-scheduledAt"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="sv-address" className={labelCls}>
          Address <span className="text-red-500">*</span>
        </label>
        <input
          id="sv-address"
          type="text"
          required
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Site address"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="sv-designer" className={labelCls}>
          Assign Designer
        </label>
        <select
          id="sv-designer"
          value={designerId}
          onChange={e => setDesignerId(e.target.value)}
          className={inputCls}
        >
          <option value="">Unassigned</option>
          {team.map(m => (
            <option key={m.id} value={m.id}>{m.fullName}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sv-notes" className={labelCls}>
          Notes
        </label>
        <textarea
          id="sv-notes"
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any preparation notes…"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        {loading ? 'Scheduling…' : 'Schedule Site Visit'}
      </button>
    </form>
  );
}
