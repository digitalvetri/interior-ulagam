'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { PurchaseOrder, POLine } from '@/types/purchase-orders';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft:        { background: 'var(--surface-muted)',    color: 'var(--text-secondary)'  },
  sent:         { background: 'var(--purple-soft)',      color: 'var(--purple)'           },
  acknowledged: { background: 'var(--gold-soft)',        color: 'var(--text-gold)'        },
  partial:      { background: 'var(--teal-soft)',        color: 'var(--text-accent)'      },
  complete:     { background: 'var(--teal)',             color: 'var(--surface-card)'     },
  overdue:      { background: 'var(--danger-soft)',      color: 'var(--danger)'           },
  cancelled:    { background: '#FEE2E2',                 color: '#B91C1C'                 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseLines(raw: unknown): POLine[] | null {
  if (Array.isArray(raw)) return raw as POLine[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as POLine[];
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Detail field ───────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-x-3 gap-y-0.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
        {children}
      </span>
    </div>
  );
}

// ─── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {children}
    </h3>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function VendorPayableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [po, setPo]           = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setFetchError('Failed to load purchase order');
        return;
      }
      const body = (await res.json()) as { data: PurchaseOrder };
      setPo(body.data ?? null);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  // ── Not found / error ────────────────────────────────────────────────────────

  if (notFound || (!po && !fetchError)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>
          Purchase order not found.
        </p>
        <Link
          href="/vendor-payables"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium underline-offset-4 hover:underline"
          style={{ color: 'var(--accent-base)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Vendor Payables
        </Link>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{fetchError}</p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => void fetchData()}
            className="text-[13px] font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--accent-base)' }}
          >
            Retry
          </button>
          <Link
            href="/vendor-payables"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!po) return null;

  const parsedLines = parseLines(po.linesJson);
  const totalPaise  = parsedLines?.reduce((s, l) => s + l.totalPaise, 0) ?? 0;
  const statusStyle = STATUS_STYLES[po.status] ?? STATUS_STYLES.draft;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        <Link
          href="/vendor-payables"
          className="inline-flex items-center gap-1 hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Vendor Payables
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-heading)' }}>{po.poNumber}</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl font-bold"
              style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}
            >
              {po.poNumber}
            </h1>
            <span
              className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold"
              style={statusStyle}
            >
              {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
            </span>
          </div>
          {/* vendor name from vendorId — may not be directly in PurchaseOrder type; show what's available */}
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Purchase order detail
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT: PO Details (2/3 width) ─────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* PO metadata */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
          >
            <SectionHeading>PO Details</SectionHeading>
            <div className="space-y-2.5">
              <DetailRow label="PO Number">
                <span className="font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {po.poNumber}
                </span>
              </DetailRow>
              <DetailRow label="Status">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={statusStyle}
                >
                  {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                </span>
              </DetailRow>
              {po.expectedDeliveryAt && (
                <DetailRow label="Expected">
                  {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </DetailRow>
              )}
              <DetailRow label="Advance Paid">
                <span className="tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>
                  {formatRupees(po.advancePaidPaise)}
                </span>
              </DetailRow>
              <DetailRow label="Balance Due">
                <span
                  className="tabular-nums font-semibold"
                  style={{ color: totalPaise - po.advancePaidPaise > 0 ? '#D97706' : 'var(--text-secondary)' }}
                >
                  {formatRupees(Math.max(0, totalPaise - po.advancePaidPaise))}
                </span>
              </DetailRow>
            </div>
          </div>

          {/* Line items */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="px-5 py-3.5"
              style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <SectionHeading>Line Items</SectionHeading>
            </div>

            {parsedLines === null ? (
              <pre
                className="overflow-x-auto p-4 text-xs"
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-muted)' }}
              >
                {typeof po.linesJson === 'string'
                  ? po.linesJson
                  : JSON.stringify(po.linesJson, null, 2)}
              </pre>
            ) : parsedLines.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No line items on this order.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--surface-card)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      {['Description', 'Qty', 'Unit', 'Unit Rate', 'Total'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em]${
                            i >= 3 ? ' text-right' : ''
                          }`}
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLines.map((line, idx) => (
                      <tr
                        key={line.id ?? idx}
                        className="border-b last:border-0"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
                      >
                        <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          {line.description}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {line.qty}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                          {line.unit}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {formatRupees(line.unitRatePaise)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums font-semibold"
                          style={{ color: 'var(--text-heading)' }}
                        >
                          {formatRupees(line.totalPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-right text-[12px] font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Order total
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums text-[14px] font-bold"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        {formatRupees(totalPaise)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Vendor Payments */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="px-5 py-3.5"
              style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <SectionHeading>Vendor Payments</SectionHeading>
            </div>
            <div
              className="flex items-center justify-center py-12"
              style={{ background: 'var(--surface-card)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No vendor payments recorded yet.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Related links (1/3 width) ────────────────────────────── */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
          >
            <SectionHeading>Related</SectionHeading>

            {/* Project link */}
            {po.projectId && (
              <div>
                <p
                  className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Project
                </p>
                <Link
                  href={`/projects/${po.projectId}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
                  style={{ color: 'var(--accent-base)' }}
                >
                  View project
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Vendor link */}
            {po.vendorId && (
              <div>
                <p
                  className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Vendor
                </p>
                <Link
                  href={`/vendors/${po.vendorId}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
                  style={{ color: 'var(--accent-base)' }}
                >
                  View vendor
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Back to PO list */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <Link
                href="/purchase-orders"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All purchase orders
              </Link>
            </div>
          </div>

          {/* Advance summary card */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
          >
            <SectionHeading>Payment Summary</SectionHeading>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Order value
                </span>
                <span
                  className="tabular-nums text-[13px] font-semibold"
                  style={{ color: 'var(--text-heading)' }}
                >
                  {formatRupees(totalPaise)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Advance paid
                </span>
                <span
                  className="tabular-nums text-[13px]"
                  style={{ color: 'var(--success-text)' }}
                >
                  {formatRupees(po.advancePaidPaise)}
                </span>
              </div>
              <div
                className="flex items-baseline justify-between gap-2 pt-2"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Balance due
                </span>
                <span
                  className="tabular-nums text-[14px] font-bold"
                  style={{
                    color:
                      totalPaise - po.advancePaidPaise > 0
                        ? '#D97706'
                        : 'var(--text-secondary)',
                  }}
                >
                  {formatRupees(Math.max(0, totalPaise - po.advancePaidPaise))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
