'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Download, ExternalLink, IndianRupee, Loader2, Plus, Zap, HandCoins,
  Building2, CalendarDays, FileText, CircleDot, Receipt, CheckCircle2,
  AlertCircle, Clock, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RecordPaymentDrawer } from '@/components/finance/RecordPaymentDrawer';
import { formatRupees } from '@/lib/utils';
import type { InvoiceDetail, InvoicePayment } from '@/types/accounts';

// Extended payment shape — the API returns these extra columns via db.select()
type ExtendedPayment = InvoicePayment & {
  mode?: string | null;
  reference?: string | null;
  receivedAt?: string | null;
  note?: string | null;
  receiptNumber?: string | null;
  recordedBy?: string | null;
};

const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',      icon: <Clock        className="h-3.5 w-3.5" />, bg: 'var(--surface-muted)', text: 'var(--text-secondary)', dot: '#94a3b8' },
  issued:    { label: 'Issued',     icon: <CircleDot    className="h-3.5 w-3.5" />, bg: '#eff6ff',              text: '#1d4ed8',               dot: '#3b82f6' },
  part_paid: { label: 'Part Paid',  icon: <AlertCircle  className="h-3.5 w-3.5" />, bg: '#fffbeb',              text: '#b45309',               dot: '#f59e0b' },
  paid:      { label: 'Paid',       icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: '#f0fdf4',              text: '#15803d',               dot: '#22c55e' },
  void:      { label: 'Void',       icon: <Ban          className="h-3.5 w-3.5" />, bg: '#fef2f2',              text: '#b91c1c',               dot: '#ef4444' },
};

