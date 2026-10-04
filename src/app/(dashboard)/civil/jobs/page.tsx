'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Plus, Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { JobsTable } from '@/components/civil/JobsTable';
import { DownloadButton, DownloadDialog } from '@/components/civil/DownloadDialog';
import { StatusActionDialog } from '@/components/civil/StatusActionDialog';
import { apiError } from '@/components/civil/format';
import type {
  CivilBranchOption, CivilCity, CivilCompany, CivilJobRow, CivilManager,
} from '@/components/civil/types';
import type { CivilJobStatus, CivilStatusChangeInput } from '@/types/civil';

/* ── Filters ─────────────────────────────────────────────────────────────────── */

const FILTER_KEYS = ['q', 'status', 'companyId', 'cityId', 'branchId', 'managerId', 'month'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

const STATUS_CHIPS: { value: '' | CivilJobStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'billed', label: 'Billed' },
  { value: 'paid', label: 'Paid' },
];

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k]) p.set(k, f[k]);
  return p.toString();
}

interface BulkResult { updated: number; skipped: { jobNo: number; reason: string }[] }

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function CivilJobsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="skeleton h-8 w-40 rounded" /></div>}>
      <JobsView />
    </Suspense>
  );
}

function JobsView() {
  const router = useRouter();
  const params = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() =>
    Object.fromEntries(FILTER_KEYS.map(k => [k, params.get(k) ?? ''])) as Filters,
  );
  const [searchText, setSearchText] = useState(filters.q);

  const [jobs, setJobs] = useState<CivilJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CivilCompany[]>([]);
  const [cities, setCities] = useState<CivilCity[]>([]);
  const [branches, setBranches] = useState<CivilBranchOption[]>([]);
  const [managers, setManagers] = useState<CivilManager[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<CivilJobStatus | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  const query = toQuery(filters);

  /* ── Load ───────────────────────────────────────────────────────────────────── */

  useEffect(() => {
    void Promise.all([
      fetch('/api/v1/civil/companies').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/cities').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/branches').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/managers').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([co, ci, br, mg]: { data?: unknown[] }[]) => {
      setCompanies((co.data ?? []) as CivilCompany[]);
      setCities((ci.data ?? []) as CivilCity[]);
      setBranches((br.data ?? []) as CivilBranchOption[]);
      setManagers((mg.data ?? []) as CivilManager[]);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch(`/api/v1/civil/jobs${query ? `?${query}` : ''}`);
      if (!res.ok) { setLoadError(await apiError(res, 'Could not load jobs.')); setJobs([]); return; }
      const json = await res.json() as { data?: CivilJobRow[] };
      const rows = json.data ?? [];
      setJobs(rows);
      // Drop selections that are no longer on screen.
      const ids = new Set(rows.map(j => j.id));
      setSelected(prev => {
        const next = new Set([...prev].filter(id => ids.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      setLoadError('Network error.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  // Keep the URL in step with the filters so a filtered view can be shared or reloaded.
  useEffect(() => {
    router.replace(`/civil/jobs${query ? `?${query}` : ''}`, { scroll: false });
  }, [query, router]);

  // Debounced search box → q
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => (f.q === searchText.trim() ? f : { ...f, q: searchText.trim() }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchText]);

  /* ── Derived ────────────────────────────────────────────────────────────────── */

  const branchOptions = useMemo(
    () => (filters.companyId ? branches.filter(b => b.companyId === filters.companyId) : branches),
    [branches, filters.companyId],
  );

  const selectedJobs = useMemo(() => jobs.filter(j => selected.has(j.id)), [jobs, selected]);
  const selectedSum = selectedJobs.reduce((s, j) => s + Number(j.totalPaise), 0);
  const hasFilters = FILTER_KEYS.some(k => filters[k]);

  /* ── Handlers ───────────────────────────────────────────────────────────────── */

  function setFilter(key: FilterKey, value: string) {
    setFilters(f => {
      const next = { ...f, [key]: value };
      // A branch belongs to one company; changing the company invalidates it.
      if (key === 'companyId' && value && f.branchId && !branches.some(b => b.id === f.branchId && b.companyId === value)) {
        next.branchId = '';
      }
      return next;
    });
  }

  function clearFilters() {
    setSearchText('');
    setFilters(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])) as Filters);
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => (jobs.length > 0 && jobs.every(j => prev.has(j.id)) ? new Set() : new Set(jobs.map(j => j.id))));
  }

  async function runBulk(change: CivilStatusChangeInput): Promise<string | null> {
    try {
      const res = await fetch('/api/v1/civil/jobs/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: [...selected], change }),
      });
      if (!res.ok) return await apiError(res, 'Could not update the jobs.');
      const { data } = await res.json() as { data: BulkResult };
      const skippedText = data.skipped.length
        ? ` (${data.skipped.slice(0, 3).map(s => `#${s.jobNo}: ${s.reason}`).join('; ')}${data.skipped.length > 3 ? '…' : ''})`
        : '';
      setNotice({
        kind: data.skipped.length ? 'warn' : 'ok',
        text: `Updated ${data.updated}, skipped ${data.skipped.length}${skippedText}`,
      });
      setSelected(new Set());
      void load();
      return null;
    } catch {
      return 'Network error.';
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────────── */

  const n = selected.size;

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>All Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${jobs.length} job${jobs.length !== 1 ? 's' : ''}${hasFilters ? ' matching filters' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadButton onClick={() => setDownloadOpen(true)} />
          <Link href="/civil/jobs/new" className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.25} />New job
          </Link>
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm"
          style={notice.kind === 'ok'
            ? { background: 'var(--success-soft)', color: 'var(--success-text)' }
            : { background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
          {notice.kind === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        {/* Filter bar */}
        <div className="space-y-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="Search work, line, bill no, S.No…"
                className="studio-input w-full text-sm h-9" style={{ paddingLeft: '2.25rem' }} />
              {searchText && (
                <button type="button" onClick={() => setSearchText('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}
            </div>
            <FilterSelect label="Company" value={filters.companyId} onChange={v => setFilter('companyId', v)}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FilterSelect label="City" value={filters.cityId} onChange={v => setFilter('cityId', v)}
              options={cities.map(c => ({ value: c.id, label: c.name }))} />
            <FilterSelect label="Branch" value={filters.branchId} onChange={v => setFilter('branchId', v)}
              options={branchOptions.map(b => ({
                value: b.id,
                label: filters.companyId ? `${b.name} · ${b.cityName}` : `${b.companyName} ${b.name}`,
              }))} />
            <FilterSelect label="Manager" value={filters.managerId} onChange={v => setFilter('managerId', v)}
              options={managers.map(m => ({ value: m.id, label: m.name }))} />
            <input type="month" value={filters.month} onChange={e => setFilter('month', e.target.value)}
              aria-label="Month" className="studio-input h-9 text-sm" />
            {hasFilters && (
              <button type="button" onClick={clearFilters}
                className="text-xs font-medium px-2 py-1 rounded-lg hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}>
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map(c => {
              const on = filters.status === c.value;
              return (
                <button key={c.label} type="button" onClick={() => setFilter('status', c.value)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={on
                    ? { background: 'var(--accent-base)', color: '#fff', border: '1px solid var(--accent-base)' }
                    : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {loadError ? (
          <div className="m-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{loadError}
          </div>
        ) : loading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-4 w-10 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-48 rounded" />
                  <div className="skeleton h-3 w-28 rounded" />
                </div>
                <div className="skeleton h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              {hasFilters ? 'No jobs match these filters.' : 'No jobs yet.'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary px-4 py-2 text-sm">Clear filters</button>
            ) : (
              <Link href="/civil/jobs/new" className="btn-secondary px-4 py-2 text-sm">Add first job</Link>
            )}
          </div>
        ) : (
          <JobsTable jobs={jobs} selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} onStatusChanged={() => void load()} />
        )}
      </div>

      {/* Bulk action bar */}
      {n > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 shadow-lg"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-strong)' }}>
          <span className="mr-auto text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
            {n} selected · <span className="tabular-nums">{formatRupees(selectedSum)}</span>
          </span>
          <button type="button" onClick={() => setAction('billed')} className="btn-secondary px-3 py-2 text-sm">Mark Billed…</button>
          <button type="button" onClick={() => setAction('paid')} className="btn-primary px-3 py-2 text-sm">Mark Paid…</button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="px-2 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Clear
          </button>
        </div>
      )}

      <DownloadDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        title={[
          companies.find(c => c.id === filters.companyId)?.name,
          branches.find(b => b.id === filters.branchId)?.name,
          cities.find(c => c.id === filters.cityId)?.name,
          managers.find(m => m.id === filters.managerId)?.name,
          filters.q ? `“${filters.q}”` : null,
        ].filter(Boolean).join(' · ') || 'All companies and branches'}
        filters={{
          companyId: filters.companyId, cityId: filters.cityId, branchId: filters.branchId,
          managerId: filters.managerId, q: filters.q,
        }}
      />

      <StatusActionDialog
        to={action}
        subject={`${n} job${n !== 1 ? 's' : ''}`}
        bulk
        onClose={() => setAction(null)}
        onConfirm={runBulk}
      />
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="studio-input h-9 text-sm max-w-[180px]">
      <option value="">{label}: All</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
