'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Download, ExternalLink, IndianRupee, Loader2, Plus, Zap, HandCoins,
  Building2, CalendarDays, FileText, CircleDot, Receipt, CheckCircle2,
  AlertCircle, Clock, Ban, Pencil, Send, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RecordPaymentDrawer } from '@/components/finance/RecordPaymentDrawer';
import { formatRupees } from '@/lib/utils';
import type { InvoiceDetail, InvoicePayment } from '@/types/accounts';

type ExtendedPayment = InvoicePayment & {
  mode?: string | null;
  reference?: string | null;
  receivedAt?: string | null;
  note?: string | null;
  receiptNumber?: string | null;
};

const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',      icon: <Clock        className="h-3.5 w-3.5" />, bg: 'var(--surface-muted)', text: 'var(--text-secondary)', dot: '#94a3b8' },
  issued:    { label: 'Issued',     icon: <CircleDot    className="h-3.5 w-3.5" />, bg: '#eff6ff',              text: '#1d4ed8',               dot: '#3b82f6' },
  part_paid: { label: 'Part Paid',  icon: <AlertCircle  className="h-3.5 w-3.5" />, bg: '#fffbeb',              text: '#b45309',               dot: '#f59e0b' },
  paid:      { label: 'Paid',       icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: '#f0fdf4',              text: '#15803d',               dot: '#22c55e' },
  void:      { label: 'Void',       icon: <Ban          className="h-3.5 w-3.5" />, bg: '#fef2f2',              text: '#b91c1c',               dot: '#ef4444' },
};