function fmtDate(iso: string | null | undefined, fallback = '—') {
  if (!iso) return fallback;
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [issuing,       setIssuing]       = useState(false);
  const [voidOpen,      setVoidOpen]      = useState(false);
  const [voidReason,    setVoidReason]    = useState('');
  const [voiding,       setVoiding]       = useState(false);
  const [voidError,     setVoidError]     = useState<string | null>(null);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError,      setPdfError]      = useState<string | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const loadInvoice = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/invoices/${id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((body) => {
        if (body?.data) setDetail(body.data as InvoiceDetail);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  async function issueInvoice() {
    setIssuing(true);
    try {
      await fetch(`/api/v1/invoices/${id}/issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      loadInvoice();
    } finally { setIssuing(false); }
  }

  async function doVoid() {
    if (!voidReason.trim()) return;
    setVoiding(true); setVoidError(null);
    try {
      const res = await fetch(`/api/v1/invoices/${id}/void`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: voidReason.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setVoidError(b?.error ?? 'Failed to void invoice.');
        return;
      }
      setVoidOpen(false); setVoidReason('');
      loadInvoice();
    } catch { setVoidError('Network error. Try again.'); }
    finally { setVoiding(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading invoice…
      </div>
    );
  }
  if (notFound || !detail) {
    return (
      <div className="p-8">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>Invoice not found.</p>
      </div>
    );
  }

  const { invoice, payments, project, sourceMilestone } = detail;
  const totalPaise       = invoice.subtotalPaise + invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;
  const paidPaise        = payments.filter((p: InvoicePayment) => p.status === 'captured').reduce((s: number, p: InvoicePayment) => s + p.amountPaise, 0);
  const outstandingPaise = Math.max(0, totalPaise - paidPaise);
  const isFullyPaid      = outstandingPaise <= 0;
  const paidPct          = totalPaise > 0 ? Math.min(100, Math.round((paidPaise / totalPaise) * 100)) : 0;

  const status = invoice.status ?? 'draft';
  const statusCfg = STATUS_CFG[status] ?? STATUS_CFG.draft;

  const clientName = project?.clientName ?? null;

  async function handlePdfDownload() {
    setPdfError(null);
    setPdfGenerating(true);
    try {
      if (invoice.pdfUrl) {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`);
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) window.open(b.data.pdfUrl as string, '_blank');
      } else {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`, { method: 'POST' });
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) {
          window.open(b.data.pdfUrl as string, '_blank');
          loadInvoice();
        } else {
          setPdfError('PDF generation failed');
        }
      }
    } catch {
      setPdfError('Network error');
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleReceiptDownload() {
    setReceiptLoading(true);
    try {
      const r = await fetch(`/api/v1/payments/${lastPaymentId}/receipt`, { method: 'POST' });
      const b = await r.json();
      if (r.ok && b?.data?.pdfUrl) window.open(b.data.pdfUrl as string, '_blank');
    } finally {
      setReceiptLoading(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Invoices
        </Link>
        <span style={{ color: 'var(--border-subtle)' }}>/</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
          {invoice.invoiceNumber}
        </span>
      </div>

      {/* Hero header */}
      <div
        className="rounded-2xl border p-6 mb-6"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: identity */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                {invoice.invoiceNumber}
              </h1>
              {/* Status pill */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: statusCfg.bg, color: statusCfg.text }}
              >
                {statusCfg.icon}
                {statusCfg.label}
              </span>
            </div>

            {/* Who & what */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {clientName && (
                <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <Building2 className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  {clientName}
                </span>
              )}
              {project && (
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-1.5 hover:underline"
                  style={{ color: 'var(--accent-base)' }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {project.name}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
              )}
              {sourceMilestone && (
                <Link
                  href={`/projects/${sourceMilestone.projectId}/payments`}
                  className="flex items-center gap-1.5 text-xs hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Milestone: {sourceMilestone.label}
                </Link>
              )}
            </div>

            {/* Dates row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Issued {fmtDate(invoice.invoiceDate)}
              </span>
              {invoice.dueDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Due {fmtDate(invoice.dueDate)}
                </span>
              )}
              {invoice.issuedAt && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  Issued on {fmtDate(invoice.issuedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Right: grand total */}
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Invoice Total
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
              {formatRupees(totalPaise)}
            </p>
            {outstandingPaise > 0 && (
              <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--warning)' }}>
                {formatRupees(outstandingPaise)} outstanding
              </p>
            )}
            {isFullyPaid && (
              <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--success)' }}>
                Fully collected
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            <span>{isFullyPaid ? '✓ Fully paid' : `${paidPct}% collected`}</span>
            <span className="tabular-nums">
              {formatRupees(paidPaise)} of {formatRupees(totalPaise)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${paidPct}%`,
                background: isFullyPaid ? 'var(--success)' : 'var(--accent-base)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── LEFT COLUMN ─────────────────────────────────── */}
        <div className="space-y-6">

          {/* Amount breakdown card */}
          <SectionCard title="Amount Breakdown">
            <div className="space-y-2 text-sm">
              <AmountRow label="Subtotal" value={formatRupees(invoice.subtotalPaise)} />
              {invoice.isInterstate ? (
                <AmountRow label="IGST (18%)" value={formatRupees(invoice.igstPaise)} />
              ) : (
                <>
                  <AmountRow label="CGST (9%)" value={formatRupees(invoice.cgstPaise)} />
                  <AmountRow label="SGST (9%)" value={formatRupees(invoice.sgstPaise)} />
                </>
              )}
              <div className="pt-2 mt-2" style={{ borderTop: '2px solid var(--border-subtle)' }}>
                <AmountRow label="Grand Total" value={formatRupees(totalPaise)} strong accent />
              </div>
              <div className="pt-2 mt-1" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                <AmountRow
                  label="Paid so far"
                  value={formatRupees(paidPaise)}
                  tone={paidPaise > 0 ? 'pos' : 'default'}
                />
                <div className="mt-2">
                  <AmountRow
                    label="Balance due"
                    value={formatRupees(outstandingPaise)}
                    tone={outstandingPaise > 0 ? 'warn' : 'pos'}
                    strong
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Payments received */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Payments Received
              </h2>
              {!isFullyPaid && invoice.status !== 'draft' && invoice.status !== 'void' && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--accent-base)' }}
                >
                  <Plus className="h-3.5 w-3.5" /> Record payment
                </button>
              )}
            </div>

            <div
              className="overflow-hidden rounded-2xl border"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
            >
              {payments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <IndianRupee className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payments recorded yet.</p>
                  {!isFullyPaid && invoice.status !== 'draft' && invoice.status !== 'void' && (
                    <button
                      onClick={() => setDrawerOpen(true)}
                      className="text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      Record first payment
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Date', 'Amount', 'Status', 'Mode', 'Reference / Note'].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: InvoicePayment) => {
                        const ep = p as ExtendedPayment;
                        const isManual = !!p.manualOverrideBy;
                        const captured = p.status === 'captured';
                        const displayDate = ep.receivedAt ?? ep.reconciledAt ?? p.createdAt;
                        const reference = ep.reference ?? p.razorpayPaymentId ?? null;
                        const noteText = ep.note ?? p.manualOverrideNote ?? null;
                        const modeName = ep.mode ?? (isManual ? 'Manual' : p.razorpayLinkId ? 'Razorpay' : '—');
                        return (
                          <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-3.5 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {fmtDate(displayDate)}
                            </td>
                            <td className="px-4 py-3.5 font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                              {formatRupees(p.amountPaise)}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                                style={{
                                  background: captured ? '#f0fdf4' : 'var(--surface-muted)',
                                  color: captured ? '#15803d' : 'var(--text-secondary)',
                                }}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {isManual ? (
                                  <><HandCoins className="h-3.5 w-3.5" /> {modeName}</>
                                ) : p.razorpayPaymentId ? (
                                  <><Zap className="h-3.5 w-3.5 text-blue-500" /> Razorpay <ExternalLink className="h-3 w-3 opacity-60" /></>
                                ) : (
                                  <><Receipt className="h-3.5 w-3.5 opacity-60" /> {modeName}</>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5 max-w-[220px]">
                                {reference && (
                                  <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {reference}
                                  </span>
                                )}
                                {noteText && (
                                  <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                                    {noteText}
                                  </span>
                                )}
                                {!reference && !noteText && (
                                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ────────────────────────────────── */}
        <div className="space-y-4">

          {/* Invoice Status card */}
          <div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Invoice Status
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: statusCfg.dot }}
              />
              <span className="text-sm font-semibold" style={{ color: statusCfg.text }}>
                {statusCfg.label}
              </span>
            </div>
            <dl className="space-y-2 text-xs">
              <MetaRow label="Invoice #"    value={invoice.invoiceNumber} />
              <MetaRow label="Invoice date" value={fmtDate(invoice.invoiceDate)} />
              {invoice.dueDate && (
                <MetaRow label="Due date" value={fmtDate(invoice.dueDate)} />
              )}
              {invoice.issuedAt && (
                <MetaRow label="Issued on" value={fmtDate(invoice.issuedAt)} />
              )}
              {invoice.voidedAt && (
                <MetaRow label="Voided on" value={fmtDate(invoice.voidedAt)} />
              )}
              {invoice.voidReason && (
                <div className="pt-1">
                  <dt className="mb-0.5" style={{ color: 'var(--text-secondary)' }}>Void reason</dt>
                  <dd className="text-xs" style={{ color: 'var(--danger)' }}>{invoice.voidReason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* GST Details */}
          <div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              GST Details
            </p>
            <dl className="space-y-2 text-xs">
              <MetaRow label="Supply type"     value={invoice.isInterstate ? 'Interstate (IGST)' : 'Intra-state (CGST + SGST)'} />
              <MetaRow label="Place of supply" value={invoice.placeOfSupply ?? '—'} />
              {invoice.isInterstate ? (
                <MetaRow label="IGST (18%)" value={formatRupees(invoice.igstPaise)} />
              ) : (
                <>
                  <MetaRow label="CGST (9%)" value={formatRupees(invoice.cgstPaise)} />
                  <MetaRow label="SGST (9%)" value={formatRupees(invoice.sgstPaise)} />
                </>
              )}
              <MetaRow
                label="Total tax"
                value={formatRupees(invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise)}
              />
            </dl>
            {invoice.irn && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>IRN</p>
                <p className="text-[10px] font-mono break-all leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {invoice.irn}
                </p>
              </div>
            )}
            {invoice.qrCodeUrl && (
              <div className="mt-3 flex justify-center">
                <Image
                  src={invoice.qrCodeUrl}
                  alt="e-Invoice QR"
                  width={100}
                  height={100}
                  className="rounded-lg border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Actions
            </p>
            <div className="space-y-2">
              {/* Issue */}
              {invoice.status === 'draft' && (
                <button
                  onClick={issueInvoice}
                  disabled={issuing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'var(--accent-base)' }}
                >
                  {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Issue Invoice
                </button>
              )}

              {/* Record payment */}
              {!isFullyPaid && invoice.status !== 'draft' && invoice.status !== 'void' && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent-base)' }}
                >
                  <Plus className="h-4 w-4" /> Record Payment
                </button>
              )}

              {/* Download PDF */}
              <button
                onClick={handlePdfDownload}
                disabled={pdfGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--surface-muted)] disabled:opacity-60"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {invoice.pdfUrl ? 'Download PDF' : 'Generate PDF'}
              </button>
              {pdfError && <p className="text-xs text-center" style={{ color: 'var(--danger)' }}>{pdfError}</p>}

              {/* Receipt */}
              {lastPaymentId && (
                <button
                  onClick={handleReceiptDownload}
                  disabled={receiptLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  style={{ borderColor: 'var(--border-subtle)', color: '#059669' }}
                >
                  {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Receipt
                </button>
              )}

              {/* Void */}
              {invoice.status !== 'paid' && invoice.status !== 'void' && (
                <button
                  onClick={() => { setVoidReason(''); setVoidOpen(true); }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
                  style={{ borderColor: 'var(--danger-soft)', color: 'var(--danger)' }}
                >
                  <Ban className="h-4 w-4" /> Void Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer + Void modal */}
      <RecordPaymentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(_paymentId) => { setDrawerOpen(false); loadInvoice(); }}
        defaultInvoiceId={id}
        defaultProjectId={detail?.invoice.projectId}
        contextLabel={detail ? `${detail.invoice.invoiceNumber}${detail.project?.name ? ` — ${detail.project.name}` : ''}` : undefined}
      />

      {voidOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => { if (!voiding) setVoidOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6 space-y-4"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Void invoice
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              A voided invoice cannot be collected. Provide a reason:
            </p>
            <Textarea
              rows={3}
              placeholder="e.g. Duplicate, issued in error, superseded by revised invoice"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              disabled={voiding}
            />
            {voidError && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{voidError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={voiding}>
                Cancel
              </Button>
              <Button
                onClick={doVoid}
                disabled={voiding || !voidReason.trim()}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
              >
                {voiding ? 'Voiding…' : 'Void invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Local sub-components ────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function AmountRow({
  label, value, strong = false, tone = 'default', accent = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'default' | 'pos' | 'warn';
  accent?: boolean;
}) {
  const valColor = accent
    ? 'var(--accent-base)'
    : tone === 'pos'
    ? 'var(--success)'
    : tone === 'warn'
    ? 'var(--warning)'
    : 'var(--text-heading)';
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'font-semibold' : ''} style={{ color: strong ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-medium'}`} style={{ color: valColor }}>
        {value}
      </dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd className="text-right" style={{ color: 'var(--text-heading)', maxWidth: '60%', wordBreak: 'break-word' }}>
        {value}
      </dd>
    </div>
  );
}
