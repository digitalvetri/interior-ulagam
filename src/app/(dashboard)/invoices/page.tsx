'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Download, FileText, IndianRupee, Plus, Receipt, Search, Zap } from 'lucide-react';
import { formatRupees } from '@/lib/utils';

type PaymentStatus = 'pending' | 'link_sent' | 'paid' | 'overdue';

interface InvoiceRow {
  id: string;
  projectId: string;
  projectName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  isInterstate: boolean;
  irn: string | null;
  pdfUrl: string | null;
  paymentStatus: PaymentStatus | null;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
  paid:      { label: 'Paid',      bg: 'var(--success-soft)',  color: 'var(--success)' },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',   color: 'var(--danger)' },
  link_sent: { label: 'Link sent', bg: '#FEF9C3',              color: '#92400E' },
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/v1/invoices')
      .then((r) => r.json())
      .then((body) => { setRows((body.data ?? []) as InvoiceRow[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      query === '' ||
      r.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
      r.projectName.toLowerCase().includes(query.toLowerCase()),
  );

  const totalInvoicedPaise = rows.reduce(
    (s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise,
    0,
  );
  const eInvoiceCount = rows.filter((r) => r.irn).length;
  const overdueCount  = rows.filter((r) => r.paymentStatus === 'overdue').length;

  const outstandingPaise = rows
    .filter((r) => r.paymentStatus !== 'paid')
    .reduce((s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">
            {rows.length > 0 ? `${rows.length} shown` : 'All GST invoices issued across projects'}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New Invoice
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Invoices"
          value={String(rows.length)}
          icon={FileText}
          iconBg="#E8F5F0"
          iconColor="#2D8A6A"
        />
        <KpiCard
          label="Invoiced (Net)"
          value={formatRupees(totalInvoicedPaise)}
          icon={IndianRupee}
          iconBg="#E8F5F0"
          iconColor="#2D8A6A"
          valueColor="#2D8A6A"
        />
        <KpiCard
          label="Invoiced Outstanding"
          value={formatRupees(outstandingPaise)}
          sub="on invoiced milestones"
          icon={AlertCircle}
          iconBg={outstandingPaise > 0 ? '#FEF3CD' : '#E8F5F0'}
          iconColor={outstandingPaise > 0 ? '#D97706' : '#2D8A6A'}
          valueColor={outstandingPaise > 0 ? '#D97706' : undefined}
        />
        <KpiCard
          label="e-Invoices (IRN)"
          value={String(eInvoiceCount)}
          icon={Zap}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
        />
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Search invoice # or project…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="studio-input w-full h-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
        >
          <Receipt className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {query ? 'No invoices match your search' : 'No invoices yet'}
          </p>
          {!query && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              GST invoices are generated automatically when a milestone payment link is triggered.
            </p>
          )}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Invoice #', 'Project', 'Date', 'Subtotal', 'Tax', 'Total', 'Status', 'e-Invoice', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const taxPaise   = inv.isInterstate ? inv.igstPaise : inv.cgstPaise + inv.sgstPaise;
                  const totalPaise = inv.subtotalPaise + taxPaise;
                  const status     = inv.paymentStatus ?? 'pending';
                  const cfg        = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={inv.id}
                      className="transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent-base)' }}>
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-heading)' }}>
                        <Link href={`/projects/${inv.projectId}`} className="hover:underline">
                          {inv.projectName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(inv.subtotalPaise)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatRupees(taxPaise)}
                        <span className="ml-0.5 text-[10px] uppercase">
                          {inv.isInterstate ? 'igst' : 'gst'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(totalPaise)}
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
                        {inv.irn ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                          >
                            e-Invoice
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <FileText className="h-3.5 w-3.5" /> View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconColor, valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </p>
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconBg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
      </div>
      <p
        className="mt-2 text-2xl font-bold tabular-nums"
        style={{ color: valueColor ?? 'var(--text-heading)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
