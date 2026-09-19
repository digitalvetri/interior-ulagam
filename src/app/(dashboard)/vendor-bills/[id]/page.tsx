'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, ChevronRight, Clock, ExternalLink,
  IndianRupee, MoreVertical, Paperclip, Printer, Trash2, Upload, XCircle,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GrnEvent {
  grnNumber:    string | null;
  deliveryDate: string | null;
  receivedAt:   string;
  lineCount:    number;
}

interface BillPayment {
  id:              string;
  amountPaise:     number;
  method:          string | null;
  reference:       string | null;
  note:            string | null;
  paidAt:          string;
}

interface BillDetail {
  bill: {
    id:             string;
    expenseNumber:  string | null;
    description:    string | null;
    amountPaise:    number;
    gstPct:         number;
    gstAmountPaise: number;
    dueDate:        string | null;
    voidedAt:       string | null;
    vendorName:     string | null;
    receiptUrl:     string | null;
    createdAt:      string;
  };
  po: {
    id:          string;
    poNumber:    string;
    status:      string;
    vendorName:  string | null;
    vendorId:    string | null;
    projectId:   string | null;
    projectName: string | null;
  } | null;
  grnEvents:  GrnEvent[];
  payments:   BillPayment[];
  derived: {
    totalPaise:   number;
    paidPaise:    number;
    balancePaise: number;
    status:       'void' | 'paid' | 'partial' | 'unpaid';
  };
}

