'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Download, ExternalLink, IndianRupee, Plus, Zap, HandCoins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRupees } from '@/lib/utils';
import type { InvoiceDetail, InvoicePayment } from '@/types/accounts';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [amountRupees, setAmountRupees] = useState('');
  const [note,         setNote]         = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

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

  function openDialog() {
    setAmountRupees('');
    setNote('');
    setSubmitError(null);
    setDialogOpen(true);
  }

  async function submitPayment() {
    setSubmitError(null);
    const rupees = Number(amountRupees.replace(/,/g, ''));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setSubmitError('Enter a valid amount in rupees.');
      return;
    }
    if (!note.trim()) {
      setSubmitError('A note is required (e.g. cheque #, UPI ref, cash receipt).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaise: Math.round(rupees * 100), note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.error ?? 'Failed to record payment.');
        return;
      }
      setDialogOpen(false);
      loadInvoice();
    } catch {
      setSubmitError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading invoice…</div>
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

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      {/* Header card */}
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Invoice
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
              {invoice.invoiceNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>
                Issued{' '}
                {new Date(invoice.invoiceDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>
              {project && (
                <>
                  <span style={{ color: 'var(--border-subtle)' }}>·</span>
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--accent-base)' }}
                  >
                    {project.name}
                  </Link>
                </>
              )}
              {sourceMilestone && (
                <>
                  <span style={{ color: 'var(--border-subtle)' }}>·</span>
                  <Link
                    href={`/projects/${sourceMilestone.projectId}/payments`}
                    className="hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Milestone: {sourceMilestone.label}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice.pdfUrl && (
              <a
                href={invoice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Download className="h-4 w-4" /> PDF
              </a>
            )}
            {!isFullyPaid && (
              <button
                onClick={openDialog}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent-base)' }}
              >
                <Plus className="h-4 w-4" /> Record payment
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span>{isFullyPaid ? 'Fully paid' : `${paidPct}% collected`}</span>
            <span>
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

      {/* Amount + Tax grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* Amounts */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
            Amount breakdown
          </h2>
          <dl className="space-y-3 text-sm">
            <AmountRow label="Subtotal" value={formatRupees(invoice.subtotalPaise)} />
            {invoice.isInterstate ? (
              <AmountRow label="IGST (18%)" value={formatRupees(invoice.igstPaise)} />
            ) : (
              <>
                <AmountRow label="CGST (9%)" value={formatRupees(invoice.cgstPaise)} />
                <AmountRow label="SGST (9%)" value={formatRupees(invoice.sgstPaise)} />
              </>
            )}
            <div className="pt-3" style={{ borderTop: '2px solid var(--border-subtle)' }}>
              <AmountRow label="Grand Total" value={formatRupees(totalPaise)} strong accent />
            </div>
            <div className="pt-1" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
              <AmountRow
                label="Paid"
                value={formatRupees(paidPaise)}
                tone={paidPaise > 0 ? 'pos' : 'default'}
              />
              <div className="mt-2">
                <AmountRow
                  label="Outstanding"
                  value={formatRupees(outstandingPaise)}
                  tone={outstandingPaise > 0 ? 'warn' : 'pos'}
                  strong
                />
              </div>
            </div>
          </dl>
        </div>

        {/* Tax details */}
        <div className="space-y-3">
          <div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Tax details
            </h2>
            <dl className="space-y-2 text-xs">
              <MetaRow label="Place of supply" value={invoice.placeOfSupply ?? '—'} />
              <MetaRow label="Supply type"     value={invoice.isInterstate ? 'Interstate (IGST)' : 'Intra-state (CGST + SGST)'} />
              <MetaRow label="IRN"             value={invoice.irn ?? 'Not generated'} monospace={!!invoice.irn} />
            </dl>
            {invoice.qrCodeUrl && (
              <div className="mt-4 flex justify-center">
                <Image
                  src={invoice.qrCodeUrl}
                  alt="Invoice QR"
                  width={110}
                  height={110}
                  className="rounded-lg border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payments table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Payments received
          </h2>
          {!isFullyPaid && (
            <button
              onClick={openDialog}
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
            <div className="flex items-center gap-3 px-5 py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <IndianRupee className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Date', 'Amount', 'Status', 'Source', 'Note / Reference'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: InvoicePayment) => {
                    const isManual = !!p.manualOverrideBy;
                    const captured = p.status === 'captured';
                    return (
                      <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(p.reconciledAt ?? p.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                          {formatRupees(p.amountPaise)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                            style={{
                              background: captured ? 'var(--success-soft)' : 'var(--surface-muted)',
                              color: captured ? 'var(--success)' : 'var(--text-secondary)',
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {isManual ? (
                              <><HandCoins className="h-3.5 w-3.5" /> Manual</>
                            ) : p.razorpayPaymentId ? (
                              <><Zap className="h-3.5 w-3.5 text-blue-500" /> Razorpay <ExternalLink className="h-3 w-3" /></>
                            ) : (
                              'Payment link'
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono truncate max-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
                          {p.manualOverrideNote ?? p.razorpayPaymentId ?? '—'}
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

      {/* Record payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="text"
                inputMode="decimal"
                placeholder={`Outstanding: ${formatRupees(outstandingPaise)}`}
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note</Label>
              <Textarea
                id="pay-note"
                placeholder="e.g. UPI reference 4a8b…, cheque #1234, cash receipt"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
              />
            </div>
            {submitError && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{submitError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={submitting}>
              {submitting ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function MetaRow({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd
        className={`text-right truncate max-w-[180px] ${monospace ? 'font-mono text-[10px]' : ''}`}
        style={{ color: 'var(--text-heading)' }}
      >
        {value}
      </dd>
    </div>
  );
}
