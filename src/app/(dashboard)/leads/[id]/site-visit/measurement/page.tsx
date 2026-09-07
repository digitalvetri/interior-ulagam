'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { MeasurementRound, MeasurementItem, MeasurementDimensions } from '@/types/leads';

function computeArea(d: MeasurementDimensions): number | null {
  if (d.area != null) return d.area;
  if (d.length != null && d.width != null) return +(d.length * d.width).toFixed(2);
  return null;
}

function areaByUnit(items: MeasurementItem[]): { unit: string; total: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = item.dimensionsJson;
    const area = computeArea(d);
    if (area == null) continue;
    // Infer area unit from dimension unit: ft→sqft, m→sqm; sqft/sqm pass through
    const areaUnit = d.unit === 'ft' ? 'sqft' : d.unit === 'm' ? 'sqm' : d.unit;
    map.set(areaUnit, (map.get(areaUnit) ?? 0) + area);
  }
  return [...map.entries()].map(([unit, total]) => ({ unit, total }));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TH_COLS = ['Room', 'Item / Work', 'Length', 'Width', 'Height', 'Area', 'Qty', 'Unit', 'Notes'];

export default function MeasurementViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [rounds, setRounds]           = useState<MeasurementRound[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/leads/${id}/measurements`)
      .then(r => r.json())
      .then(({ data }: { data?: MeasurementRound[] }) => setRounds(data ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load measurements.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload(roundId: string) {
    setDownloadingId(roundId);
    setDownloadErr(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/measurements/${roundId}/pdf`, { method: 'POST' });
      const json = await res.json() as { data?: { pdfUrl: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      if (json.data?.pdfUrl) window.open(json.data.pdfUrl, '_blank');
    } catch (err) {
      setDownloadErr(err instanceof Error ? err.message : 'Could not generate PDF.');
    } finally {
      setDownloadingId(null);
    }
  }

  const totalItems = rounds.reduce((s, r) => s + (r.items?.length ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/leads/${id}/site-visit`}
            className="text-sm font-medium transition-colors hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back to site visit
          </Link>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
            Measurements
          </h1>
        </div>
        {!loading && !error && totalItems > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {rounds.length} round{rounds.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map(n => (
            <div key={n} className="rounded-xl h-40 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl px-5 py-4 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {!loading && !error && rounds.length === 0 && (
        <div className="rounded-xl py-14 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No measurements recorded yet</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Add rounds and items from the lead's Measurements tab
          </p>
          <Link
            href={`/leads/${id}`}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--violet-primary)' }}
          >
            Go to lead →
          </Link>
        </div>
      )}

      {/* PDF error banner */}
      {downloadErr && (
        <div className="rounded-lg px-4 py-2.5 text-sm flex items-center justify-between"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          {downloadErr}
          <button type="button" onClick={() => setDownloadErr(null)} className="ml-3 font-bold">✕</button>
        </div>
      )}

      {/* Rounds */}
      {!loading && !error && rounds.map((round) => {
        const items = round.items ?? [];
        const areaSummary = areaByUnit(items);
        const isComplete = !!round.completedAt;

        return (
          <div
            key={round.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Round header */}
            <div
              className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
              style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}
            >
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                  {round.roundName}
                </span>

                {isComplete ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                    Completed
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--violet-primary)' }}>
                    In progress
                  </span>
                )}

                {round.scheduledAt && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDate(round.scheduledAt)}
                  </span>
                )}

                {round.assignedToName && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    · {round.assignedToName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleDownload(round.id)}
                  disabled={downloadingId === round.id || items.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
                >
                  {downloadingId === round.id ? 'Generating…' : '↓ PDF'}
                </button>
              </div>
            </div>

            {/* Empty state */}
            {items.length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                No items in this round
              </p>
            )}

            {/* Table */}
            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {TH_COLS.map(h => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const d = item.dimensionsJson;
                      const area = computeArea(d);
                      const isLast = idx === items.length - 1;
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-[var(--surface-muted)]"
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
                        >
                          <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                            {item.room}
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-heading)', minWidth: '140px' }}>
                            {item.itemName}
                          </td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {d.length != null ? d.length : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {d.width != null ? d.width : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {d.height != null ? d.height : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums font-medium whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                            {area != null ? `${area} ${d.unit}` : '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {item.qty}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {item.unit}
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)', maxWidth: '180px' }}>
                            <div className="truncate" title={item.notes ?? undefined}>
                              {item.notes ?? '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Round totals footer */}
            {items.length > 0 && (
              <div
                className="px-5 py-2.5 flex flex-wrap items-center gap-5 text-xs"
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  Items:{' '}
                  <strong style={{ color: 'var(--text-heading)' }}>{items.length}</strong>
                </span>
                {areaSummary.map(({ unit, total }) => (
                  <span key={unit} style={{ color: 'var(--text-secondary)' }}>
                    Area ({unit}):{' '}
                    <strong style={{ color: 'var(--text-heading)' }}>{total.toFixed(2)}</strong>
                  </span>
                ))}
                {round.notes && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    Note: {round.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
