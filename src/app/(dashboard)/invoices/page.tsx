'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { Invoice, PaymentDerivedStatus } from '@/types/accounts';

const STATUS_STYLE: Record<PaymentDerivedStatus, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function derivedStatus(inv: Invoice): PaymentDerivedStatus {
  const paid = inv.paidPaise ?? 0;
  const total = inv.totalPaise ?? 0;
  if (paid <= 0) return 'pending';
  if (paid >= total) return 'paid';
  return 'partial';
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentDerivedStatus>('all');

  const loadInvoices = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/invoices')
      .then((r) => r.json())
      .then(({ data }: { data: Invoice[] }) => {
        setInvoices(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Data fetch on mount — TanStack Query refactor tracked separately.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const filtered =
    statusFilter === 'all'
      ? invoices
      : invoices.filter((i) => derivedStatus(i) === statusFilter);

  const totals = invoices.reduce(
    (acc, i) => {
      acc.count += 1;
      acc.total += i.totalPaise ?? 0;
      acc.paid += i.paidPaise ?? 0;
      return acc;
    },
    { count: 0, total: 0, paid: 0 },
  );
  const outstanding = totals.total - totals.paid;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Auto-generated when a project milestone triggers billing.
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label="Total issued" value={formatRupees(totals.total)} sub={`${totals.count} invoices`} />
        <SummaryTile label="Collected" value={formatRupees(totals.paid)} sub="Captured payments" tone="pos" />
        <SummaryTile label="Outstanding" value={formatRupees(outstanding)} sub="Unpaid balance" tone={outstanding > 0 ? 'warn' : 'default'} />
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        {(['all', 'pending', 'partial', 'paid'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ' +
              (statusFilter === s
                ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800')
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading invoices…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
              <FileText className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {invoices.length === 0 ? 'No invoices yet' : `No ${statusFilter} invoices`}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {invoices.length === 0
                  ? 'Trigger a milestone on any project to issue the first invoice.'
                  : 'Try a different filter or clear it to see everything.'}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const status = derivedStatus(inv);
                return (
                  <tr
                    key={inv.id}
                    className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {inv.projectName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {formatRupees(inv.totalPaise ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {formatRupees(inv.paidPaise ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                          STATUS_STYLE[status]
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'pos' | 'warn';
}) {
  const toneClass =
    tone === 'pos'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
    </div>
  );
}
