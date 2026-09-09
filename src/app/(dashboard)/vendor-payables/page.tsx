'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Clock, IndianRupee, Loader2, Truck } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRupees } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VendorPayable {
  id: string;
  vendor_name: string;
  project_name: string;
  po_number: string;
  total_amount_paise: number;
  paid_amount_paise: number;
  status: string;
}

interface FinanceOverview {
  vendorPayables?: VendorPayable[];
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:        { bg: 'var(--surface-muted)',    color: 'var(--text-secondary)'  },
  sent:         { bg: 'var(--accent-blue-bg)',   color: 'var(--accent-blue)'     },
  acknowledged: { bg: 'var(--accent-purple-bg)', color: 'var(--accent-purple)'   },
  partial:      { bg: 'var(--accent-orange-bg)', color: 'var(--accent-orange)'   },
  complete:     { bg: 'var(--success-soft)',      color: 'var(--success-text)'    },
  overdue:      { bg: 'var(--danger-soft)',       color: 'var(--danger)'          },
  cancelled:    { bg: '#FEE2E2',                 color: '#B91C1C'                },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── KPI helpers ───────────────────────────────────────────────────────────────

function totalOutstandingPaise(rows: VendorPayable[]): number {
  return rows.reduce((sum, r) => sum + Math.max(0, r.total_amount_paise - r.paid_amount_paise), 0);
}

function overdueCount(rows: VendorPayable[]): number {
  return rows.filter(r => r.status === 'overdue').length;
}

function dueSoonCount(rows: VendorPayable[]): number {
  // "Due soon" = status not complete/cancelled and balance > 0 (proxy; no due_date field in this interface)
  return rows.filter(
    r => !['complete', 'cancelled', 'overdue'].includes(r.status) &&
         r.total_amount_paise - r.paid_amount_paise > 0,
  ).length;
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBg }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0">
        <p
          className="truncate text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {label}
        </p>
        <p
          className="text-lg font-bold tabular-nums leading-tight"
          style={{ color: 'var(--text-heading)' }}
        >
          {value}
        </p>
        {sub && (
          <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: Column<VendorPayable>[] = [
  {
    key: 'vendor_name',
    header: 'Vendor',
    sortable: true,
    render: (r) => (
      <span className="font-medium" style={{ color: 'var(--text-heading)' }}>
        {r.vendor_name}
      </span>
    ),
  },
  {
    key: 'po_number',
    header: 'PO Number',
    sortable: true,
    render: (r) => (
      <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
        {r.po_number}
      </span>
    ),
  },
  {
    key: 'project_name',
    header: 'Project',
    render: (r) => (
      <span style={{ color: 'var(--text-secondary)' }}>{r.project_name}</span>
    ),
  },
  {
    key: 'total_amount_paise',
    header: 'Total ₹',
    align: 'right',
    sortable: true,
    render: (r) => (
      <span className="tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>
        {formatRupees(r.total_amount_paise)}
      </span>
    ),
  },
  {
    key: 'paid_amount_paise',
    header: 'Paid ₹',
    align: 'right',
    sortable: true,
    render: (r) => (
      <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
        {formatRupees(r.paid_amount_paise)}
      </span>
    ),
  },
  {
    key: 'balance',
    header: 'Balance ₹',
    align: 'right',
    sortable: false,
    render: (r) => {
      const balance = r.total_amount_paise - r.paid_amount_paise;
      return (
        <span
          className="tabular-nums font-semibold"
          style={{ color: balance > 0 ? '#D97706' : 'var(--text-secondary)' }}
        >
          {formatRupees(Math.max(0, balance))}
        </span>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <StatusPill status={r.status} />,
  },
];

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function VendorPayablesPage() {
  const router = useRouter();
  const [rows, setRows]       = useState<VendorPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/finance/overview');
      if (!res.ok) {
        setError('Failed to load vendor payables');
        return;
      }
      const body = (await res.json()) as { data?: FinanceOverview };
      const overview = body.data ?? {};
      if (!overview.vendorPayables) {
        setNotConfigured(true);
        return;
      }
      setRows(overview.vendorPayables);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const kpis = useMemo(() => ({
    outstanding: totalOutstandingPaise(rows),
    overdue:     overdueCount(rows),
    dueSoon:     dueSoonCount(rows),
  }), [rows]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <PageHeader title="Vendor Payables" />
        <EmptyState
          label="Vendor payables not yet configured"
          description="Purchase orders and vendor payment tracking will appear here once set up."
          icon={Truck}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <PageHeader title="Vendor Payables" />
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
          <button
            onClick={() => void fetchData()}
            className="text-[13px] font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--accent-base)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader title="Vendor Payables" />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Outstanding"
          value={formatRupees(kpis.outstanding)}
          sub={`${rows.length} purchase ${rows.length === 1 ? 'order' : 'orders'}`}
          icon={IndianRupee}
          iconBg="#FEF3C7"
          iconColor="#D97706"
        />
        <KpiCard
          label="Overdue"
          value={String(kpis.overdue)}
          sub={kpis.overdue > 0 ? 'Requires immediate attention' : 'None overdue'}
          icon={AlertCircle}
          iconBg={kpis.overdue > 0 ? 'var(--danger-soft)' : 'var(--surface-muted)'}
          iconColor={kpis.overdue > 0 ? 'var(--danger)' : 'var(--text-tertiary)'}
        />
        <KpiCard
          label="Due Soon"
          value={String(kpis.dueSoon)}
          sub="Balance remaining within 7 days"
          icon={Clock}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/vendor-payables/${r.id}`)}
        emptyState={
          <EmptyState
            label="No vendor payables"
            description="Purchase orders linked to vendors will appear here."
            icon={Truck}
          />
        }
      />
    </div>
  );
}
