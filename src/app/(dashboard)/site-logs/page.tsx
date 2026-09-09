'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, AlertTriangle, TrendingUp, Users } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SiteLog {
  id: string;
  projectId: string;
  projectName: string;
  logDate: string;
  transcript: string | null;
  progressPct: number | null;
  delayFlag: boolean;
  labourCount: number | null;
  source: string;
  photos: string[];
  createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, onOpen }: { log: SiteLog; onOpen: (id: string) => void }) {
  return (
    <div
      className="premium-card p-4 space-y-2 cursor-pointer transition-shadow hover:shadow-md"
      style={log.delayFlag ? { borderLeft: '3px solid var(--danger)' } : undefined}
      onClick={() => onOpen(log.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--text-heading)' }}
          >
            {log.projectName}
          </span>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{fmtDate(log.logDate)}</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {log.delayFlag && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3 w-3" />
              Delay
            </span>
          )}
          {log.progressPct !== null && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: 'var(--success-text)' }}>
              <TrendingUp className="h-3 w-3" />
              {log.progressPct}%
            </span>
          )}
          {log.labourCount !== null && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: 'rgba(107,114,128,0.1)', color: 'var(--text-secondary)' }}>
              <Users className="h-3 w-3" />
              {log.labourCount}
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
            style={{ backgroundColor: 'rgba(107,114,128,0.08)', color: 'var(--text-tertiary)' }}>
            {log.source}
          </span>
        </div>
      </div>

      {log.transcript && (
        <p className="text-sm text-[var(--text-primary)] leading-relaxed line-clamp-3">
          {log.transcript}
        </p>
      )}

      {(log.photos ?? []).length > 0 && (
        <p className="text-xs text-[var(--text-tertiary)]">
          📷 {(log.photos ?? []).length} photo{(log.photos ?? []).length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteLogsPage() {
  const router = useRouter();
  const [logs,       setLogs]       = useState<SiteLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');

  function load(fromVal: string, toVal: string) {
    setLoading(true);
    setFetchError(null);

    const params = new URLSearchParams({ limit: '100' });
    if (fromVal) params.set('from', fromVal);
    if (toVal)   params.set('to', toVal);

    fetch(`/api/v1/site-logs?${params.toString()}`)
      .then(r => r.json())
      .then((body: { data?: SiteLog[]; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed');
        setLogs(body.data);
      })
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load('', ''); }, []);

  // Group logs by date
  const grouped = logs.reduce<Record<string, SiteLog[]>>((acc, log) => {
    const date = log.logDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const delayCount = logs.filter(l => l.delayFlag).length;

  return (
    <div className="space-y-6 pb-10 p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[var(--text-heading)]" style={{ letterSpacing: '-0.03em' }}>Site Logs</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Daily progress feed across all active projects
          </p>
        </div>
        {delayCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {delayCount} delay{delayCount !== 1 ? 's' : ''} flagged
          </span>
        )}
      </div>

      {/* Date filters */}
      <div className="premium-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-page)] px-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-page)] px-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <button
            type="button"
            onClick={() => load(from, to)}
            className="h-8 rounded-md px-3 text-sm font-medium text-white"
            style={{ background: 'var(--violet-primary, var(--accent-base))' }}
          >
            Filter
          </button>
          {(from || to) && (
            <button
              type="button"
              onClick={() => { setFrom(''); setTo(''); load('', ''); }}
              className="h-8 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-[var(--text-tertiary)]">
            {loading ? 'Loading…' : `${logs.length} log${logs.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : dates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 rounded-full bg-[var(--surface-muted)] p-4">
            <ClipboardList className="h-7 w-7 text-[var(--text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No site logs yet</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Logs appear here as supervisors update daily progress on projects.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map(date => (
            <div key={date}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {fmtDate(date)}
              </p>
              <div className="space-y-3">
                {grouped[date].map(log => (
                  <LogCard key={log.id} log={log} onOpen={id => router.push(`/site-logs/${id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
