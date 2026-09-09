'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Ruler, Search, CheckCircle2, Clock, FileEdit, Loader2, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MRStatus = 'draft' | 'completed' | 'revised';

interface MeasurementRow {
  id: string;
  leadId: string;
  measurementNumber: string | null;
  status: MRStatus;
  roundName: string;
  scheduledAt: string | null;
  completedAt: string | null;
  assignedToName: string | null;
  notes: string | null;
  createdAt: string;
  contactName: string | null;
  contactPhone: string | null;
  itemCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MRStatus, { label: string; bg: string; fg: string; border: string; Icon: React.ElementType }> = {
  draft:     { label: 'Draft',     bg: 'var(--surface-muted)',      fg: 'var(--text-secondary)',    border: 'var(--border-subtle)',       Icon: FileEdit    },
  completed: { label: 'Completed', bg: 'var(--success-soft)',       fg: 'var(--success-text)',      border: 'rgba(15,157,110,0.24)',      Icon: CheckCircle2 },
  revised:   { label: 'Revised',   bg: 'var(--accent-orange-bg)',   fg: 'var(--accent-orange)',     border: 'rgba(194,65,12,0.22)',       Icon: Ruler        },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeasurementsPage() {
  const router = useRouter();
  const [rows, setRows]       = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<MRStatus | 'all'>('all');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/v1/measurements')
      .then(r => r.json())
      .then(({ data }: { data?: MeasurementRow[] }) => setRows(data ?? []))
      .catch(() => setError('Failed to load — please retry'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        (r.contactName ?? '').toLowerCase().includes(q) ||
        r.roundName.toLowerCase().includes(q) ||
        (r.measurementNumber ?? '').toLowerCase().includes(q) ||
        (r.assignedToName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    (['draft', 'completed', 'revised'] as MRStatus[]).forEach(s => {
      c[s] = rows.filter(r => r.status === s).length;
    });
    return c;
  }, [rows]);

  return (
    <div className="space-y-6 p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Measurements</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${rows.length} round${rows.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, round, designer…"
            className="studio-input w-full h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'draft', 'completed', 'revised'] as const).map(s => (
            counts[s] > 0 || s === 'all' ? (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors"
                style={filter === s
                  ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
                  : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                <span className="tnum text-[11px]" style={{ opacity: 0.8 }}>{counts[s]}</span>
              </button>
            ) : null
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="premium-card overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetch('/api/v1/measurements').then(r => r.json()).then(({ data }: { data?: MeasurementRow[] }) => setRows(data ?? [])).catch(() => setError('Failed to load')).finally(() => setLoading(false)); }}
              className="text-xs underline"
              style={{ color: 'var(--accent-base)' }}
            >Retry</button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
              <Ruler className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No measurements recorded yet</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Measurement rounds are created from a lead&apos;s site-visit page.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No rounds match your filters</p>
            <button onClick={() => { setSearch(''); setFilter('all'); }} className="text-[12px] underline" style={{ color: 'var(--accent-base)' }}>Clear</button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {['#', 'Client', 'Round', 'Status', 'Scheduled', 'Items', 'Assigned To'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft;
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="transition-colors cursor-pointer"
                      onClick={() => router.push(`/measurements/${r.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3">
                        <span className="tnum text-[12px] font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {r.measurementNumber ?? r.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-heading)' }}>
                          {r.contactName ?? '—'}
                        </p>
                        {r.contactPhone && (
                          <p className="text-[11px] mt-0.5 tnum" style={{ color: 'var(--text-secondary)' }}>{r.contactPhone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-heading)' }}>
                        {r.roundName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border"
                          style={{ background: cfg.bg, color: cfg.fg, borderColor: cfg.border }}
                        >
                          <cfg.Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 tnum text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        {fmtDate(r.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 tnum font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {r.itemCount}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        {r.assignedToName ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats footer */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <span>{rows.filter(r => r.status === 'completed').length} completed</span>
          <span>{rows.filter(r => r.status === 'draft').length} in progress</span>
          <span>{rows.reduce((s, r) => s + r.itemCount, 0)} total items measured</span>
        </div>
      )}
    </div>
  );
}
