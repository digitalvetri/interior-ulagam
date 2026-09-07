'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  HardHat, Search, FolderKanban, User, Calendar,
  Loader2, AlertTriangle, CheckCircle2, Clock, Truck, Wrench,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type WOStatus = 'planned' | 'in_progress' | 'ready' | 'installed';
type WOType   = 'inhouse_carpentry' | 'factory' | 'vendor_job' | 'site_work';

interface WorkOrder {
  id: string;
  projectId: string;
  title: string;
  type: WOType;
  status: WOStatus;
  startDate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  projectName: string | null;
  vendorName: string | null;
  assigneeName: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WOStatus, string> = {
  planned:     'Planned',
  in_progress: 'In Progress',
  ready:       'Ready',
  installed:   'Installed',
};

const STATUS_STYLES: Record<WOStatus, { bg: string; fg: string; border: string }> = {
  planned:     { bg: 'var(--surface-muted)',    fg: 'var(--text-secondary)',  border: 'var(--border-subtle)' },
  in_progress: { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)',     border: 'rgba(37,99,235,0.22)' },
  ready:       { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)',   border: 'rgba(194,65,12,0.22)' },
  installed:   { bg: 'var(--success-soft)',      fg: 'var(--success-text)',    border: 'rgba(15,157,110,0.24)' },
};

const STATUS_ICONS: Record<WOStatus, React.ElementType> = {
  planned:     Clock,
  in_progress: Wrench,
  ready:       CheckCircle2,
  installed:   CheckCircle2,
};

const STATUS_ORDER: WOStatus[] = ['planned', 'in_progress', 'ready', 'installed'];

const TYPE_LABELS: Record<WOType, string> = {
  inhouse_carpentry: 'In-house',
  factory:           'Factory',
  vendor_job:        'Vendor Job',
  site_work:         'Site Work',
};

const TYPE_STYLES: Record<WOType, { bg: string; fg: string }> = {
  inhouse_carpentry: { bg: '#EDE9FE', fg: '#6D28D9' },
  factory:           { bg: '#DBEAFE', fg: '#1D4ED8' },
  vendor_job:        { bg: '#FEF3C7', fg: '#92400E' },
  site_work:         { bg: '#DCFCE7', fg: '#166534' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span className="tnum text-[11px]" style={{ opacity: 0.8 }}>{count}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const [orders,  setOrders]  = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<WOStatus | 'all'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/v1/work-orders');
      const body = (await res.json()) as { data?: WorkOrder[]; error?: string };
      if (!res.ok || !body.data) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load work orders');
        return;
      }
      setOrders(body.data);
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadData(); }, [loadData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        (o.projectName ?? '').toLowerCase().includes(q) ||
        (o.vendorName  ?? '').toLowerCase().includes(q) ||
        (o.assigneeName ?? '').toLowerCase().includes(q)
      );
    });
  }, [orders, search, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    STATUS_ORDER.forEach(s => { c[s] = orders.filter(o => o.status === s).length; });
    return c;
  }, [orders]);

  const activeCount = orders.filter(o => o.status === 'planned' || o.status === 'in_progress').length;

  return (
    <div className="space-y-6 p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading…'
              : `${activeCount} active · ${orders.length} total across all projects`}
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-md font-medium border transition-colors"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
        >
          <FolderKanban className="h-3.5 w-3.5" />
          Go to Projects
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, project, vendor…"
            className="studio-input w-full h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label="All" count={counts.all} />
          {STATUS_ORDER.map(s => counts[s] > 0 ? (
            <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} label={STATUS_LABELS[s]} count={counts[s]} />
          ) : null)}
        </div>
      </div>

      {/* Table */}
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
            <button onClick={() => void loadData()} className="text-xs underline" style={{ color: 'var(--accent-base)' }}>Retry</button>
          </div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
              <HardHat className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No work orders yet</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Create work orders inside a project to assign carpentry, factory, or site tasks.
            </p>
            <Link href="/projects"
              className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]">
              <FolderKanban className="h-3.5 w-3.5" /> Open Projects
            </Link>
          </div>
        )}
        {!loading && !error && orders.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No work orders match your filters</p>
            <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className="text-[12px] underline" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {['Task', 'Type', 'Project', 'Status', 'Assigned to', 'Start', 'Due'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const ss   = STATUS_STYLES[o.status];
                  const ts   = TYPE_STYLES[o.type] ?? { bg: 'var(--surface-muted)', fg: 'var(--text-secondary)' };
                  const SI   = STATUS_ICONS[o.status];
                  const past = o.dueDate && new Date(o.dueDate) < new Date() && (o.status === 'planned' || o.status === 'in_progress');
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{o.title}</p>
                        {o.notes && (
                          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{o.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: ts.bg, color: ts.fg }}>
                          {TYPE_LABELS[o.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        <Link href={`/projects/${o.projectId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline truncate"
                          style={{ color: 'var(--accent-base)' }}>
                          <FolderKanban className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{o.projectName || 'View project'}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border"
                          style={{ background: ss.bg, color: ss.fg, borderColor: ss.border }}>
                          <SI className="h-3 w-3" />
                          {STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[120px]">
                        {o.assigneeName || o.vendorName ? (
                          <div className="flex items-center gap-1.5">
                            {o.vendorName
                              ? <Truck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                              : <User  className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                            }
                            <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                              {o.vendorName || o.assigneeName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tnum" style={{ color: 'var(--text-secondary)' }}>
                        {o.startDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                            {fmtDate(o.startDate)}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 tnum" style={{ color: past ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {fmtDate(o.dueDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
