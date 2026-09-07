'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteVisitForm } from '@/components/site-visits/SiteVisitForm';
import type { SiteVisit } from '@/types/site-visits';
import type { MeasurementRound, MeasurementDimensions, MeasurementItem } from '@/types/leads';

// ─── Measurement helpers ──────────────────────────────────────────────────────

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
    const areaUnit = d.unit === 'ft' ? 'sqft' : d.unit === 'm' ? 'sqm' : d.unit;
    map.set(areaUnit, (map.get(areaUnit) ?? 0) + area);
  }
  return [...map.entries()].map(([unit, total]) => ({ unit, total }));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const M_COLS = ['Room', 'Item / Work', 'Length', 'Width', 'Height', 'Area', 'Qty', 'Unit', 'Notes'];

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'visit' | 'measurements';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [activeTab, setActiveTab]   = useState<Tab>('visit');

  // ── Visit state ──
  const [visit, setVisit]           = useState<SiteVisit | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ── Measurements state ──
  const [rounds, setRounds]                   = useState<MeasurementRound[]>([]);
  const [mLoading, setMLoading]               = useState(false);
  const [mLoaded, setMLoaded]                 = useState(false);
  const [downloadingId, setDownloadingId]     = useState<string | null>(null);
  const [downloadErr, setDownloadErr]         = useState<string | null>(null);

  // Fetch visit on mount
  useEffect(() => {
    fetch(`/api/v1/site-visits?leadId=${id}`)
      .then(r => r.json())
      .then(({ data }: { data: SiteVisit[] }) => {
        const found = data.find(v => !v.completedAt) ?? data[0] ?? null;
        setVisit(found);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load site visit.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load measurements when tab is first opened
  useEffect(() => {
    if (activeTab !== 'measurements' || mLoaded) return;
    setMLoading(true);
    fetch(`/api/v1/leads/${id}/measurements`)
      .then(r => r.json())
      .then(({ data }: { data?: MeasurementRound[] }) => setRounds(data ?? []))
      .catch(() => {})
      .finally(() => { setMLoading(false); setMLoaded(true); });
  }, [activeTab, id, mLoaded]);

  async function handleMarkComplete() {
    if (!visit) return;
    setCompleting(true); setCompleteError(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${visit.id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { data: updated } = (await res.json()) as { data: SiteVisit };
      setVisit(updated);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to mark visit complete.');
    } finally {
      setCompleting(false);
    }
  }

  async function handleDownload(roundId: string) {
    setDownloadingId(roundId); setDownloadErr(null);
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

  const address    = visit?.locationJson?.address ?? 'Address not recorded';
  const isScheduled = visit && !visit.completedAt;
  const isCompleted = visit && !!visit.completedAt;
  const totalMeasurementItems = rounds.reduce((s, r) => s + (r.items?.length ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/leads/${id}`}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Back to lead
        </Link>
        <span style={{ color: 'var(--border-subtle)' }}>|</span>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Site Visit</h1>
      </div>

      {/* Tab bar — pill style */}
      <div className="flex items-center gap-2">
        {([
          { key: 'visit',        label: 'Site Visit'    },
          { key: 'measurements', label: 'Measurements'  },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={activeTab === key ? {
              background: 'var(--violet-primary)',
              color: '#fff',
            } : {
              background: 'var(--surface-muted)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {label}
            {key === 'measurements' && mLoaded && totalMeasurementItems > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={activeTab === 'measurements'
                  ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { background: 'var(--violet-primary)', color: '#fff' }}
              >
                {totalMeasurementItems}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SITE VISIT TAB ──────────────────────────────────────────── */}
      {activeTab === 'visit' && (
        <div className="space-y-4">
          {loading && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          )}
          {!loading && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && !visit && (
            <div className="rounded-xl p-5 sm:p-6" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
                Schedule a Site Visit
              </h2>
              <SiteVisitForm leadId={id} onSuccess={(v) => setVisit(v)} />
            </div>
          )}

          {!loading && !error && isScheduled && (
            <div className="rounded-xl p-5 sm:p-6" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Scheduled Visit
                </h2>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  Scheduled
                </span>
              </div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Date &amp; Time</dt>
                  <dd className="mt-1 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                    {new Date(visit.scheduledAt).toLocaleString('en-IN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Address</dt>
                  <dd className="mt-1 text-sm" style={{ color: 'var(--text-heading)' }}>{address}</dd>
                </div>
                {visit.designerId && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Designer</dt>
                    <dd className="mt-1 text-sm" style={{ color: 'var(--text-heading)' }}>{visit.designerId}</dd>
                  </div>
                )}
                {visit.notes && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Notes</dt>
                    <dd className="mt-1 text-sm" style={{ color: 'var(--text-heading)' }}>{visit.notes}</dd>
                  </div>
                )}
              </dl>
              {completeError && <p className="mt-3 text-sm text-red-600">{completeError}</p>}
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                className="mt-5 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent-base)' }}
              >
                {completing ? 'Updating…' : 'Mark Complete'}
              </button>
            </div>
          )}

          {!loading && !error && isCompleted && (
            <div className="rounded-xl p-5 sm:p-6" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold" style={{ color: 'var(--success-text)' }}>Visit Completed</h2>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                  Completed
                </span>
              </div>
              <dl className="space-y-3">
                {visit.completedAt && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Completed At</dt>
                    <dd className="mt-1 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                      {new Date(visit.completedAt).toLocaleString('en-IN')}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Address</dt>
                  <dd className="mt-1 text-sm" style={{ color: 'var(--text-heading)' }}>{address}</dd>
                </div>
                {visit.notes && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Notes</dt>
                    <dd className="mt-1 text-sm" style={{ color: 'var(--text-heading)' }}>{visit.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}

      {/* ── MEASUREMENTS TAB ────────────────────────────────────────── */}
      {activeTab === 'measurements' && (
        <div className="space-y-4">

          {/* Loading skeleton */}
          {mLoading && (
            <div className="space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="rounded-xl h-32 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
              ))}
            </div>
          )}

          {/* PDF error */}
          {downloadErr && (
            <div className="rounded-lg px-4 py-2.5 text-sm flex items-center justify-between"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {downloadErr}
              <button type="button" onClick={() => setDownloadErr(null)} className="ml-3 font-bold">✕</button>
            </div>
          )}

          {/* Empty state */}
          {mLoaded && rounds.length === 0 && (
            <div className="rounded-xl py-14 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No measurements recorded yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Add rounds and items from the lead&apos;s Measurements tab
              </p>
              <Link
                href={`/leads/${id}`}
                className="mt-5 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--violet-primary)' }}
              >
                Go to lead →
              </Link>
            </div>
          )}

          {/* Rounds */}
          {rounds.map(round => {
            const items = round.items ?? [];
            const areaSummary = areaByUnit(items);
            const isComplete  = !!round.completedAt;

            return (
              <div
                key={round.id}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
              >
                {/* Round header */}
                <div
                  className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}
                >
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                      {round.roundName}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={isComplete
                        ? { background: 'var(--success-soft)', color: 'var(--success-text)' }
                        : { background: 'var(--accent-soft)', color: 'var(--violet-primary)' }}
                    >
                      {isComplete ? 'Completed' : 'In progress'}
                    </span>
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
                    >
                      {downloadingId === round.id ? 'Generating…' : '↓ PDF'}
                    </button>
                  </div>
                </div>

                {/* Empty round */}
                {items.length === 0 && (
                  <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No items in this round
                  </p>
                )}

                {/* Table */}
                {items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {M_COLS.map(h => (
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
                          const d    = item.dimensionsJson;
                          const area = computeArea(d);
                          return (
                            <tr
                              key={item.id}
                              className="transition-colors hover:bg-[var(--surface-muted)]"
                              style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                            >
                              <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                                {item.room}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'var(--text-heading)', minWidth: '140px' }}>
                                {item.itemName}
                              </td>
                              <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                {d.length != null ? d.length : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                {d.width != null ? d.width : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                {d.height != null ? d.height : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums font-medium whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                                {area != null ? `${area} ${d.unit === 'ft' ? 'sqft' : d.unit === 'm' ? 'sqm' : d.unit}` : '—'}
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

                {/* Round footer */}
                {items.length > 0 && (
                  <div
                    className="px-5 py-2.5 flex flex-wrap items-center gap-5 text-xs"
                    style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Items: <strong style={{ color: 'var(--text-heading)' }}>{items.length}</strong>
                    </span>
                    {areaSummary.map(({ unit, total }) => (
                      <span key={unit} style={{ color: 'var(--text-secondary)' }}>
                        Area ({unit}): <strong style={{ color: 'var(--text-heading)' }}>{total.toFixed(2)}</strong>
                      </span>
                    ))}
                    {round.notes && (
                      <span style={{ color: 'var(--text-tertiary)' }}>Note: {round.notes}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
