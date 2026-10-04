'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, ClipboardList, Clock, CheckCircle2, Pencil, Plus, Receipt, Store, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { StatCard } from '@/components/ui/StatCard';
import { formatRupees } from '@/lib/utils';
import { BranchDialog } from '@/components/civil/BranchDialog';
import { JobsTable } from '@/components/civil/JobsTable';
import { DownloadButton, DownloadDialog } from '@/components/civil/DownloadDialog';
import { apiError } from '@/components/civil/format';
import type { CivilBranchDetail, CivilJobRow } from '@/components/civil/types';
import type { CivilJobStatus } from '@/types/civil';

type Filter = 'all' | CivilJobStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
  { key: 'billed', label: 'Billed' },
  { key: 'paid', label: 'Paid' },
];

export default function CivilBranchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [branch,   setBranch]   = useState<CivilBranchDetail | null>(null);
  const [jobs,     setJobs]     = useState<CivilJobRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [filter,   setFilter]   = useState<Filter>('all');

  const [editOpen,    setEditOpen]    = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleteBusy,  setDeleteBusy]  = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, jRes] = await Promise.all([
        fetch(`/api/v1/civil/branches/${id}`),
        fetch(`/api/v1/civil/jobs?branchId=${id}`),
      ]);
      if (bRes.status === 404) { setNotFound(true); return; }
      const b = await bRes.json() as { data?: CivilBranchDetail };
      const j = await jRes.json() as { data?: CivilJobRow[] };
      setBranch(b.data ?? null);
      setJobs(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: jobs.length, done: 0, billed: 0, paid: 0 };
    for (const j of jobs) c[j.status]++;
    return c;
  }, [jobs]);

  const filtered = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter(j => j.status === filter)),
    [jobs, filter],
  );

  async function handleDelete() {
    setDeleteBusy(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/civil/branches/${id}`, { method: 'DELETE' });
      if (!res.ok) { setDeleteError(await apiError(res, 'Failed to remove branch.')); return; }
      router.push(branch ? `/civil/companies/${branch.companyId}` : '/civil');
    } catch { setDeleteError('Network error.'); }
    finally { setDeleteBusy(false); }
  }

  if (notFound) {
    return (
      <div className="p-6 flex flex-col items-center gap-3 py-24 text-center">
        <Store className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Branch not found.</p>
        <Link href="/civil" className="btn-secondary px-4 py-2 text-sm">Back to companies</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Link href="/civil" className="hover:underline">Civil</Link>
        <ChevronRight className="h-3 w-3" />
        {branch ? (
          <Link href={`/civil/companies/${branch.companyId}`} className="hover:underline">{branch.companyName}</Link>
        ) : <span>…</span>}
        <ChevronRight className="h-3 w-3" />
        <span>{branch?.cityName ?? '…'}</span>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: 'var(--text-secondary)' }}>{branch?.name ?? '…'}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {loading && !branch ? (
            <div className="space-y-2">
              <div className="skeleton h-7 w-56 rounded" />
              <div className="skeleton h-3.5 w-40 rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                {branch?.companyName} {branch?.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {branch?.cityName}
                {(branch?.contactName || branch?.contactPhone) &&
                  ` · Contact: ${[branch.contactName, branch.contactPhone].filter(Boolean).join(' ')}`}
                {branch?.address && ` · ${branch.address}`}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branch && jobs.length === 0 && !loading && (
            <button type="button" onClick={() => { setDeleteError(null); setDeleteOpen(true); }}
              className="btn-secondary inline-flex items-center gap-2 px-3 py-2.5 text-sm" title="Remove branch">
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          )}
          <button type="button" onClick={() => setEditOpen(true)} disabled={!branch}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Pencil className="h-3.5 w-3.5" />Edit
          </button>
          <DownloadButton onClick={() => setDownloadOpen(true)} />
          <Link href={`/civil/jobs/new?branchId=${id}`}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.25} />New job
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Jobs" icon={Clock} value={loading && !branch ? '—' : branch?.jobCount ?? 0} sub="All time at this branch" />
        <StatCard label="Done, not billed" icon={CheckCircle2}
          value={loading && !branch ? '—' : formatRupees(branch?.donePaise ?? 0)} />
        <StatCard label="Billed, unpaid" icon={Receipt} accent
          value={loading && !branch ? '—' : formatRupees(branch?.billedPaise ?? 0)} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: active ? 'var(--accent-base)' : 'var(--surface-card)',
                borderColor: active ? 'var(--accent-base)' : 'var(--border-strong)',
                color: active ? '#fff' : 'var(--text-secondary)',
              }}>
              {f.label} <span className="tabular-nums opacity-80">{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Jobs */}
      {loading && jobs.length === 0 ? (
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-4 w-10 rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-48 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center gap-3 py-16 text-center"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <ClipboardList className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
            {filter === 'all' ? 'No jobs at this branch yet.' : `No ${filter} jobs.`}
          </p>
          {filter === 'all' && (
            <Link href={`/civil/jobs/new?branchId=${id}`} className="btn-secondary px-4 py-2 text-sm">Add first job</Link>
          )}
        </div>
      ) : (
        <JobsTable jobs={filtered} showBranch={false} onStatusChanged={() => void load()} />
      )}

      {branch && (
        <DownloadDialog open={downloadOpen} onClose={() => setDownloadOpen(false)}
          title={`${branch.companyName} ${branch.name} · ${branch.cityName}`} filters={{ branchId: id }} />
      )}

      {branch && (
        <BranchDialog open={editOpen} companyId={branch.companyId} branch={branch}
          onClose={() => setEditOpen(false)} onSaved={() => void load()} />
      )}

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o && !deleteBusy) setDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Remove branch?</DialogTitle></DialogHeader>
          <p className="text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{branch?.companyName} {branch?.name}</span> has
            no jobs and will be removed.
          </p>
          {deleteError && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{deleteError}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleteBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleteBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Removing…' : 'Remove branch'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
