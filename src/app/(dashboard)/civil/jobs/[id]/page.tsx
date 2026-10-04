'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, History, Pencil, Trash2, Undo2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { JobEditor } from '@/components/civil/JobEditor';
import { JobSheet } from '@/components/civil/JobSheet';
import { JobProfitPanel } from '@/components/civil/JobProfitPanel';
import { useUser } from '@/components/providers/user-provider';
import { CivilStatusBadge } from '@/components/civil/CivilStatusBadge';
import { StatusActionDialog } from '@/components/civil/StatusActionDialog';
import { apiError, dmy } from '@/components/civil/format';
import type { CivilJobDetail } from '@/components/civil/types';
import { STATUS_LABEL } from '@/lib/civil/status';
import type { CivilJobStatus, CivilStatusChangeInput } from '@/types/civil';

const ORDER: CivilJobStatus[] = ['done', 'billed', 'paid'];
const NEXT_LABEL: Partial<Record<CivilJobStatus, string>> = {
  done: 'Mark Billed…', billed: 'Mark Paid…',
};

export default function CivilJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useUser();

  const [job,      setJob]      = useState<CivilJobDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [target,   setTarget]   = useState<CivilJobStatus | null>(null);
  const [editing,  setEditing]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy,    setDeleteBusy]    = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/civil/jobs/${id}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    const json = (await res.json()) as { data?: CivilJobDetail };
    if (json.data) setJob(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(change: CivilStatusChangeInput): Promise<string | null> {
    const res = await fetch(`/api/v1/civil/jobs/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change),
    });
    if (!res.ok) return apiError(res, 'Could not change the status.');
    await load();
    return null;
  }

  async function handleDelete() {
    setDeleteBusy(true); setDeleteError(null);
    const res = await fetch(`/api/v1/civil/jobs/${id}`, { method: 'DELETE' });
    if (res.ok) { router.push('/civil/jobs'); return; }
    setDeleteError(await apiError(res, 'Could not delete the job.'));
    setDeleteBusy(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Job not found</h1>
        <Link href="/civil/jobs" className="btn-secondary inline-flex px-4 py-2 text-sm">Back to all jobs</Link>
      </div>
    );
  }

  const rank = ORDER.indexOf(job.status);
  const next = ORDER[rank + 1];
  const previous = rank > 0 ? ORDER[rank - 1] : null;
  const deletable = job.status === 'done';

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Link href="/civil" className="hover:underline">Civil</Link>
            {' › '}
            <Link href={`/civil/companies/${job.companyId}`} className="hover:underline">{job.companyName}</Link>
            {' › '}
            <Link href={`/civil/branches/${job.branchId}`} className="hover:underline">{job.branchName}</Link>
            {' › '}#{job.jobNo}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Job #{job.jobNo}</h1>
            <CivilStatusBadge status={job.status} />
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {job.companyName} ·{' '}
            <Link href={`/civil/branches/${job.branchId}`} className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
              {job.branchName}
            </Link>
            {' · '}{job.cityName}
            {job.billNo && <> · Bill {job.billNo} · {dmy(job.billDate)}</>}
            {job.paidDate && <> · Paid {dmy(job.paidDate)}</>}
          </p>
        </div>

        {editing ? (
          <span className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
            Editing — save or cancel below
          </span>
        ) : (
        <div className="flex flex-wrap items-center gap-2">
          {deletable && (
            <button type="button" onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
              className="rounded-xl p-2 transition-colors hover:bg-[var(--danger-soft)]" title="Delete job">
              <Trash2 className="h-4 w-4" style={{ color: 'var(--danger)' }} />
            </button>
          )}
          {previous && (
            <button type="button" onClick={() => setTarget(previous)} title={`Move back to ${STATUS_LABEL[previous]}`}
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2.5 text-sm">
              <Undo2 className="h-4 w-4" />Move back
            </button>
          )}
          <button type="button" onClick={() => setEditing(true)}
            className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm">
            <Pencil className="h-4 w-4" />Edit
          </button>
          {next && (
            <button type="button" onClick={() => setTarget(next)}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
              {NEXT_LABEL[job.status]}<ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        )}
      </div>

      {editing ? (
        <JobEditor
          key={`${job.id}-${job.status}`}
          job={job}
          onSaved={() => { setEditing(false); void load(); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <JobSheet job={job} />
          {isAdmin && <JobProfitPanel jobId={job.id} billedPaise={Number(job.totalPaise)} />}
        </>
      )}

      {/* History */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>History</span>
        </div>
        {job.events.length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>No status changes yet.</p>
        ) : (
          <ul>
            {job.events.map((e, i) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm"
                style={{ borderBottom: i < job.events.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="w-24 tabular-nums text-xs" style={{ color: 'var(--text-tertiary)' }}>{dmy(e.createdAt)}</span>
                <span className="flex items-center gap-1.5">
                  {e.fromStatus ? <CivilStatusBadge status={e.fromStatus} /> : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Created</span>}
                  <ArrowRight className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                  <CivilStatusBadge status={e.toStatus} />
                </span>
                {e.note && <span style={{ color: 'var(--text-secondary)' }}>{e.note}</span>}
                {e.byName && <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>by {e.byName}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <StatusActionDialog
        to={target}
        subject={`Job #${job.jobNo}`}
        billNo={job.billNo}
        billDate={job.billDate}
        clearsBilling={!!target && ORDER.indexOf(target) < rank && rank >= ORDER.indexOf('billed')}
        onClose={() => setTarget(null)}
        onConfirm={changeStatus}
      />

      <Dialog open={confirmDelete} onOpenChange={open => { if (!open && !deleteBusy) setConfirmDelete(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete job #{job.jobNo}?</DialogTitle></DialogHeader>
          <p className="text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{job.heading}</span> at {job.branchName} and
            all its lines will be removed. This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleteBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleteBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Deleting…' : 'Delete job'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
