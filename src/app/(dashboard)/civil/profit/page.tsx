'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Lock, TrendingUp, Wallet, Receipt, Percent } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { formatRupees } from '@/lib/utils';
import { useUser } from '@/components/providers/user-provider';
import { PeriodPicker, usePeriod } from '@/components/civil/PeriodPicker';
import { CivilStatusBadge } from '@/components/civil/CivilStatusBadge';
import { profitColor } from '@/components/civil/JobProfitPanel';
import { dmy } from '@/components/civil/format';
import type { CivilBranchOption, CivilCompany } from '@/components/civil/types';
import type { CivilJobStatus } from '@/types/civil';

/* ── Types (GET /api/v1/civil/profit) ───────────────────────────────────────── */

interface Money { jobs: number; billedPaise: number; costPaise: number; profitPaise: number; marginPct: number | null }
interface ProfitReport {
  totals: Money & { jobsMissingCosts: number };
  byCompany: (Money & { companyId: string; companyName: string })[];
  byBranch: (Money & { branchId: string; branchName: string; companyName: string; cityName: string })[];
  jobs: (Money & {
    id: string; jobNo: number; jobDate: string; heading: string; status: CivilJobStatus;
    branchName: string; companyName: string; missingCosts: boolean;
  })[];
}

type Sort = 'low' | 'high' | 'new';
const STATUS_CHOICES: { key: '' | CivilJobStatus; label: string }[] = [
  { key: '', label: 'All jobs' }, { key: 'done', label: 'Done' },
  { key: 'billed', label: 'Billed' }, { key: 'paid', label: 'Paid' },
];

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function CivilProfitPage() {
  const router = useRouter();
  const { isAdmin, roleLoaded } = useUser();
  const periodState = usePeriod();
  const { range } = periodState;

  const [companies, setCompanies] = useState<CivilCompany[]>([]);
  const [branches, setBranches] = useState<CivilBranchOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState<'' | CivilJobStatus>('');
  const [sort, setSort] = useState<Sort>('low');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [report, setReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    void Promise.all([
      fetch('/api/v1/civil/companies').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/branches').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([co, br]: { data?: unknown[] }[]) => {
      setCompanies((co.data ?? []) as CivilCompany[]);
      setBranches((br.data ?? []) as CivilBranchOption[]);
    });
  }, [isAdmin]);

  const query = useMemo(() => {
    if (!range) return null;
    const p = new URLSearchParams({ from: range.from, to: range.to });
    if (companyId) p.set('companyId', companyId);
    if (branchId) p.set('branchId', branchId);
    if (status) p.set('status', status);
    return p.toString();
  }, [range, companyId, branchId, status]);

  useEffect(() => {
    if (!isAdmin || !query) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/civil/profit?${query}`)
        .then(r => r.json())
        .then((j: { data?: ProfitReport }) => { if (!cancelled) setReport(j.data ?? null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isAdmin, query]);

  const jobs = useMemo(() => {
    const list = (report?.jobs ?? []).filter(j => !onlyMissing || j.missingCosts);
    const sorted = [...list];
    if (sort === 'low') sorted.sort((a, b) => a.profitPaise - b.profitPaise);
    if (sort === 'high') sorted.sort((a, b) => b.profitPaise - a.profitPaise);
    if (sort === 'new') sorted.sort((a, b) => b.jobDate.localeCompare(a.jobDate) || b.jobNo - a.jobNo);
    return sorted;
  }, [report, sort, onlyMissing]);

  if (roleLoaded && !isAdmin) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Profit</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Only the owner can see profit.</p>
        <Link href="/civil" className="btn-secondary inline-flex px-4 py-2 text-sm">Back to Civil Management</Link>
      </div>
    );
  }

  const t = report?.totals;
  const branchOptions = branches.filter(b => !companyId || b.companyId === companyId);

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Profit</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Lock className="h-3.5 w-3.5" />What you billed minus what the work really cost. Only you can see this page.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border p-4 space-y-3"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <PeriodPicker state={periodState} columns={6} />
        <div className="flex flex-wrap items-center gap-2">
          <select value={companyId} onChange={e => { setCompanyId(e.target.value); setBranchId(''); }}
            className="studio-input h-9 text-sm">
            <option value="">All companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="studio-input h-9 text-sm">
            <option value="">All branches</option>
            {branchOptions.map(b => <option key={b.id} value={b.id}>{b.companyName} · {b.name}</option>)}
          </select>
          <span className="mx-1 h-5 w-px" style={{ background: 'var(--border-strong)' }} />
          {STATUS_CHOICES.map(s => {
            const on = status === s.key;
            return (
              <button key={s.key || 'all'} type="button" onClick={() => setStatus(s.key)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={on
                  ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                  : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Billed to clients" icon={Receipt}
          value={loading || !t ? '…' : formatRupees(t.billedPaise)} sub={t ? `${t.jobs} job${t.jobs !== 1 ? 's' : ''} · ${range?.label ?? ''}` : undefined} />
        <StatCard label="Real cost" icon={Wallet} value={loading || !t ? '…' : formatRupees(t.costPaise)} />
        <StatCard label="Profit" icon={TrendingUp} accent
          value={loading || !t ? '…' : <span style={{ color: profitColor(t.profitPaise) }}>{formatRupees(t.profitPaise)}</span>} />
        <StatCard label="Margin" icon={Percent}
          value={loading || !t ? '…' : t.marginPct === null ? '—' : <span style={{ color: profitColor(t.profitPaise) }}>{t.marginPct}%</span>} />
      </div>

      {t && t.jobsMissingCosts > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">
            <b>{t.jobsMissingCosts} job{t.jobsMissingCosts !== 1 ? 's' : ''}</b> still {t.jobsMissingCosts !== 1 ? 'have' : 'has'} lines
            without a real cost, so profit looks higher than it really is.
          </span>
          <button type="button" onClick={() => setOnlyMissing(v => !v)}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: 'var(--warning-text)', background: onlyMissing ? 'var(--warning-text)' : 'transparent', color: onlyMissing ? '#fff' : 'var(--warning-text)' }}>
            {onlyMissing ? 'Show all jobs' : 'Show only these'}
          </button>
        </div>
      )}

      {/* Breakdowns */}
      {report && report.jobs.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Breakdown title="By company" rows={report.byCompany.map(c => ({ key: c.companyId, name: c.companyName, sub: '', ...c }))}
            onPick={key => { setCompanyId(key); setBranchId(''); }} />
          <Breakdown title="By branch" rows={report.byBranch.map(b => ({ key: b.branchId, name: b.branchName, sub: `${b.companyName} · ${b.cityName}`, ...b }))}
            onPick={key => setBranchId(key)} />
        </div>
      )}

      {/* Jobs */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Jobs</span>
          <div className="flex items-center gap-1 text-xs">
            <span style={{ color: 'var(--text-tertiary)' }}>Sort:</span>
            {([['low', 'Lowest profit first'], ['high', 'Highest profit'], ['new', 'Newest']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSort(k)}
                className="rounded-full px-2.5 py-1 font-semibold transition-colors"
                style={sort === k
                  ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' }
                  : { color: 'var(--text-secondary)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-3.5 w-12 rounded" /><div className="skeleton h-3.5 flex-1 rounded" /><div className="skeleton h-3.5 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <TrendingUp className="h-9 w-9" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No jobs in {range?.label ?? 'this period'}.</p>
                      </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['S.No', 'Date', 'Branch', 'Work', 'Billed', 'Real cost', 'Profit', 'Margin', 'Status'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold tracking-wide ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, idx) => (
                  <tr key={j.id} onClick={() => router.push(`/civil/jobs/${j.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderBottom: idx < jobs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{j.jobNo}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{dmy(j.jobDate)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--accent-base)' }}>{j.branchName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.companyName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>{j.heading}</p>
                      {j.missingCosts && (
                        <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
                          Costs missing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(j.billedPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(j.costPaise)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: profitColor(j.profitPaise) }}>{formatRupees(j.profitPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: profitColor(j.profitPaise) }}>
                      {j.marginPct === null ? '—' : `${j.marginPct}%`}
                    </td>
                    <td className="px-4 py-3"><CivilStatusBadge status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Breakdown card ─────────────────────────────────────────────────────────── */

function Breakdown({ title, rows, onPick }: {
  title: string;
  rows: (Money & { key: string; name: string; sub: string })[];
  onPick: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.profitPaise)));
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="px-5 py-3 text-sm font-semibold" style={{ color: 'var(--text-heading)', borderBottom: '1px solid var(--border-subtle)' }}>
        {title}
      </div>
      <ul>
        {rows.map((r, i) => (
          <li key={r.key}>
            <button type="button" onClick={() => onPick(r.key)}
              className="w-full px-5 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{r.name}</span>
                  {r.sub && <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.sub}</span>}
                </span>
                <span className="flex-shrink-0 text-sm font-bold tabular-nums" style={{ color: profitColor(r.profitPaise) }}>
                  {formatRupees(r.profitPaise)}
                  <span className="ml-1.5 text-xs font-medium">{r.marginPct === null ? '' : `${r.marginPct}%`}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(Math.abs(r.profitPaise) / max) * 100}%`, background: r.profitPaise < 0 ? 'var(--danger)' : 'var(--accent-base)' }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                {r.jobs} job{r.jobs !== 1 ? 's' : ''} · billed {formatRupees(r.billedPaise)} · cost {formatRupees(r.costPaise)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
