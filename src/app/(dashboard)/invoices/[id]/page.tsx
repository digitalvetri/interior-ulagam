'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Download, ExternalLink, IndianRupee, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRupees } from '@/lib/utils';
import type { InvoiceDetail, InvoicePayment } from '@/types/accounts';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Manual-payment dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountRupees, setAmountRupees] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Data fetch on mount — TanStack Query refactor tracked separately.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
        body: JSON.stringify({
          amountPaise: Math.round(rupees * 100),
          note: note.trim(),
        }),
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
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading invoice…</div>;
  }
  if (notFound || !detail) {
    return (
      <div className="p-6">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)]">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <p className="mt-4 text-sm text-red-600">Invoice not found.</p>
      </div>
    );
  }

  const { invoice, payments, project, sourceMilestone } = detail;
  const totalPaise =
    invoice.subtotalPaise + invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;
  const paidPaise = payments
    .filter((p: InvoicePayment) => p.status === 'captured')
    .reduce((s: number, p: InvoicePayment) => s + p.amountPaise, 0);
  const outstandingPaise = totalPaise - paidPaise;
  const isFullyPaid = outstandingPaise <= 0;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)] dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)] dark:text-white">
            {invoice.invoiceNumber}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Issued {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
            {project && (
              <>
                {' · '}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {project.name}
                </Link>
              </>
            )}
          </p>
          {sourceMilestone && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              From milestone:{' '}
              <Link
                href={`/projects/${sourceMilestone.projectId}/payments`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {sourceMilestone.label}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoice.pdfUrl && (
            <Button variant="outline" asChild>
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> Download PDF
              </a>
            </Button>
          )}
          {!isFullyPaid && (
            <Button onClick={openDialog}>
              <Plus className="mr-1.5 h-4 w-4" /> Record payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary grid: totals + GST */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 ">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Amount
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatRupees(invoice.subtotalPaise)} />
            {invoice.isInterstate ? (
              <Row label="IGST (18%)" value={formatRupees(invoice.igstPaise)} />
            ) : (
              <>
                <Row label="CGST (9%)" value={formatRupees(invoice.cgstPaise)} />
                <Row label="SGST (9%)" value={formatRupees(invoice.sgstPaise)} />
              </>
            )}
            <div className="mt-2 border-t border-[var(--border-subtle)] pt-3 ">
              <Row label="Total" value={formatRupees(totalPaise)} strong />
            </div>
            <Row label="Paid" value={formatRupees(paidPaise)} tone={paidPaise > 0 ? 'pos' : 'default'} />
            <Row
              label="Outstanding"
              value={formatRupees(outstandingPaise)}
              tone={outstandingPaise > 0 ? 'warn' : 'pos'}
              strong
            />
          </dl>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 ">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Tax details
            </h2>
            <dl className="mt-2 space-y-1 text-xs">
              <MetaRow label="Place of supply" value={invoice.placeOfSupply ?? '—'} />
              <MetaRow label="Interstate" value={invoice.isInterstate ? 'Yes' : 'No'} />
              <MetaRow label="IRN" value={invoice.irn ?? '—'} monospace />
            </dl>
            {invoice.qrCodeUrl && (
              <div className="mt-3 flex justify-center">
                <Image
                  src={invoice.qrCodeUrl}
                  alt="Invoice QR"
                  width={120}
                  height={120}
                  className="rounded border border-[var(--border-subtle)] "
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Payments
        </h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] ">
          {payments.length === 0 ? (
            <div className="flex items-center gap-3 p-5 text-sm text-[var(--text-secondary)]">
              <IndianRupee className="h-4 w-4 text-[var(--text-tertiary)]" />
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] ">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: InvoicePayment) => {
                  const isManual = !!p.manualOverrideBy;
                  return (
                    <tr key={p.id} className="border-b border-[var(--border-subtle)] last:border-b-0 ">
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {new Date(p.reconciledAt ?? p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--text-heading)] dark:text-white">
                        {formatRupees(p.amountPaise)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                            (p.status === 'captured'
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : 'bg-[var(--surface-muted)] text-[var(--text-primary)] ')
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] ">
                        {isManual ? (
                          <span className="inline-flex items-center gap-1">Manual entry</span>
                        ) : p.razorpayPaymentId ? (
                          <span className="inline-flex items-center gap-1 font-mono">
                            Razorpay
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        ) : (
                          'Payment link'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] ">
                        {p.manualOverrideNote ?? '—'}
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
              <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
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

function Row({
  label,
  value,
  strong = false,
  tone = 'default',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'default' | 'pos' | 'warn';
}) {
  const valClass =
    tone === 'pos'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-[var(--text-heading)] dark:text-white';
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'text-sm font-semibold text-[var(--text-heading)] dark:text-white' : 'text-sm text-[var(--text-secondary)]'}>
        {label}
      </dt>
      <dd className={`text-sm ${strong ? 'font-semibold' : ''} ${valClass}`}>
        {value}
      </dd>
    </div>
  );
}

function MetaRow({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className={`text-right text-[var(--text-heading)] dark:text-white ${monospace ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
