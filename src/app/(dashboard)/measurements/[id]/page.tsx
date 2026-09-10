'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DimensionsJson {
  length?: number;
  width?: number;
  height?: number;
  unit: string;
  notes?: string;
}

interface MeasurementItem {
  id: string;
  floor: string;
  room: string;
  itemName: string;
  dimensionsJson: DimensionsJson;
  qty: number;
  unit: string;
  areaSqft: number | null;
  notes: string | null;
  createdAt: string;
}

interface MeasurementDetail {
  id: string;
  leadId: string;
  projectId: string | null;
  siteVisitId: string | null;
  status: 'draft' | 'completed' | 'revised';
  measurementNumber: string | null;
  roundName: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  leadName: string;
  leadPhone: string;
  assignedToName: string | null;
  siteVisitNumber: string | null;
  items: MeasurementItem[];
}

type Status = 'draft' | 'completed' | 'revised';

function formatDimensions(d: DimensionsJson): string {
  const parts: string[] = [];
  if (d.length != null) parts.push(String(d.length));
  if (d.width != null) parts.push(String(d.width));
  if (d.height != null) parts.push(String(d.height));
  if (parts.length === 0) return '—';
  return parts.join(' × ') + (d.unit ? ` ${d.unit}` : '');
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    draft: 'bg-gray-100 text-gray-700 border border-gray-300',
    completed: 'bg-green-100 text-green-700 border border-green-300',
    revised: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  };
  const labels: Record<Status, string> = {
    draft: 'Draft',
    completed: 'Completed',
    revised: 'Revised',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm text-gray-500 font-medium">No items recorded</p>
      <p className="text-xs text-gray-400 mt-1">Measurement items will appear here once added.</p>
    </div>
  );
}

export default function MeasurementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [measurement, setMeasurement] = useState<MeasurementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const fetchMeasurement = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/measurements/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed to load measurement (${res.status})`);
      }
      const json = await res.json();
      setMeasurement(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchMeasurement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleMarkComplete = async () => {
    if (!measurement) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/v1/measurements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to mark as complete');
      }
      await fetchMeasurement();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
        </div>
        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="sticky top-6 self-start">
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-sm font-medium text-red-700 mb-1">Failed to load measurement</p>
          <p className="text-xs text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchMeasurement}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!measurement) return null;

  const title = measurement.measurementNumber ?? measurement.roundName ?? 'Measurement';

  return (
    <div className="px-6 py-6">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{title}</h1>
          <p className="mt-0.5 text-sm text-gray-500 truncate">{measurement.leadName}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={measurement.status} />
          {measurement.status === 'draft' && (
            <button
              onClick={handleMarkComplete}
              disabled={completing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {completing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving…
                </>
              ) : (
                'Mark Complete'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body grid */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* LEFT: main content */}
        <div className="space-y-6">
          {/* Overview card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Overview</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Assigned To</dt>
                <dd className="mt-1 text-sm text-gray-900">{measurement.assignedToName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Scheduled At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {measurement.scheduledAt
                    ? new Date(measurement.scheduledAt).toLocaleDateString('en-IN')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Completed At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {measurement.completedAt
                    ? new Date(measurement.completedAt).toLocaleDateString('en-IN')
                    : '—'}
                </dd>
              </div>
              {measurement.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500 uppercase tracking-wide">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{measurement.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Items
              {measurement.items.length > 0 && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {measurement.items.length}
                </span>
              )}
            </h2>
            {measurement.items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Floor</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Room</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Work Item</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">L × W × H</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Qty</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Unit</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-2">Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {measurement.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{item.floor || '—'}</td>
                        <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{item.room || '—'}</td>
                        <td className="py-3 pr-4 text-gray-900 font-medium">{item.itemName}</td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap font-mono text-xs">
                          {formatDimensions(item.dimensionsJson)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 text-right whitespace-nowrap">{item.qty}</td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{item.unit}</td>
                        <td className="py-3 text-gray-600 text-right whitespace-nowrap">
                          {item.areaSqft != null ? `${item.areaSqft.toFixed(2)} sqft` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Related card */}
        <div className="sticky top-6 self-start">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Related</h2>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">Lead</span>
                <Link
                  href={`/leads/${measurement.leadId}`}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                >
                  {measurement.leadName}
                </Link>
              </li>
              {measurement.siteVisitId && (
                <li className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">Site Visit</span>
                  <Link
                    href={`/site-visits/${measurement.siteVisitId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                  >
                    {measurement.siteVisitNumber ?? measurement.siteVisitId}
                  </Link>
                </li>
              )}
              {measurement.projectId && (
                <li className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">Project</span>
                  <Link
                    href={`/projects/${measurement.projectId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                  >
                    {measurement.projectId}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
