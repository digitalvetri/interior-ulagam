'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowUpRight, ChevronDown, FileSpreadsheet,
  IndianRupee, Search, TrendingUp, Wallet, Loader2, Zap, HandCoins,
  FileText, Receipt,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';

type ActiveFilter = 'all' | 'pending' | 'link_sent' | 'overdue' | 'received';

interface ReceivableRow {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
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

const STATUS_CONFIG: Record<ReceivableRow['paymentStatus'], { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  link_sent: { label: 'Link sent', bg: '#FEF9C3',              color: '#92400E' },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',   color: 'var(--danger)' },
};

// ─── Tally date range helpers ──────────────────────────────────────────────────
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function startOfPrevMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); }
function endOfPrevMonth(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); }
function startOfFY(d: Date): Date {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 3, 1));
}

export default function AccountsPage() {
  const [data, setData]             = useState<OverviewPayload | null>(null);
  const [loading, setLoading]       = useState(true);
  const [activeFilter, setFilter]   = useState<ActiveFilter>('all');
  const [search, setSearch]         = useState('');
  const [tallyOpen, setTallyOpen]   = useState(false);
  const [exportError, setExErr]     = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<string | null>(null);

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
      if (activeFilter !== 'all' && activeFilter !== 'received' && r.paymentStatus !== activeFilter) return false;
      if (!q) return true;
      return (
        r.projectName.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        (r.clientName ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, activeFilter]);

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
    if (!tallyFrom || !tallyTo) { setExErr('Pick a date range first.'); return; }
    if (tallyFrom > tallyTo)   { setExErr('"From" date must be before "To" date.'); return; }
    setBusyExport(kind);
    const ext  = kind.endsWith('xml') ? 'xml' : 'csv';
    const type = kind.includes('sales') ? 'sales' : 'receipts';
    try {
      await downloadExport(
        `/api/v1/exports/${kind}?from=${tallyFrom}&to=${tallyTo}`,
        `tally_${type}_${tallyFrom}_to_${tallyTo}.${ext}`,
      );
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
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-sm text-red-600">Failed to load accounts.</div>;
  }

  const k = data.kpis;

  const filterCounts: Record<ActiveFilter, number> = {
    all:       data.receivables.length,
    pending:   data.receivables.filter((r) => r.paymentStatus === 'pending').length,
    link_sent: data.receivables.filter((r) => r.paymentStatus === 'link_sent').length,
    overdue:   data.receivables.filter((r) => r.paymentStatus === 'overdue').length,
    received:  data.payments.length,
  };

  const FILTERS: { key: ActiveFilter; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'link_sent', label: 'Link Sent' },
    { key: 'overdue',   label: 'Overdue' },
    { key: 'received',  label: 'Received' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* ── 1. Header ───────────────────────────────────────────────────────── */}
      <header
        className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <h1 className="page-title">Accounts & Payments</h1>
          <p className="page-subtitle">Track outstanding receivables and captured payments</p>
        </div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          View Invoices <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {exportError && (
        <div
          className="flex-shrink-0 px-6 py-2 text-xs text-red-700"
          style={{ borderBottom: '1px solid #FCA5A5', background: '#FEF2F2' }}
        >
          {exportError}
        </div>
      )}

      {/* ── 2. Compact KPI summary ──────────────────────────────────────────── */}
      <section
        className="flex-shrink-0 grid grid-cols-2 gap-3 px-6 py-4 md:grid-cols-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <CompactKpi
          icon={Wallet}
          label="Outstanding"
          value={formatRupees(k.outstandingPaise)}
          sub={`${k.openReceivableCount} to collect`}
          iconBg="#FEF3CD"
          iconColor="#D97706"
        />
        <CompactKpi
          icon={AlertCircle}
          label="Overdue"
          value={formatRupees(k.overduePaise)}
          sub={k.overduePaise > 0 ? 'Needs follow-up' : 'None overdue'}
          iconBg={k.overduePaise > 0 ? 'var(--danger-soft)' : 'var(--surface-muted)'}
          iconColor={k.overduePaise > 0 ? 'var(--danger)' : 'var(--text-tertiary)'}
        />
        <CompactKpi
          icon={TrendingUp}
          label="Collected · 30 days"
          value={formatRupees(k.collected30dPaise)}
          sub={`${k.collected30dCount} payment${k.collected30dCount === 1 ? '' : 's'}`}
          iconBg="#D1FAE5"
          iconColor="#059669"
        />
        <CompactKpi
          icon={HandCoins}
          label="Collected · All time"
          value={formatRupees(k.collectedAllTimePaise)}
          sub={`${k.collectedAllTimeCount} transactions`}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
        />
      </section>

      {/* ── 3. Main working area ────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-5 p-6">

          {/* Search + filter pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="text"
                placeholder="Search project, client, milestone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border bg-[var(--surface-card)] pl-9 pr-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--accent-base)]/30"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-heading)',
                }}
              />
            </div>

            <div
              className="flex items-center gap-0.5 rounded-xl border p-0.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
            >
              {FILTERS.map(({ key, label }) => {
                const active = activeFilter === key;
                const isOverdue = key === 'overdue' && filterCounts.overdue > 0;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'var(--surface-card)' : 'transparent',
                      color: active
                        ? (isOverdue ? 'var(--danger)' : 'var(--text-heading)')
                        : 'var(--text-secondary)',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {label}
                    <span
                      className="rounded-full px-1.5 py-px text-[10px] font-bold"
                      style={{
                        background: active
                          ? (isOverdue ? 'var(--danger-soft)' : 'var(--surface-muted)')
                          : 'transparent',
                        color: isOverdue && active ? 'var(--danger)' : 'var(--text-tertiary)',
                      }}
                    >
                      {filterCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          {activeFilter === 'received'
            ? <ReceivedTable rows={filteredPayments} />
            : <ReceivablesTable rows={filteredReceivables} activeFilter={activeFilter} />
          }

          {/* ── 4. Tally Export — collapsible ───────────────────────────────── */}
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
          >
            <button
              type="button"
              onClick={() => setTallyOpen(!tallyOpen)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-muted)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: '#ECFDF5' }}
                >
                  <FileSpreadsheet className="h-4 w-4" style={{ color: '#059669' }} />
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Tally Export
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Import sales &amp; receipt vouchers into Tally Prime
                  </p>
                </div>
              </div>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 transition-transform"
                style={{
                  color: 'var(--text-tertiary)',
                  transform: tallyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {tallyOpen && (
              <div
                className="space-y-4 px-5 pb-5"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                {/* Date range */}
                <div className="flex flex-wrap items-end gap-3 pt-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={tallyFrom}
                      onChange={(e) => setTallyFrom(e.target.value)}
                      className="h-9 rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--accent-base)]/30"
                      style={{
                        width: '160px',
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-heading)',
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={tallyTo}
                      onChange={(e) => setTallyTo(e.target.value)}
                      className="h-9 rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--accent-base)]/30"
                      style={{
                        width: '160px',
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-heading)',
                      }}
                    />
                  </div>
                  <div className="flex gap-1.5 pb-px">
                    {(['this-month', 'last-month', 'fy'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyRangePreset(p)}
                        className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}
                      >
                        {p === 'this-month' ? 'This month' : p === 'last-month' ? 'Last month' : 'FY-to-date'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ExportCard
                    title="Sales Vouchers"
                    desc="Invoices raised in range. Customer Dr · Sales Cr · GST split."
                    onCsv={() => downloadTally('tally-sales-csv')}
                    onXml={() => downloadTally('tally-sales-xml')}
                    busyCsv={busyExport === 'tally-sales-csv'}
                    busyXml={busyExport === 'tally-sales-xml'}
                  />
                  <ExportCard
                    title="Receipt Vouchers"
                    desc="Payments captured in range. Bank Dr · Customer Cr."
                    onCsv={() => downloadTally('tally-receipts-csv')}
                    onXml={() => downloadTally('tally-receipts-xml')}
                    busyCsv={busyExport === 'tally-receipts-csv'}
                    busyXml={busyExport === 'tally-receipts-xml'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact KPI card ──────────────────────────────────────────────────────────

function CompactKpi({
  icon: Icon, label, value, sub, iconBg, iconColor,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string; sub: string;
  iconBg: string; iconColor: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3.5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBg }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: 'var(--text-heading)' }}>
          {value}
        </p>
        <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Receivables table ─────────────────────────────────────────────────────────

function ReceivablesTable({ rows, activeFilter }: { rows: ReceivableRow[]; activeFilter: ActiveFilter }) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
      >
        <div
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: '#D1FAE5' }}
        >
          <IndianRupee className="h-5 w-5" style={{ color: '#059669' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
          {activeFilter === 'overdue' ? 'No overdue payments' : 'All caught up'}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          No outstanding milestones match your filter.
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Project', 'Client', 'Milestone', 'Amount', 'Status', 'Age'].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide${h === 'Amount' ? ' text-right' : ''}`}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cfg = STATUS_CONFIG[r.paymentStatus];
              return (
                <tr
                  key={r.id}
                  className="transition-colors hover:bg-[var(--surface-muted)]"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${r.projectId}/payments`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--text-heading)' }}
                    >
                      {r.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {r.clientName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {r.label}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(r.amountPaise)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {r.daysSinceCreation}d
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/projects/${r.projectId}/payments`}
                      className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      Manage <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Received payments table ───────────────────────────────────────────────────

const PAY_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  captured: { label: 'Received', bg: '#D1FAE5', color: '#059669' },
  pending:  { label: 'Pending',  bg: '#FEF3CD', color: '#D97706' },
  failed:   { label: 'Failed',   bg: 'var(--danger-soft)', color: 'var(--danger)' },
  refunded: { label: 'Refunded', bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

function ReceivedTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
      >
        <div
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-muted)' }}
        >
          <Receipt className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No payments recorded yet</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Payments appear here as clients pay via Razorpay links or you record manual entries.
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Date', 'Project', 'Invoice', 'Amount', 'Status', 'Source'].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide${h === 'Amount' ? ' text-right' : ''}`}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const cfg = PAY_STATUS_CONFIG[p.status] ?? PAY_STATUS_CONFIG.pending;
              return (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-[var(--surface-muted)]"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(p.reconciledAt ?? p.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {p.projectId && p.projectName ? (
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        {p.projectName}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.invoiceNumber ? (
                      <Link
                        href={`/invoices/${p.invoiceId}`}
                        className="font-mono text-xs hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {p.invoiceNumber}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(p.amountPaise)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {p.source === 'razorpay'
                        ? <Zap className="h-3 w-3" style={{ color: '#3B82F6' }} />
                        : <HandCoins className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                      }
                      {p.source === 'razorpay' ? 'Razorpay' : 'Manual'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tally export card ─────────────────────────────────────────────────────────

function ExportCard({
  title, desc, onCsv, onXml, busyCsv, busyXml,
}: {
  title: string; desc: string;
  onCsv: () => void; onXml: () => void;
  busyCsv: boolean; busyXml: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border p-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
      </div>
      <div className="flex flex-shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onCsv}
          disabled={busyCsv}
          className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {busyCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          CSV
        </button>
        <button
          type="button"
          onClick={onXml}
          disabled={busyXml}
          className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {busyXml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          XML
        </button>
      </div>
    </div>
  );
}
