'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, X, Building2, Clock, CheckCircle2, Receipt, Wallet, UsersRound, TrendingUp,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { formatRupees } from '@/lib/utils';
import { CompanyDialog } from '@/components/civil/CompanyDialog';
import { ManagersDialog } from '@/components/civil/ManagersDialog';
import type { CivilCompany, CivilSummary } from '@/components/civil/types';
import { useUser } from '@/components/providers/user-provider';
import { monthBounds } from '@/components/civil/PeriodPicker';
import { todayIso } from '@/components/civil/format';

export default function CivilHomePage() {
  const router = useRouter();
  const { isAdmin } = useUser();
  // Owner-only: this month's profit (billed − real cost of finished jobs).
  const [profit, setProfit] = useState<{ profitPaise: number; marginPct: number | null; jobsMissingCosts: number } | null>(null);

  const [companies, setCompanies] = useState<CivilCompany[]>([]);
  const [summary,   setSummary]   = useState<CivilSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [addOpen,      setAddOpen]      = useState(false);
  const [managersOpen, setManagersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/v1/civil/companies').then(r => r.json()) as Promise<{ data?: CivilCompany[] }>,
        fetch('/api/v1/civil/summary').then(r => r.json()) as Promise<{ data?: CivilSummary }>,
      ]);
      setCompanies(cRes.data ?? []);
      setSummary(sRes.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    const { from, to } = monthBounds(todayIso().slice(0, 7));
    fetch(`/api/v1/civil/profit?from=${from}&to=${to}`)
      .then(r => (r.ok ? r.json() : null))
      .then((j: { data?: { totals: { profitPaise: number; marginPct: number | null; jobsMissingCosts: number } } } | null) => {
        if (j?.data) setProfit(j.data.totals);
      })
      .catch(() => undefined);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.gstin ?? '').toLowerCase().includes(q) ||
      c.cities.some(city => city.toLowerCase().includes(q)),
    );
  }, [companies, search]);

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Civil Management</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Maintenance contracts — companies, their branches and every job done for them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setManagersOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <UsersRound className="h-4 w-4" />Managers
          </button>
          <button type="button" onClick={() => setAddOpen(true)}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.25} />Company
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-3 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <StatCard label="Jobs this month" icon={Clock}
          value={loading ? '—' : summary?.monthCount ?? 0}
          sub={summary && summary.monthPaise > 0 ? `${formatRupees(summary.monthPaise)} of work` : 'No jobs entered yet'} />
        <StatCard label="Done, not billed" icon={CheckCircle2}
          value={loading ? '—' : formatRupees(summary?.donePaise ?? 0)}
          sub={`${summary?.doneCount ?? 0} job${summary?.doneCount === 1 ? '' : 's'} to bill`} />
        <StatCard label="Billed, unpaid" icon={Receipt} accent
          value={loading ? '—' : formatRupees(summary?.billedPaise ?? 0)}
          sub={`${summary?.billedCount ?? 0} bill${summary?.billedCount === 1 ? '' : 's'} awaiting payment`} />
        <StatCard label="Paid this month" icon={Wallet}
          value={loading ? '—' : formatRupees(summary?.paidThisMonthPaise ?? 0)}
          sub="Payments received" />
        {isAdmin && (
          <Link href="/civil/profit" className="block transition-opacity hover:opacity-90" title="Only you can see this">
            <StatCard label="Profit this month" icon={TrendingUp}
              value={!profit ? '—' : (
                <span style={{ color: profit.profitPaise < 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                  {formatRupees(profit.profitPaise)}
                </span>
              )}
              sub={!profit ? 'Only you can see this'
                : profit.jobsMissingCosts > 0 ? `${profit.jobsMissingCosts} job${profit.jobsMissingCosts !== 1 ? 's' : ''} missing costs`
                : profit.marginPct === null ? 'No jobs yet this month' : `${profit.marginPct}% margin · only you see this`} />
          </Link>
        )}
      </div>

      {/* Search + table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search company or city…"
              className="studio-input w-full text-sm h-9" style={{ paddingLeft: '2.25rem' }} />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-40 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
            <Building2 className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              {search ? 'No companies match your search.' : 'No companies yet.'}
            </p>
            {!search && (
              <>
                <button type="button" onClick={() => setAddOpen(true)} className="btn-secondary px-4 py-2 text-sm">
                  Add first company
                </button>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Have the old Excel sheet?{' '}
                  <Link href="/civil/import" className="font-semibold underline" style={{ color: 'var(--accent-base)' }}>
                    Import it
                  </Link>{' '}
                  — companies, branches and jobs are created for you.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Company', 'Cities', 'Branches', 'Jobs', 'Done, not billed', 'Unpaid'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr key={c.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      borderLeft: '3px solid var(--accent-base)',
                    }}
                    onClick={() => router.push(`/civil/companies/${c.id}`)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--accent-base)' }}>{c.name}</p>
                          {c.gstin && <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.gstin}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {c.cities.length ? c.cities.join(', ') : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{c.branchCount}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {c.jobCount > 0
                        ? <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{c.jobCount}</span>
                        : <span style={{ color: 'var(--text-tertiary)' }}>0</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {c.donePaise > 0 ? formatRupees(c.donePaise) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>
                      {c.billedPaise > 0 ? formatRupees(c.billedPaise) : <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2 text-xs"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
              {filtered.length} compan{filtered.length !== 1 ? 'ies' : 'y'}
              {search && ` matching "${search}"`}
            </div>
          </div>
        )}
      </div>

      <CompanyDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => void load()} />
      <ManagersDialog open={managersOpen} onClose={() => setManagersOpen(false)} />
    </div>
  );
}