const inputCls = 'studio-input w-full h-9';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide';

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

  // Edit drawer (draft only)
  const [editOpen,       setEditOpen]       = useState(false);
  const [editNumber,     setEditNumber]     = useState('');
  const [editDate,       setEditDate]       = useState('');
  const [editDueDate,    setEditDueDate]    = useState('');
  const [editSubtotal,   setEditSubtotal]   = useState('');
  const [editGstType,    setEditGstType]    = useState<'none' | 'intrastate' | 'interstate'>('none');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError,      setEditError]      = useState<string | null>(null);

  // Send modal
  const [sendOpen,       setSendOpen]       = useState(false);
  const [sendPdfUrl,     setSendPdfUrl]     = useState<string | null>(null);
  const [sendGenerating, setSendGenerating] = useState(false);
  const [sendCopied,     setSendCopied]     = useState(false);
  const [sendPhone,      setSendPhone]      = useState('');

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

  function openEdit(inv: InvoiceDetail['invoice']) {
    setEditNumber(inv.invoiceNumber);
    setEditDate(inv.invoiceDate);
    setEditDueDate(inv.dueDate ?? '');
    setEditSubtotal(String(inv.subtotalPaise / 100));
    setEditGstType(inv.isInterstate ? 'interstate' : inv.cgstPaise > 0 ? 'intrastate' : 'none');
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    const sub = Math.round(parseFloat(editSubtotal || '0') * 100);
    if (sub <= 0 || !editNumber.trim() || !editDate) {
      setEditError('Invoice number, date, and amount are required.');
      return;
    }
    setEditSubmitting(true); setEditError(null);
    try {
      const res = await fetch(`/api/v1/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: editNumber.trim(),
          invoiceDate:   editDate,
          dueDate:       editDueDate || null,
          subtotalPaise: sub,
          isInterstate:  editGstType === 'interstate',
          noGst:         editGstType === 'none',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setEditError(b?.error ?? 'Failed to update invoice.');
        return;
      }
      setEditOpen(false);
      loadInvoice();
    } catch { setEditError('Network error. Try again.'); }
    finally { setEditSubmitting(false); }
  }

  async function openSend() {
    setSendOpen(true);
    setSendPdfUrl(null);
    setSendCopied(false);
    setSendGenerating(true);
    try {
      if (detail?.invoice.pdfUrl) {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`);
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) setSendPdfUrl(b.data.pdfUrl as string);
      } else {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`, { method: 'POST' });
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) { setSendPdfUrl(b.data.pdfUrl as string); loadInvoice(); }
      }
    } catch {}
    finally { setSendGenerating(false); }
  }

  async function handlePdfDownload() {
    setPdfError(null); setPdfGenerating(true);
    try {
      if (detail?.invoice.pdfUrl) {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`);
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) window.open(b.data.pdfUrl as string, '_blank');
      } else {
        const r = await fetch(`/api/v1/invoices/${id}/pdf`, { method: 'POST' });
        const b = await r.json();
        if (r.ok && b?.data?.pdfUrl) { window.open(b.data.pdfUrl as string, '_blank'); loadInvoice(); }
        else setPdfError('PDF generation failed');
      }
    } catch { setPdfError('Network error'); }
    finally { setPdfGenerating(false); }
  }

  async function handleReceiptDownload() {
    setReceiptLoading(true);
    try {
      const r = await fetch(`/api/v1/payments/${lastPaymentId}/receipt`, { method: 'POST' });
      const b = await r.json();
      if (r.ok && b?.data?.pdfUrl) window.open(b.data.pdfUrl as string, '_blank');
    } finally { setReceiptLoading(false); }
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

  const status    = invoice.status ?? 'draft';
  const statusCfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const isDraft   = status === 'draft';
  const canSend   = status !== 'draft' && status !== 'void';
  const canPay    = !isFullyPaid && status !== 'void';
  const canVoid   = status !== 'paid' && status !== 'void';

  // Edit GST preview
  const editSub   = Math.round(parseFloat(editSubtotal || '0') * 100);
  const editCgst  = editGstType === 'intrastate' ? Math.round(editSub * 0.09) : 0;
  const editSgst  = editGstType === 'intrastate' ? Math.round(editSub * 0.09) : 0;
  const editIgst  = editGstType === 'interstate'  ? Math.round(editSub * 0.18) : 0;
  const editTotal = editSub + editCgst + editSgst + editIgst;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">

      {/* ── Top bar: breadcrumb + action buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70 flex-shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Link>
          <span style={{ color: 'var(--border-subtle)' }}>/</span>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>
            {invoice.invoiceNumber}
          </span>
        </div>

        {/* Top action buttons — matches reference */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <button
              onClick={() => openEdit(invoice)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          <button
            onClick={handlePdfDownload}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)] disabled:opacity-60"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PDF
          </button>
          {pdfError && <span className="text-xs" style={{ color: 'var(--danger)' }}>{pdfError}</span>}
          <button
            onClick={openSend}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#059669' }}
            title={isDraft ? 'Issue the invoice before sending' : status === 'void' ? 'Voided invoice cannot be sent' : ''}
          >
            <Send className="h-3.5 w-3.5" /> Send Invoice
          </button>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div
        className="rounded-2xl border p-6 mb-6"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                {invoice.invoiceNumber}
              </h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: statusCfg.bg, color: statusCfg.text }}
              >
                {statusCfg.icon} {statusCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {project?.clientName && (
                <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <Building2 className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  {project.clientName}
                </span>
              )}
              {project && (
                <Link href={`/projects/${project.id}`} className="flex items-center gap-1.5 hover:underline" style={{ color: 'var(--accent-base)' }}>
                  <FileText className="h-3.5 w-3.5" /> {project.name} <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
              )}
              {sourceMilestone && (
                <Link href={`/projects/${sourceMilestone.projectId}/payments`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: 'var(--text-secondary)' }}>
                  Milestone: {sourceMilestone.label}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Issued {fmtDate(invoice.invoiceDate)}
              </span>
              {invoice.dueDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Due {fmtDate(invoice.dueDate)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Invoice Total</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(totalPaise)}</p>
            {outstandingPaise > 0 && (
              <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--warning)' }}>{formatRupees(outstandingPaise)} outstanding</p>
            )}
            {isFullyPaid && <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--success)' }}>Fully collected</p>}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            <span>{isFullyPaid ? '✓ Fully paid' : `${paidPct}% collected`}</span>
            <span className="tabular-nums">{formatRupees(paidPaise)} of {formatRupees(totalPaise)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${paidPct}%`, background: isFullyPaid ? 'var(--success)' : 'var(--accent-base)' }} />
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* LEFT */}
        <div className="space-y-6">
          {/* Amount Breakdown */}
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
                <AmountRow label="Paid so far" value={formatRupees(paidPaise)} tone={paidPaise > 0 ? 'pos' : 'default'} />
                <div className="mt-2">
                  <AmountRow label="Balance due" value={formatRupees(outstandingPaise)} tone={outstandingPaise > 0 ? 'warn' : 'pos'} strong />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Payments Received */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Payments Received
              </h2>
              {canPay && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--accent-base)' }}
                >
                  <Plus className="h-3.5 w-3.5" /> Record payment
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
              {payments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <IndianRupee className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No payments recorded yet.</p>
                  {canPay && (
                    <button onClick={() => setDrawerOpen(true)} className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--accent-base)' }}>
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
                          <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: InvoicePayment) => {
                        const ep = p as ExtendedPayment;
                        const isManual  = !!p.manualOverrideBy;
                        const captured  = p.status === 'captured';
                        const displayDate = ep.receivedAt ?? ep.reconciledAt ?? p.createdAt;
                        const reference   = ep.reference ?? p.razorpayPaymentId ?? null;
                        const noteText    = ep.note ?? p.manualOverrideNote ?? null;
                        const modeName    = ep.mode ?? (isManual ? 'Manual' : p.razorpayLinkId ? 'Razorpay' : '—');
                        return (
                          <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-3.5 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDate(displayDate)}</td>
                            <td className="px-4 py-3.5 font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(p.amountPaise)}</td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                                style={{ background: captured ? '#f0fdf4' : 'var(--surface-muted)', color: captured ? '#15803d' : 'var(--text-secondary)' }}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {isManual ? <><HandCoins className="h-3.5 w-3.5" /> {modeName}</>
                                  : p.razorpayPaymentId ? <><Zap className="h-3.5 w-3.5 text-blue-500" /> Razorpay <ExternalLink className="h-3 w-3 opacity-60" /></>
                                  : <><Receipt className="h-3.5 w-3.5 opacity-60" /> {modeName}</>}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5 max-w-[220px]">
                                {reference && <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{reference}</span>}
                                {noteText   && <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{noteText}</span>}
                                {!reference && !noteText && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
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

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Invoice Status */}
          <div className="rounded-2xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Invoice Status</p>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: statusCfg.dot }} />
              <span className="text-sm font-semibold" style={{ color: statusCfg.text }}>{statusCfg.label}</span>
            </div>
            <dl className="space-y-2 text-xs">
              <MetaRow label="Invoice #"    value={invoice.invoiceNumber} />
              <MetaRow label="Invoice date" value={fmtDate(invoice.invoiceDate)} />
              {invoice.dueDate  && <MetaRow label="Due date"  value={fmtDate(invoice.dueDate)} />}
              {invoice.issuedAt && <MetaRow label="Issued on" value={fmtDate(invoice.issuedAt)} />}
              {invoice.voidedAt && <MetaRow label="Voided on" value={fmtDate(invoice.voidedAt)} />}
              {invoice.voidReason && (
                <div className="pt-1">
                  <dt className="mb-0.5" style={{ color: 'var(--text-secondary)' }}>Void reason</dt>
                  <dd className="text-xs" style={{ color: 'var(--danger)' }}>{invoice.voidReason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* GST Details */}
          <div className="rounded-2xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>GST Details</p>
            <dl className="space-y-2 text-xs">
              <MetaRow label="Supply type"     value={invoice.isInterstate ? 'Interstate (IGST)' : 'Intra-state (CGST + SGST)'} />
              <MetaRow label="Place of supply" value={invoice.placeOfSupply ?? '—'} />
              {invoice.isInterstate
                ? <MetaRow label="IGST (18%)" value={formatRupees(invoice.igstPaise)} />
                : <><MetaRow label="CGST (9%)" value={formatRupees(invoice.cgstPaise)} /><MetaRow label="SGST (9%)" value={formatRupees(invoice.sgstPaise)} /></>
              }
              <MetaRow label="Total tax" value={formatRupees(invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise)} />
            </dl>
            {invoice.irn && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>IRN</p>
                <p className="text-[10px] font-mono break-all leading-snug" style={{ color: 'var(--text-secondary)' }}>{invoice.irn}</p>
              </div>
            )}
            {invoice.qrCodeUrl && (
              <div className="mt-3 flex justify-center">
                <Image src={invoice.qrCodeUrl} alt="e-Invoice QR" width={100} height={100} className="rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }} />
              </div>
            )}
          </div>

          {/* Quick Activity — matches reference */}
          <div className="rounded-2xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Quick Activity</p>
            <div className="space-y-1">
              {/* Download PDF */}
              <button
                onClick={handlePdfDownload}
                disabled={pdfGenerating}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
                style={{ color: 'var(--text-heading)' }}
              >
                {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: 'var(--accent-base)' }} /> : <Download className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-base)' }} />}
                Download PDF
              </button>

              {/* Send Invoice */}
              <button
                onClick={openSend}
                disabled={!canSend}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50"
                style={{ color: 'var(--text-heading)' }}
                title={isDraft ? 'Issue the invoice first' : ''}
              >
                <Send className="h-4 w-4 flex-shrink-0" style={{ color: '#059669' }} />
                Send Invoice
              </button>

              {/* Record Payment */}
              <button
                onClick={() => setDrawerOpen(true)}
                disabled={!canPay}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50"
                style={{ color: 'var(--text-heading)' }}
              >
                <IndianRupee className="h-4 w-4 flex-shrink-0" style={{ color: '#10b981' }} />
                Record Payment
              </button>

              {/* Receipt */}
              {lastPaymentId && (
                <button
                  onClick={handleReceiptDownload}
                  disabled={receiptLoading}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  style={{ color: 'var(--text-heading)' }}
                >
                  {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Receipt className="h-4 w-4 flex-shrink-0" style={{ color: '#059669' }} />}
                  Download Receipt
                </button>
              )}
            </div>

            {/* Divider + secondary actions */}
            {(isDraft || canVoid) && (
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {isDraft && (
                  <button
                    onClick={issueInvoice}
                    disabled={issuing}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    style={{ color: 'var(--accent-base)' }}
                  >
                    {issuing ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Zap className="h-4 w-4 flex-shrink-0" />}
                    Issue Invoice
                  </button>
                )}
                {canVoid && (
                  <button
                    onClick={() => { setVoidReason(''); setVoidOpen(true); }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Ban className="h-4 w-4 flex-shrink-0" /> Void Invoice
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RecordPaymentDrawer ── */}
      <RecordPaymentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(_paymentId) => { setDrawerOpen(false); loadInvoice(); }}
        defaultInvoiceId={id}
        defaultProjectId={detail?.invoice.projectId}
        contextLabel={detail ? `${detail.invoice.invoiceNumber}${detail.project?.name ? ` — ${detail.project.name}` : ''}` : undefined}
      />

      {/* ── Void modal ── */}
      {voidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => { if (!voiding) setVoidOpen(false); }}>
          <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Void invoice</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>A voided invoice cannot be collected. Provide a reason:</p>
            <Textarea rows={3} placeholder="e.g. Duplicate, issued in error, superseded by revised invoice"
              value={voidReason} onChange={(e) => setVoidReason(e.target.value)} disabled={voiding} />
            {voidError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{voidError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={voiding}>Cancel</Button>
              <Button onClick={doVoid} disabled={voiding || !voidReason.trim()} style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}>
                {voiding ? 'Voiding…' : 'Void invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit drawer (draft only) ── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => { if (!editSubmitting) setEditOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Edit Invoice</h2>
              <button onClick={() => setEditOpen(false)} disabled={editSubmitting} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✕</button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Invoice Number *</label>
                  <input type="text" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Invoice Date *</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="studio-input h-9 w-full px-3" />
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Due Date</label>
                <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="studio-input h-9 w-full px-3" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount before GST (₹) *</label>
                <input type="number" min="0" step="0.01" value={editSubtotal} onChange={(e) => setEditSubtotal(e.target.value)} className={inputCls} placeholder="e.g. 50000" />
              </div>
              <div>
                <label className={`${labelCls} mb-2`} style={{ color: 'var(--text-secondary)' }}>GST Type</label>
                <div className="flex flex-wrap gap-4">
                  {(['none', 'intrastate', 'interstate'] as const).map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" checked={editGstType === t} onChange={() => setEditGstType(t)} className="accent-purple-600" />
                      <span className="text-sm" style={{ color: 'var(--text-heading)' }}>
                        {t === 'none' ? 'No GST' : t === 'intrastate' ? 'Intrastate (CGST + SGST)' : 'Interstate (IGST)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {/* GST preview */}
              {editSub > 0 && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--surface-muted)' }}>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span className="tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>{formatRupees(editSub)}</span></div>
                  {editCgst > 0 && <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-secondary)' }}>CGST 9%</span><span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(editCgst)}</span></div>}
                  {editSgst > 0 && <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-secondary)' }}>SGST 9%</span><span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(editSgst)}</span></div>}
                  {editIgst > 0 && <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-secondary)' }}>IGST 18%</span><span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(editIgst)}</span></div>}
                  <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                    <span>Total</span><span className="tabular-nums">{formatRupees(editTotal)}</span>
                  </div>
                </div>
              )}
              {editError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{editError}</p>}
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editSubmitting || !editNumber.trim() || !editDate || editSub <= 0} style={{ background: 'var(--accent-base)', color: '#fff', border: 'none' }}>
                {editSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Invoice modal ── */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSendOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Send Invoice</h2>
              <button onClick={() => setSendOpen(false)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--surface-muted)' }}>
                <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{invoice.invoiceNumber}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{project?.clientName ?? project?.name ?? '—'} · {formatRupees(totalPaise)}</p>
              </div>

              {/* PDF link */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Invoice PDF</p>
                {sendGenerating ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…
                  </div>
                ) : sendPdfUrl ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(sendPdfUrl);
                        setSendCopied(true);
                        setTimeout(() => setSendCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                      {sendCopied ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} /> : <Copy className="h-3.5 w-3.5" />}
                      {sendCopied ? 'Copied!' : 'Copy link'}
                    </button>
                    <a href={sendPdfUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <Download className="h-3.5 w-3.5" /> Open PDF
                    </a>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>Failed to generate PDF. Try downloading directly.</p>
                )}
              </div>

              {/* WhatsApp section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Send via WhatsApp</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="studio-input h-9 flex-1 text-sm"
                  />
                  <a
                    href={sendPdfUrl && sendPhone
                      ? `https://wa.me/${sendPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Dear ${project?.clientName ?? 'Sir/Madam'},\n\nGreetings from Konst Design!\n\nPlease find your invoice details below:\n\n` +
                          `*Invoice No:* ${invoice.invoiceNumber}\n` +
                          (project?.name ? `*Project:* ${project.name}\n` : '') +
                          `*Amount:* ${formatRupees(totalPaise)}\n` +
                          (invoice.dueDate ? `*Due Date:* ${fmtDate(invoice.dueDate)}\n` : '') +
                          `\n*Download Invoice PDF:*\n${sendPdfUrl}\n\n` +
                          `For any queries, please feel free to contact us.\n\nThank you,\nTeam Konst Design`
                        )}`
                      : undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!sendPdfUrl || !sendPhone) e.preventDefault(); }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-90"
                    style={{ background: '#25D366', opacity: sendPdfUrl && sendPhone ? 1 : 0.5, pointerEvents: sendPdfUrl && sendPhone ? 'auto' : 'none' }}
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </a>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Opens WhatsApp with the PDF link pre-filled.</p>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <Button variant="outline" onClick={() => setSendOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>{title}</h2>
      {children}
    </div>
  );
}

function AmountRow({ label, value, strong = false, tone = 'default', accent = false }: {
  label: string; value: string; strong?: boolean; tone?: 'default' | 'pos' | 'warn'; accent?: boolean;
}) {
  const valColor = accent ? 'var(--accent-base)' : tone === 'pos' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--text-heading)';
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'font-semibold' : ''} style={{ color: strong ? 'var(--text-heading)' : 'var(--text-secondary)' }}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-medium'}`} style={{ color: valColor }}>{value}</dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd className="text-right" style={{ color: 'var(--text-heading)', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}
