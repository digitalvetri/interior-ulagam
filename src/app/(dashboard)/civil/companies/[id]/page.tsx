'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, ClipboardList, MapPin, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { CompanyDialog } from '@/components/civil/CompanyDialog';
import { BranchDialog } from '@/components/civil/BranchDialog';
import { DownloadButton, DownloadDialog } from '@/components/civil/DownloadDialog';
import { apiError } from '@/components/civil/format';
import type { CivilBranchCard, CivilCompanyDetail } from '@/components/civil/types';

export default function CivilCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [company,  setCompany]  = useState<CivilCompanyDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editOpen,     setEditOpen]     = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [branchOpen,   setBranchOpen]   = useState(false);
  const [branchTarget, setBranchTarget] = useState<CivilBranchCard | undefined>();
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleteBusy,   setDeleteBusy]   = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/civil/companies/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      const j = await res.json() as { data?: CivilCompanyDetail };
      setCompany(j.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const byCity = useMemo(() => {
    const groups = new Map<string, CivilBranchCard[]>();
    for (const b of company?.branches ?? []) {
      groups.set(b.cityName, [...(groups.get(b.cityName) ?? []), b]);
    }
    return [...groups.entries()];
  }, [company]);

  const totals = useMemo(() => (company?.branches ?? []).reduce(
    (t, b) => ({ jobs: t.jobs + b.jobCount, done: t.done + b.donePaise, billed: t.billed + b.billedPaise }),
    { jobs: 0, done: 0, billed: 0 },
  ), [company]);

  function openAddBranch() { setBranchTarget(undefined); setBranchOpen(true); }
  function openEditBranch(b: CivilBranchCard) { setBranchTarget(b); setBranchOpen(true); }

  async function handleDelete() {
    setDeleteBusy(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/civil/companies/${id}`, { method: 'DELETE' });
      if (!res.ok) { setDeleteError(await apiError(res, 'Failed to remove company.')); return; }
      router.push('/civil');
    } catch { setDeleteError('Network error.'); }
    finally { setDeleteBusy(false); }
  }

  if (notFound) {
    return (
      <div className="p-6 flex flex-col items-center gap-3 py-24 text-center">
        <Store className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Company not found.</p>
        <Link href="/civil" className="btn-secondary px-4 py-2 text-sm">Back to companies</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Link href="/civil" className="hover:underline">Civil</Link>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: 'var(--text-secondary)' }}>{company?.name ?? '…'}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {loading && !company ? (
            <div className="space-y-2">
              <div className="skeleton h-7 w-48 rounded" />
              <div className="skeleton h-3.5 w-64 rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{company?.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {company?.branches.length ?? 0} branch{company?.branches.length === 1 ? '' : 'es'}
                {totals.billed > 0 && ` · ${formatRupees(totals.billed)} unpaid`}
                {company?.gstin && ` · GSTIN ${company.gstin}`}
                {company?.contactPhone && ` · ${company.contactName ? `${company.contactName} ` : ''}${company.contactPhone}`}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {company && company.branches.length === 0 && (
            <button type="button" onClick={() => { setDeleteError(null); setDeleteOpen(true); }}
              className="btn-secondary inline-flex items-center gap-2 px-3 py-2.5 text-sm" title="Remove company">
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          )}
          <button type="button" onClick={() => setEditOpen(true)} disabled={!company}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Pencil className="h-3.5 w-3.5" />Edit company
          </button>
          <Link href={`/civil/jobs?companyId=${id}`}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <ClipboardList className="h-4 w-4" />View jobs
          </Link>
          <DownloadButton onClick={() => setDownloadOpen(true)} />
          <button type="button" onClick={openAddBranch} disabled={!company}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.25} />Branch
          </button>
        </div>
      </div>

      {/* Branches grouped by city */}
      {loading && !company ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : byCity.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center gap-3 py-16 text-center"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <MapPin className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No branches yet.</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Add each store you maintain — e.g. Singanallur, Coimbatore.
          </p>
          <button type="button" onClick={openAddBranch} className="btn-secondary px-4 py-2 text-sm">Add first branch</button>
        </div>
      ) : (
        <div className="space-y-6">
          {byCity.map(([city, branches]) => (
            <section key={city} className="space-y-2.5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>
                {city} · {branches.length}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {branches.map(b => (
                  <div key={b.id} role="link" tabIndex={0}
                    onClick={() => router.push(`/civil/branches/${b.id}`)}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/civil/branches/${b.id}`); }}
                    className="group relative cursor-pointer rounded-2xl border p-4 transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--accent-base)' }}>{b.name}</p>
                        <p className="truncate text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {b.contactName || b.contactPhone
                            ? [b.contactName, b.contactPhone].filter(Boolean).join(' · ')
                            : 'No contact added'}
                        </p>
                      </div>
                      <button type="button" title="Edit branch"
                        onClick={e => { e.stopPropagation(); openEditBranch(b); }}
                        className="rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] focus:opacity-100">
                        <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                      <span style={{ color: b.jobCount > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                        <span className="font-semibold">{b.jobCount}</span> job{b.jobCount !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: b.donePaise > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                        <span className="font-semibold">{formatRupees(b.donePaise)}</span> to bill
                      </span>
                      <span style={{ color: b.billedPaise > 0 ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                        <span className="font-semibold">{formatRupees(b.billedPaise)}</span> unpaid
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {company && (
        <>
          <DownloadDialog open={downloadOpen} onClose={() => setDownloadOpen(false)}
            title={`${company.name} · all branches`} filters={{ companyId: company.id }} />
          <CompanyDialog open={editOpen} company={company} onClose={() => setEditOpen(false)} onSaved={() => void load()} />
          <BranchDialog open={branchOpen} companyId={company.id} branch={branchTarget}
            onClose={() => setBranchOpen(false)} onSaved={() => void load()} />
        </>
      )}

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o && !deleteBusy) setDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Remove company?</DialogTitle></DialogHeader>
          <p className="text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{company?.name}</span> has no
            branches and will be removed.
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
              <Trash2 className="h-3.5 w-3.5" />{deleteBusy ? 'Removing…' : 'Remove company'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
