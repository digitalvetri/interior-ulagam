'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Receipt, Search } from 'lucide-react';
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

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Invoices</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            All GST invoices issued across projects
          </p>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          Accounts & Payments →
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced',  value: formatRupees(totalInvoicedPaise), danger: false },
          { label: 'Total Invoices',  value: String(rows.length),              danger: false },
          { label: 'e-Invoices (IRN)', value: String(eInvoiceCount),           danger: false },
          { label: 'Overdue',         value: String(overdueCount),             danger: overdueCount > 0 },
        ].map(({ label, value, danger }) => (
          <div
            key={label}
            className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              {label}
            </p>
            <p
              className="text-xl font-bold mt-1 tabular-nums"
              style={{ color: danger ? 'var(--danger)' : 'var(--text-heading)' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: 'var(--text-tertiary)' }}
        />
        <input
          type="text"
          placeholder="Search invoice # or project…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="studio-input pl-9 w-full"
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
