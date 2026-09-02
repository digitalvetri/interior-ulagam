'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowUpRight, FileSpreadsheet, IndianRupee, Search, TrendingUp,
  Wallet, Loader2, Zap, HandCoins, FileText, Calendar,
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

// ─── Tally date range presets ─────────────────────────────────────────────────
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function startOfPrevMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); }
function endOfPrevMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); }
function startOfFY(d: Date): Date {
  // Indian financial year — April 1 to March 31
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 3, 1));
}

export default function AccountsPage() {
  const [data, setData]           = useState<OverviewPayload | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('receivables');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStat]   = useState<ReceivableRow['paymentStatus'] | 'all'>('all');
  const [exportError, setExErr]   = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<string | null>(null);

  // Tally date range — default to current month
  const today = useMemo(() => new Date(), []);
  const [tallyFrom, setTallyFrom] = useState(isoDate(startOfMonth(today)));
  const [tallyTo, setTallyTo]     = useState(isoDate(today));

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

  async function downloadTally(kind: 'tally-sales-csv' | 'tally-sales-xml' | 'tally-receipts-csv' | 'tally-receipts-xml') {
    if (!tallyFrom || !tallyTo) {
      setExErr('Pick a date range first.');
      return;
    }
    if (tallyFrom > tallyTo) {
      setExErr('“From” date must be before “To” date.');
      return;
    }
    setBusyExport(kind);
    const ext = kind.endsWith('xml') ? 'xml' : 'csv';
    const type = kind.includes('sales') ? 'sales' : 'receipts';
    const filename = `tally_${type}_${tallyFrom}_to_${tallyTo}.${ext}`;
    try {
      await downloadExport(`/api/v1/exports/${kind}?from=${tallyFrom}&to=${tallyTo}`, filename);
    } finally {
      setBusyExport(null);
    }
  }

  function applyRangePreset(preset: 'this-month' | 'last-month' | 'fy') {
    const now = new Date();
    if (preset === 'this-month') {
      setTallyFrom(isoDate(startOfMonth(now)));
      setTallyTo(isoDate(now));
    } else if (preset === 'last-month') {
      setTallyFrom(isoDate(startOfPrevMonth(now)));
      setTallyTo(isoDate(endOfPrevMonth(now)));
    } else {
      setTallyFrom(isoDate(startOfFY(now)));
      setTallyTo(isoDate(now));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4 ">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>Accounts & Payments</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Receivables · captured payments · Tally exports
          </p>
        </div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          View all Invoices →
        </Link>
      </header>

      {exportError && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {exportError}
        </div>
      )}

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 border-b border-[var(--border-subtle)] p-6 md:grid-cols-4">
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

      {/* ── Tally export panel ────────────────────────────────────────── */}
      <section className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: 'var(--mint-mist)' }}
            >
              <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--forest)' }} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                Tally export
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Import sales &amp; receipt vouchers into Tally Prime. Party &amp; sales ledgers are created on first import.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {/* From / To */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>From</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="date"
                value={tallyFrom}
                onChange={(e) => setTallyFrom(e.target.value)}
                className="studio-input h-9 w-44 pl-8 tnum"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>To</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="date"
                value={tallyTo}
                onChange={(e) => setTallyTo(e.target.value)}
                className="studio-input h-9 w-44 pl-8 tnum"
              />
            </div>
          </div>

          {/* Presets */}
          <div className="flex gap-1.5 pb-0.5">
            <PresetButton onClick={() => applyRangePreset('this-month')}>This month</PresetButton>
            <PresetButton onClick={() => applyRangePreset('last-month')}>Last month</PresetButton>
            <PresetButton onClick={() => applyRangePreset('fy')}>FY-to-date</PresetButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Sales voucher exports */}
          <div className="premium-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Sales vouchers
                </h3>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Invoices raised in range. Customer Dr · Sales Cr · GST split.
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <ExportButton
                  busy={busyExport === 'tally-sales-csv'}
                  onClick={() => downloadTally('tally-sales-csv')}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="CSV"
                />
                <ExportButton
                  busy={busyExport === 'tally-sales-xml'}
                  onClick={() => downloadTally('tally-sales-xml')}
                  icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                  label="XML"
                />
              </div>
            </div>
          </div>

          {/* Receipt voucher exports */}
          <div className="premium-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Receipt vouchers
                </h3>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Payments captured in range. Bank Dr · Customer Cr.
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <ExportButton
                  busy={busyExport === 'tally-receipts-csv'}
                  onClick={() => downloadTally('tally-receipts-csv')}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="CSV"
                />
                <ExportButton
                  busy={busyExport === 'tally-receipts-xml'}
                  onClick={() => downloadTally('tally-receipts-xml')}
                  icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                  label="XML"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs + search + filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-3 ">
        <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 text-xs ">
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
          <Search className="studio-search-icon" />
          <Input
            placeholder={tab === 'receivables' ? 'Search project or milestone…' : 'Search project, invoice or reference…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-[48px]"
          />
        </div>

        {tab === 'receivables' && (
          <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 text-xs ">
            {(['all', 'pending', 'link_sent', 'overdue'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStat(s)}
                className={
                  'rounded px-2.5 py-1 font-medium capitalize ' +
                  (statusFilter === s
                    ? 'bg-[var(--surface-card)] text-white '
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
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
        {tab === 'receivables' && <ReceivablesTable rows={filteredReceivables} />}
        {tab === 'payments'    && <PaymentsTable rows={filteredPayments} />}
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
    slate:   'bg-[var(--surface-muted)] text-[var(--text-secondary)] ',
  }[accent];
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm ">
      <div className="mb-2 flex items-center justify-between">
        <span className={'flex h-8 w-8 items-center justify-center rounded-lg ' + bg}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{sub}</p>
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded px-3 py-1 font-medium ' +
        (active
          ? 'bg-[var(--surface-card)] text-white '
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
      }
    >
      {label}
      {count !== undefined && (
        <span className={'rounded-full px-1.5 text-[10px] font-bold ' + (active ? 'bg-white/20 text-white /20 ' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] ')}>
          {count}
        </span>
      )}
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
        <p className="mt-1 text-sm text-[var(--text-secondary)]">No outstanding milestones match your filters.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm ">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-secondary)] ">
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
            <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-b-0 ">
              <td className="px-4 py-2.5">
                <Link
                  href={`/projects/${r.projectId}/payments`}
                  className="font-medium hover:text-emerald-600"
                  style={{ color: 'var(--text-heading)' }}
                >
                  {r.projectName}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] ">{r.label}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(r.amountPaise)}
              </td>
              <td className="px-3 py-2.5">
                <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ' + STATUS_BADGE[r.paymentStatus]}>
                  {r.paymentStatus.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">
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
    </div>
  );
}

// ─── Payments table ───────────────────────────────────────────────────────────

const PAY_STATUS_STYLES: Record<string, string> = {
  captured:  'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  pending:   'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  failed:    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300',
  refunded:  'bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-1 ring-inset ring-slate-200 ',
};

function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-tertiary)] ">
          <IndianRupee className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No payments recorded yet</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Payments show up here as clients pay via Razorpay links or you record manual entries against an invoice.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm ">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-secondary)] ">
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
            <tr key={p.id} className="border-b border-[var(--border-subtle)] last:border-b-0 ">
              <td className="px-4 py-2.5 tabular-nums text-[var(--text-secondary)]">
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
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {p.invoiceNumber ? (
                  <Link
                    href={`/invoices/${p.invoiceId}`}
                    className="font-mono text-xs text-[var(--text-primary)] hover:text-emerald-600 "
                  >
                    {p.invoiceNumber}
                  </Link>
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
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
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] ">
                  {p.source === 'razorpay' ? <Zap className="h-3 w-3 text-blue-500" /> : <HandCoins className="h-3 w-3 text-[var(--text-tertiary)]" />}
                  {p.source === 'razorpay' ? 'Razorpay' : 'Manual'}
                </span>
              </td>
              <td className="px-3 py-2.5 truncate font-mono text-xs text-[var(--text-secondary)]" style={{ maxWidth: 220 }}>
                {p.reference ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
            </div>
    </div>
  );
}

// ─── Tally panel helpers ─────────────────────────────────────────────────────

function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-medium border transition-colors"
      style={{
        background: 'var(--surface-card)',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {children}
    </button>
  );
}

function ExportButton({ busy, onClick, icon, label }: {
  busy: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