// ─── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  unpaid:  { badge: 'bg-amber-100 text-amber-700',    label: 'Unpaid'  },
  partial: { badge: 'bg-blue-100 text-blue-700',      label: 'Partial' },
  paid:    { badge: 'bg-emerald-100 text-emerald-700',label: 'Paid'    },
  void:    { badge: 'bg-gray-100 text-gray-500',      label: 'Void'    },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.startsWith('20') && iso.length >= 10
    ? iso.slice(0, 10).split('-').map(Number)
    : [0, 0, 0];
  if (!y) return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pct(paidPaise: number, totalPaise: number) {
  if (!totalPaise) return 0;
  return Math.min(100, Math.round((paidPaise / totalPaise) * 100));
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function VendorBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData]       = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNF]     = useState(false);

  // Pay dialog
  const [payOpen, setPayOpen]       = useState(false);
  const [payAmount, setPayAmount]   = useState('');
  const [payMethod, setPayMethod]   = useState('');
  const [payRef, setPayRef]         = useState('');
  const [payNote, setPayNote]       = useState('');
  const [payDate, setPayDate]       = useState('');
  const [paySubmitting, setPaySubmit] = useState(false);
  const [payError, setPayError]     = useState<string | null>(null);

  // Void confirm
  const [voidOpen, setVoidOpen]       = useState(false);
  const [voidSubmitting, setVoidSubmit] = useState(false);
  const [voidError, setVoidError]     = useState<string | null>(null);

  // Receipt upload
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError]         = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Three-dot menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/vendor-bills/${id}`);
      if (res.status === 404) { setNF(true); return; }
      const { data: body } = (await res.json()) as { data: BillDetail };
      setData(body ?? null);
    } catch { /* leave state */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Record Payment ──────────────────────────────────────────────────────────

  function openPayDialog() {
    if (!data) return;
    setPayAmount((data.derived.balancePaise / 100).toFixed(0));
    setPayMethod('');
    setPayRef('');
    setPayNote('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayError(null);
    setPayOpen(true);
  }

  async function submitPayment() {
    setPayError(null);
    const amountPaise = Math.round(parseFloat(payAmount || '0') * 100);
    if (!amountPaise || amountPaise <= 0) { setPayError('Enter a valid amount.'); return; }
    setPaySubmit(true);
    try {
      const res = await fetch(`/api/v1/vendor-bills/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          method:    payMethod.trim() || undefined,
          reference: payRef.trim()    || undefined,
          note:      payNote.trim()   || undefined,
          paidAt:    payDate ? new Date(payDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setPayError(typeof error === 'string' ? error : 'Failed to record payment.');
        return;
      }
      setPayOpen(false);
      void load();
    } catch { setPayError('Network error — please try again.'); }
    finally { setPaySubmit(false); }
  }

  // ── Void ────────────────────────────────────────────────────────────────────

  async function submitVoid() {
    setVoidError(null);
    setVoidSubmit(true);
    try {
      const res = await fetch(`/api/v1/vendor-bills/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setVoidError(typeof error === 'string' ? error : 'Failed to void bill.');
        return;
      }
      setVoidOpen(false);
      void load();
    } catch { setVoidError('Network error — please try again.'); }
    finally { setVoidSubmit(false); }
  }

  // ── Receipt upload ──────────────────────────────────────────────────────────

  async function uploadReceipt(file: File) {
    setReceiptError(null);
    setReceiptUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/v1/vendor-bills/${id}/receipt`, { method: 'POST', body: form });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setReceiptError(typeof error === 'string' ? error : 'Upload failed.');
        return;
      }
      void load();
    } catch { setReceiptError('Network error — please try again.'); }
    finally {
      setReceiptUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  }

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <p className="text-sm text-[var(--text-secondary)]">Loading vendor bill…</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-red-500">Vendor bill not found.</p>
        <Link href="/vendor-payables" className="text-sm text-[var(--text-secondary)] underline">
          Back to Vendor Payables
        </Link>
      </div>
    );
  }

  const { bill, po, grnEvents, payments, derived } = data;
  const sc = STATUS_CFG[derived.status];
  const billDate = fmtDate(bill.createdAt);
  const canPay   = derived.status === 'unpaid' || derived.status === 'partial';
  const canVoid  = derived.status === 'unpaid';
  const progress = pct(derived.paidPaise, derived.totalPaise);

  return (
    <div className="p-6 space-y-6">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
        <Link href="/purchase-orders" className="hover:text-[var(--text-primary)] transition-colors">
          Purchase Orders
        </Link>
        {po && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href={`/purchase-orders/${po.id}`}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              {po.poNumber}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--text-primary)]">{bill.expenseNumber ?? 'Vendor Bill'}</span>
      </nav>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-heading)]">
              {bill.expenseNumber ?? 'Vendor Bill'}
            </h1>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sc.badge}`}>
              {sc.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {bill.vendorName ?? po?.vendorName ?? 'Unknown vendor'}
            {po && <span> · {po.poNumber}</span>}
            {po?.projectName && <span> · {po.projectName}</span>}
          </p>
        </div>
        <p className="text-2xl font-bold text-[var(--text-heading)]">
          {formatRupees(derived.totalPaise)}
        </p>
      </div>

      {/* ── PO → GRN → Bill context trail ── */}
      {(po || grnEvents.length > 0) && (
        <div className="premium-card px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Purchase Flow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {po && (
              <>
                <Link
                  href={`/purchase-orders/${po.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors"
                >
                  <span className="font-mono text-xs font-semibold">{po.poNumber}</span>
                  <ExternalLink className="h-3 w-3 text-[var(--text-secondary)]" />
                </Link>
                {(grnEvents.length > 0 || true) && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                )}
              </>
            )}
            {grnEvents.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {grnEvents.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-mono font-semibold text-teal-700">
                      {g.grnNumber ?? 'Legacy GRN'}
                      {g.deliveryDate && (
                        <span className="ml-1.5 font-normal text-teal-600">
                          {fmtDate(g.deliveryDate)}
                        </span>
                      )}
                    </span>
                    {i < grnEvents.length - 1 && (
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    )}
                  </div>
                ))}
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
              </div>
            ) : (
              <span className="text-xs text-[var(--text-secondary)] italic">No GRNs recorded</span>
            )}
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-mono font-semibold text-amber-700">
              {bill.expenseNumber ?? 'This Bill'}
            </span>
          </div>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

        {/* ── LEFT ── */}
        <div className="space-y-6">

          {/* Bill Details */}
          <section className="premium-card px-5 py-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Bill Details
            </h2>
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-[var(--text-secondary)]">Bill #</dt>
              <dd className="font-mono font-semibold text-[var(--text-heading)]">
                {bill.expenseNumber ?? '—'}
              </dd>

              <dt className="text-[var(--text-secondary)]">Date</dt>
              <dd className="text-[var(--text-primary)]">{billDate}</dd>

              {bill.dueDate && (
                <>
                  <dt className="text-[var(--text-secondary)]">Due Date</dt>
                  <dd className="text-[var(--text-primary)]">{fmtDate(bill.dueDate)}</dd>
                </>
              )}

              <dt className="text-[var(--text-secondary)]">Vendor</dt>
              <dd className="text-[var(--text-primary)]">
                {bill.vendorName ?? po?.vendorName ?? '—'}
              </dd>

              {po?.projectName && (
                <>
                  <dt className="text-[var(--text-secondary)]">Project</dt>
                  <dd className="text-[var(--text-primary)]">{po.projectName}</dd>
                </>
              )}

              {bill.description && (
                <>
                  <dt className="text-[var(--text-secondary)]">Description</dt>
                  <dd className="text-[var(--text-primary)]">{bill.description}</dd>
                </>
              )}

              {bill.voidedAt && (
                <>
                  <dt className="text-[var(--text-secondary)]">Voided On</dt>
                  <dd className="font-medium text-red-600">{fmtDate(bill.voidedAt)}</dd>
                </>
              )}
            </dl>
          </section>

          {/* Amount Breakdown */}
          <section className="premium-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Amount Breakdown
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-5 py-3.5 text-[var(--text-secondary)]">Subtotal</td>
                  <td className="px-5 py-3.5 text-right font-medium text-[var(--text-primary)]">
                    {formatRupees(bill.amountPaise)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-5 py-3.5 text-[var(--text-secondary)]">
                    GST{bill.gstPct > 0 ? ` (${bill.gstPct}%)` : ''}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-[var(--text-primary)]">
                    {formatRupees(bill.gstAmountPaise)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-muted)]">
                  <td className="px-5 py-3.5 text-sm font-semibold text-[var(--text-heading)]">
                    Total
                  </td>
                  <td className="px-5 py-3.5 text-right text-base font-bold text-[var(--text-heading)]">
                    {formatRupees(derived.totalPaise)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Payment History */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Payment History
            </h2>
            {payments.length === 0 ? (
              <div className="premium-card flex flex-col items-center justify-center gap-2 py-10 text-center">
                <IndianRupee className="h-8 w-8 text-[var(--text-secondary)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">No payments recorded yet</p>
                {canPay && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Use "Record Payment" to log a payment against this bill.
                  </p>
                )}
              </div>
            ) : (
              <div className="premium-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Method</th>
                      <th className="px-4 py-3 text-left">Reference</th>
                      <th className="px-5 py-3 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-[var(--text-secondary)]">
                          {fmtDate(p.paidAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">
                          {formatRupees(p.amountPaise)}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--text-secondary)]">{p.method ?? '—'}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-secondary)] max-w-[140px] truncate">
                          {p.reference ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-secondary)]">{p.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                      <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] text-right">
                        Total Paid
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {formatRupees(derived.paidPaise)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT sidebar ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">

          {/* Payment Summary */}
          <div className="premium-card px-5 py-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Payment Summary
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Billed</span>
                <span className="font-semibold text-[var(--text-heading)]">{formatRupees(derived.totalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Paid</span>
                <span className="font-semibold text-emerald-600">{formatRupees(derived.paidPaise)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2">
                <span className="font-semibold text-[var(--text-heading)]">Balance</span>
                <span className={`text-base font-bold ${derived.balancePaise > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatRupees(derived.balancePaise)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{progress}% paid</span>
                {derived.status === 'paid' && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                  </span>
                )}
                {derived.status === 'partial' && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="h-3.5 w-3.5" /> Partial
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className={`h-2 rounded-full transition-all ${
                    derived.status === 'paid' ? 'bg-emerald-500' :
                    derived.status === 'partial' ? 'bg-blue-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Primary CTA */}
            {canPay && (
              <button
                onClick={openPayDialog}
                className="w-full rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Record Payment
              </button>
            )}

            {derived.status === 'paid' && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Fully Paid
              </div>
            )}

            {derived.status === 'void' && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500">
                <XCircle className="h-4 w-4" />
                Voided
              </div>
            )}
          </div>

          {/* Receipt / Bill Document */}
          <div className="premium-card px-5 py-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Receipt / Document
            </h2>
            {bill.receiptUrl ? (
              <div className="flex items-center justify-between gap-3">
                <a
                  href={`/api/v1/vendor-bills/${id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                  View Receipt
                </a>
                <button
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={receiptUploading}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => receiptInputRef.current?.click()}
                disabled={receiptUploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)] hover:border-teal-400 hover:text-teal-600 transition-colors disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {receiptUploading ? 'Uploading…' : 'Upload Receipt'}
              </button>
            )}
            {receiptError && <p className="text-xs text-red-600">{receiptError}</p>}
            <p className="text-[11px] text-[var(--text-tertiary)]">
              PDF, JPEG, or PNG · max 10 MB
            </p>
          </div>

          {/* Related + Actions */}
          <div className="premium-card px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Related
              </h2>

              {/* Three-dot menu */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-lg">
                    <button
                      onClick={() => { setMenuOpen(false); window.print(); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      <Printer className="h-4 w-4 text-[var(--text-secondary)]" />
                      Print
                    </button>
                    {canVoid && (
                      <button
                        onClick={() => { setMenuOpen(false); setVoidError(null); setVoidOpen(true); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Void Bill
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {po && (
                <div>
                  <p className="mb-0.5 text-xs text-[var(--text-secondary)]">Purchase Order</p>
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="inline-flex items-center gap-1.5 font-mono font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    {po.poNumber}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
              {po?.projectId && po.projectName && (
                <div>
                  <p className="mb-0.5 text-xs text-[var(--text-secondary)]">Project</p>
                  <Link
                    href={`/projects/${po.projectId}`}
                    className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] hover:text-teal-600 transition-colors"
                  >
                    {po.projectName}
                    <ExternalLink className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  </Link>
                </div>
              )}
              <div className="border-t border-[var(--border-subtle)] pt-3">
                <Link
                  href="/vendor-payables"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Vendor Payables
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden receipt file input */}
      <input
        ref={receiptInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void uploadReceipt(file);
        }}
      />

      {/* ── Record Payment dialog ── */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !paySubmitting && setPayOpen(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <h2 className="text-base font-bold text-[var(--text-heading)]">Record Payment</h2>
              <button
                onClick={() => !paySubmitting && setPayOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Remaining balance</span>
                  <span className="font-bold text-amber-600">{formatRupees(derived.balancePaise)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Amount (₹) *
                </label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="studio-input w-full h-10"
                  placeholder="e.g. 15000"
                  disabled={paySubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="studio-input w-full h-10"
                    disabled={paySubmitting}
                  >
                    <option value="">Select…</option>
                    {['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'Other'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setPayDate(e.target.value)}
                    className="studio-input w-full h-10"
                    disabled={paySubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Reference <span className="text-[var(--text-secondary)] normal-case font-normal">(UTR / cheque no.)</span>
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="studio-input w-full h-10"
                  placeholder="Optional"
                  disabled={paySubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Note
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="studio-input w-full h-10"
                  placeholder="Optional"
                  disabled={paySubmitting}
                />
              </div>

              {payError && <p className="text-xs text-red-600">{payError}</p>}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-6 py-4">
              <button
                onClick={() => !paySubmitting && setPayOpen(false)}
                disabled={paySubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-card)] transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paySubmitting || !payAmount || parseFloat(payAmount) <= 0}
                className="rounded-xl bg-[var(--teal,#0d9488)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {paySubmitting ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void confirmation dialog ── */}
      {voidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !voidSubmitting && setVoidOpen(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl">
            <div className="px-6 pt-6 pb-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-base font-bold text-[var(--text-heading)]">Void this bill?</h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                This marks <span className="font-semibold">{bill.expenseNumber}</span> as void and removes it from Vendor Payables. This cannot be undone.
              </p>
              {voidError && <p className="mt-3 text-xs text-red-600">{voidError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-6 py-4">
              <button
                onClick={() => !voidSubmitting && setVoidOpen(false)}
                disabled={voidSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-card)] transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitVoid}
                disabled={voidSubmitting}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {voidSubmitting ? 'Voiding…' : 'Void Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
