'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteVisitForm } from '@/components/site-visits/SiteVisitForm';
import type { SiteVisit } from '@/types/site-visits';

export default function SiteVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [visit, setVisit] = useState<SiteVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVisit() {
      try {
        const res = await fetch(`/api/v1/site-visits?leadId=${id}`);
        if (!res.ok) throw new Error(`Failed to load site visit (${res.status})`);
        const { data } = (await res.json()) as { data: SiteVisit[] };
        // Take the first non-completed visit, or the most recent one
        const found = data.find((v) => !v.completedAt) ?? data[0] ?? null;
        setVisit(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load site visit.');
        console.error('[SiteVisitPage]', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchVisit();
  }, [id]);

  async function handleMarkComplete() {
    if (!visit) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${visit.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { data: updated } = (await res.json()) as { data: SiteVisit };
      setVisit(updated);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to mark visit complete.');
      console.error('[SiteVisitPage] complete error:', err);
    } finally {
      setCompleting(false);
    }
  }

  const address = visit?.locationJson?.address ?? 'Address not recorded';
  const isScheduled = visit && !visit.completedAt;
  const isCompleted = visit && !!visit.completedAt;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/leads/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
          ← Back to Lead
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Visit</h1>
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {!loading && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && !visit && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Schedule a Site Visit
          </h2>
          <SiteVisitForm leadId={id} onSuccess={(v) => setVisit(v)} />
        </div>
      )}

      {!loading && !error && isScheduled && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Visit</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              Scheduled
            </span>
          </div>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Date &amp; Time</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {new Date(visit.scheduledAt).toLocaleString('en-IN')}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">{address}</dd>
            </div>
            {visit.designerId && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Designer</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{visit.designerId}</dd>
              </div>
            )}
            {visit.notes && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{visit.notes}</dd>
              </div>
            )}
          </dl>
          {completeError && <p className="mt-3 text-sm text-red-600">{completeError}</p>}
          <button onClick={handleMarkComplete} disabled={completing}
            className="mt-5 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50">
            {completing ? 'Updating…' : 'Mark Complete'}
          </button>
        </div>
      )}

      {!loading && !error && isCompleted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">Visit Completed</h2>
            <span className="rounded-full bg-green-200 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Completed
            </span>
          </div>
          <dl className="mt-4 space-y-3">
            {visit.completedAt && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-green-700">Completed At</dt>
                <dd className="mt-1 text-sm text-green-900 dark:text-green-100">
                  {new Date(visit.completedAt).toLocaleString('en-IN')}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-green-700">Address</dt>
              <dd className="mt-1 text-sm text-green-900 dark:text-green-100">{address}</dd>
            </div>
            {visit.notes && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-green-700">Notes</dt>
                <dd className="mt-1 text-sm text-green-900 dark:text-green-100">{visit.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
