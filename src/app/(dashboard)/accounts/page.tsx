'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowUpRight, Download, FileSpreadsheet, IndianRupee, Search, TrendingUp,
  Wallet, Loader2, Zap, HandCoins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRupees } from '@/lib/utils';

type Tab = 'receivables' | 'payments';

interface ReceivableRow {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue';
  createdAt: string;
  daysSinceCreation: number;
}

interface PaymentRow {
  id: string;
  invoiceId: string;
  projectId: string | null;
  projectName: string | null;
  invoiceNumber: string | null;
  amountPaise: number;
  status: string;
  source: 'razorpay' | 'manual';
  reference: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

interface OverviewPayload {
  kpis: {
    outstandingPaise: number;
    overduePaise: number;
    openReceivableCount: number;
    collected30dPaise: number;
    collected30dCount: number;
    collectedAllTimePaise: number;
    collectedAllTimeCount: number;
  };
  receivables: ReceivableRow[];
  payments: PaymentRow[];
}

const STATUS_BADGE: Record<ReceivableRow['paymentStatus'], string> = {
  pending:   'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
  link_sent: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  overdue:   'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300',
};

export default function AccountsPage() {
  const [data, setData]           = useState<OverviewPayload | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('receivables');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStat]   = useState<ReceivableRow['paymentStatus'] | 'all'>('all');
  const [exportError, setExErr]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/accounts/overview')
      .then((r) => r.json())
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredReceivables = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.receivables.filter((r) => {
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return r.projectName.toLowerCase().includes(q) || r.label.toLowerCase().includes(q);
    });
  }, [data, search, statusFilter]);

  const filteredPayments = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.payments;
    return data.payments.filter((p) =>
      (p.projectName ?? '').toLowerCase().includes(q) ||
      (p.invoiceNumber ?? '').toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  async function downloadExport(url: string, filename: string) {
    setExErr(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      setExErr('Export failed — please try again.');
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-sm text-red-600">Failed to load accounts.</div>;
  }

  const k = data.kpis;
  const receivableCount = data.receivables.length;
  const paymentCount    = data.payments.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>Accounts &amp; Payments</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Receivables · captured payments · Tally exports — all in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport('/api/v1/accounts/tally-export', 'tally-export.csv')}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Tally CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport('/api/v1/accounts/tally-xml-push', 'tally-vouchers.xml')}
            className="gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" /> Tally XML
          </Button>
        </div>
      </header>

      {exportError && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {exportError}
        </div>
      )}

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 border-b border-slate-200 p-6 dark:border-slate-800 md:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Outstanding"
          value={formatRupees(k.outstandingPaise)}
          sub={`${k.openReceivableCount} milestone${k.openReceivableCount === 1 ? '' : 's'} to collect`}
          accent="amber"
        />
        <Kpi
          icon={AlertCircle}
          label="Overdue"
          value={formatRupees(k.overduePaise)}
          sub={k.overduePaise > 0 ? 'Needs follow-up' : 'None overdue'}
          accent={k.overduePaise > 0 ? 'red' : 'slate'}
        />
        <Kpi
          icon={TrendingUp}
          label="Collected · 30 days"
          value={formatRupees(k.collected30dPaise)}
          sub={`${k.collected30dCount} payment${k.collected30dCount === 1 ? '' : 's'} in period`}
          accent="emerald"
        />
        <Kpi
          icon={HandCoins}
          label="Collected · all time"
          value={formatRupees(k.collectedAllTimePaise)}
          sub={`${k.collectedAllTimeCount} total transactions`}
          accent="blue"
        />
      </section>

      {/* Tabs + search + filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
          <TabButton
            active={tab === 'receivables'}
            onClick={() => setTab('receivables')}
            label="Receivables"
            count={receivableCount}
          />
          <TabButton
            active={tab === 'payments'}
            onClick={() => setTab('payments')}
            label="Payments received"
            count={paymentCount}
          />
        </div>

        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={tab === 'receivables' ? 'Search project or milestone…' : 'Search project, invoice or reference…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {tab === 'receivables' && (
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            {(['all', 'pending', 'link_sent', 'overdue'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStat(s)}
                className={
                  'rounded px-2.5 py-1 font-medium capitalize ' +
                  (statusFilter === s
                    ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                {s === 'all' ? 'All' : s === 'link_sent' ? 'Link sent' : s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'receivables'
          ? <ReceivablesTable rows={filteredReceivables} />
          : <PaymentsTable rows={filteredPayments} />}
      </div>
    </div>
  );
}

// ─── KPI ────────────────────────────────────────────────────────────────────────

function Kpi({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: 'amber' | 'red' | 'emerald' | 'blue' | 'slate';
}) {
  const bg = {
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    red:     'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    blue:    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    slate:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-4 shadow-sm dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <span className={'flex h-8 w-8 items-center justify-center rounded-lg ' + bg}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded px-3 py-1 font-medium ' +
        (active
          ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {label}
      <span className={'rounded-full px-1.5 text-[10px] font-bold ' + (active ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-800')}>
        {count}
      </span>
    </button>
  );
}

// ─── Receivables table ────────────────────────────────────────────────────────

function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
          <IndianRupee className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>All caught up</h2>
        <p className="mt-1 text-sm text-slate-500">No outstanding milestones match your filters.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--surface-card)] shadow-sm dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Project</th>
            <th className="px-3 py-3 text-left font-semibold">Milestone</th>
            <th className="px-3 py-3 text-right font-semibold">Amount</th>
            <th className="px-3 py-3 text-left font-semibold">Status</th>
            <th className="px-3 py-3 text-right font-semibold">Age</th>
            <th className="w-24 px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-900">
              <td className="px-4 py-2.5">
                <Link
                  href={`/projects/${r.projectId}/payments`}
                  className="font-medium hover:text-emerald-600"
                  style={{ color: 'var(--text-heading)' }}
                >
                  {r.projectName}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{r.label}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(r.amountPaise)}
              </td>
              <td className="px-3 py-2.5">
                <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ' + STATUS_BADGE[r.paymentStatus]}>
                  {r.paymentStatus.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">
                {r.daysSinceCreation}d
              </td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  href={`/projects/${r.projectId}/payments`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Manage <ArrowUpRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Payments table ───────────────────────────────────────────────────────────

const PAY_STATUS_STYLES: Record<string, string> = {
  captured:  'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  pending:   'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  failed:    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300',
  refunded:  'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300',
};

function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
          <IndianRupee className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No payments recorded yet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Payments show up here as clients pay via Razorpay links or you record manual entries against an invoice.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--surface-card)] shadow-sm dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Date</th>
            <th className="px-3 py-3 text-left font-semibold">Project</th>
            <th className="px-3 py-3 text-left font-semibold">Invoice</th>
            <th className="px-3 py-3 text-right font-semibold">Amount</th>
            <th className="px-3 py-3 text-left font-semibold">Status</th>
            <th className="px-3 py-3 text-left font-semibold">Source</th>
            <th className="px-3 py-3 text-left font-semibold">Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-900">
              <td className="px-4 py-2.5 tabular-nums text-slate-500">
                {new Date(p.reconciledAt ?? p.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </td>
              <td className="px-3 py-2.5">
                {p.projectId && p.projectName ? (
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="font-medium hover:text-emerald-600"
                    style={{ color: 'var(--text-heading)' }}
                  >
                    {p.projectName}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {p.invoiceNumber ? (
                  <Link
                    href={`/invoices/${p.invoiceId}`}
                    className="font-mono text-xs text-slate-700 hover:text-emerald-600 dark:text-slate-300"
                  >
                    {p.invoiceNumber}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(p.amountPaise)}
              </td>
              <td className="px-3 py-2.5">
                <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ' + (PAY_STATUS_STYLES[p.status] ?? PAY_STATUS_STYLES.pending)}>
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  {p.source === 'razorpay' ? <Zap className="h-3 w-3 text-blue-500" /> : <HandCoins className="h-3 w-3 text-slate-400" />}
                  {p.source === 'razorpay' ? 'Razorpay' : 'Manual'}
                </span>
              </td>
              <td className="px-3 py-2.5 truncate font-mono text-xs text-slate-500" style={{ maxWidth: 220 }}>
                {p.reference ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
