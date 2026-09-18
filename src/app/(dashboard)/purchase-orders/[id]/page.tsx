'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, CheckCircle, Clock, CalendarDays, Download, MessageCircle, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRupees } from '@/lib/utils';
import type { PurchaseOrder, GRN, POLine, POStatus } from '@/types/purchase-orders';

/* ── Extended type returned by the enriched GET route ─────────────────────── */
interface EnrichedPO extends PurchaseOrder {
  vendorName: string | null;
  projectName: string | null;
}

/* ── Status config ────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<POStatus, { badge: string; label: string }> = {
  draft:        { badge: 'bg-gray-100 text-gray-600',       label: 'Draft' },
  sent:         { badge: 'bg-purple-100 text-purple-700',   label: 'Sent' },
  acknowledged: { badge: 'bg-amber-100 text-amber-700',     label: 'Acknowledged' },
  partial:      { badge: 'bg-teal-100 text-teal-700',       label: 'Partial' },
  complete:     { badge: 'bg-emerald-100 text-emerald-700', label: 'Complete' },
  cancelled:    { badge: 'bg-red-100 text-red-600',         label: 'Cancelled' },
};

const NEXT_STATUS: Partial<Record<POStatus, { status: POStatus; label: string }>> = {
  draft:        { status: 'sent',         label: 'Mark as Sent' },
  sent:         { status: 'acknowledged', label: 'Mark as Acknowledged' },
  acknowledged: { status: 'partial',      label: 'Mark as Partial' },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function parseLines(raw: unknown): POLine[] {
  if (Array.isArray(raw)) return raw as POLine[];
  if (typeof raw === 'string') {
    try {
      const p: unknown = JSON.parse(raw);
      if (Array.isArray(p)) return p as POLine[];
    } catch { /* ignore */ }
  }
  return [];
}

function daysFrom(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── GRN form ─────────────────────────────────────────────────────────────── */
interface GRNForm { qty: string; notes: string }

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [po, setPo]           = useState<EnrichedPO | null>(null);
  const [grns, setGrns]       = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNF]     = useState(false);

  const [grnOpen, setGrnOpen]     = useState(false);
  const [grnForm, setGrnForm]     = useState<GRNForm>({ qty: '', notes: '' });
  const [grnSaving, setGrnSaving] = useState(false);
  const [grnError, setGrnError]   = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [waLoading, setWaLoading]       = useState(false);
  const [waMsg, setWaMsg]               = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, grnRes] = await Promise.all([
        fetch(`/api/v1/purchase-orders/${id}`),
        fetch(`/api/v1/purchase-orders/${id}/grn`),
      ]);
      if (poRes.status === 404) { setNF(true); return; }
      const { data: poData }  = (await poRes.json()) as { data: EnrichedPO };
      const { data: grnData } = (await grnRes.json()) as { data: GRN[] };
      setPo(poData ?? null);
      setGrns(grnData ?? []);
    } catch { /* leave state */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* ── Download PDF ── */
  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/pdf`);
      if (!res.ok) { alert('PDF generation failed.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${po?.poNumber ?? 'PO'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setPdfLoading(false); }
  }

  /* ── Send on WhatsApp ── */
  async function sendWhatsApp() {
    setWaLoading(true);
    setWaMsg(null);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/whatsapp`, { method: 'POST' });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok) {
        setWaMsg({ ok: true, text: 'Purchase order sent on WhatsApp.' });
      } else {
        setWaMsg({ ok: false, text: body.error ?? 'Failed to send.' });
      }
    } catch {
      setWaMsg({ ok: false, text: 'Network error — please try again.' });
    } finally { setWaLoading(false); }
  }

  /* ── Advance status ── */
  async function advanceStatus(newStatus: POStatus) {
    if (!po) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Merge only status — preserve enriched fields (vendorName, projectName)
        // that the raw PATCH response does not include.
        setPo(prev => prev ? { ...prev, status: newStatus } : prev);
      }
    } finally { setStatusSaving(false); }
  }

  /* ── Add GRN ── */
  async function submitGRN() {
    setGrnError(null);
    const qty = parseInt(grnForm.qty, 10);
    if (!grnForm.qty || isNaN(qty) || qty <= 0) {
      setGrnError('Delivered quantity must be a positive number.');
      return;
    }
    setGrnSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveredQty: qty, notes: grnForm.notes.trim() || undefined }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setGrnError(error ?? 'Failed to record GRN.');
        return;
      }
      const { data: newGrn } = (await res.json()) as { data: GRN };
      setGrns(prev => [...prev, newGrn]);
      setGrnOpen(false);
      setGrnForm({ qty: '', notes: '' });
      // Refresh PO so the status badge reflects the server-computed partial/complete update
      void load();
    } catch { setGrnError('Network error — please try again.'); }
    finally { setGrnSaving(false); }
  }

  /* ── Guards ── */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <p className="text-sm text-[var(--text-secondary)]">Loading purchase order…</p>
      </div>
    );
  }

  if (notFound || !po) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-red-500">Purchase order not found.</p>
        <Link href="/purchase-orders">
          <button className="btn-secondary">Back to Purchase Orders</button>
        </Link>
      </div>
    );
  }

  /* ── Derived ── */
  const lines      = parseLines(po.linesJson);
  const totalPaise = lines.reduce((s, l) => s + l.totalPaise, 0);

  const receivedByLine: Record<string, number> = {};
  for (const grn of grns) {
    if (grn.lineId) receivedByLine[grn.lineId] = (receivedByLine[grn.lineId] ?? 0) + grn.deliveredQty;
  }

  const receivedPaise = lines.reduce((s, l) => s + (receivedByLine[l.id] ?? 0) * l.unitRatePaise, 0);
  const pendingPaise  = Math.max(0, totalPaise - receivedPaise);

  const sc      = STATUS_CFG[po.status];
  const nextStep = NEXT_STATUS[po.status];
  const days     = po.expectedDeliveryAt ? daysFrom(po.expectedDeliveryAt) : null;

  /* ── Render ── */
  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <Link href="/purchase-orders" className="hover:text-[var(--text-primary)] transition-colors">
              Purchase Orders
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">{po.poNumber}</span>
          </nav>

          {(po.vendorName || po.projectName) && (
            <p className="mb-1.5 text-sm text-[var(--text-secondary)]">
              {po.vendorName && <span className="font-medium text-[var(--text-primary)]">{po.vendorName}</span>}
              {po.vendorName && po.projectName && <span> · </span>}
              {po.projectName && <span>{po.projectName}</span>}
              {po.expectedDeliveryAt && (
                <span> · Expected by {shortDate(po.expectedDeliveryAt)}</span>
              )}
            </p>
          )}

          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-heading)]">
            {po.poNumber}
          </h1>
        </div>

        {/* Right actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sc.badge}`}>
            {sc.label}
          </span>
          <span className="text-xl font-bold text-[var(--text-heading)]">
            {formatRupees(totalPaise)}
          </span>

          <button
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </button>

          <button
            onClick={sendWhatsApp}
            disabled={waLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4" />
            {waLoading ? 'Sending…' : 'Send on WhatsApp'}
          </button>
        </div>
      </div>

      {/* WhatsApp result banner */}
      {waMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${waMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {waMsg.text}
          <button onClick={() => setWaMsg(null)} className="ml-3 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--text-secondary)]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ordered</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)]">{formatRupees(totalPaise)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{lines.length} line item{lines.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Received</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatRupees(receivedPaise)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{grns.length} GRN{grns.length !== 1 ? 's' : ''} recorded</p>
        </div>

        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Clock className={`h-4 w-4 ${pendingPaise > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Pending</p>
          </div>
          <p className={`text-2xl font-bold ${pendingPaise > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatRupees(pendingPaise)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {pendingPaise > 0 ? 'yet to receive' : 'fully received'}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--text-secondary)]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Expected By</p>
          </div>
          {po.expectedDeliveryAt ? (
            <>
              <p className="text-lg font-bold text-[var(--text-heading)]">
                {shortDate(po.expectedDeliveryAt)}
              </p>
              {days !== null && (
                <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  days < 0 ? 'bg-red-100 text-red-600'
                  : days <= 3 ? 'bg-amber-100 text-amber-700'
                  : 'bg-teal-100 text-teal-700'
                }`}>
                  {days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Not set</p>
          )}
        </div>
      </div>

      {/* ── Line Items ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Line Items
        </h2>
        <div className="premium-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="px-5 py-3">Description</th>
                <th className="px-4 py-3 text-right">Ordered</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
                    No line items.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => {
                  const recv    = receivedByLine[line.id] ?? 0;
                  const pending = Math.max(0, line.qty - recv);
                  return (
                    <tr key={line.id ?? idx} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-[var(--text-heading)]">{line.description}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {line.materialId ? 'From catalogue' : 'Not in catalogue'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-teal-600">{line.qty}</span>
                        <span className="ml-1 text-xs text-[var(--text-secondary)]">{line.unit}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${recv > 0 ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>
                          {recv}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {pending}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-[var(--text-primary)]">
                        {formatRupees(line.unitRatePaise)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-[var(--text-heading)]">
                        {formatRupees(line.totalPaise)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                  <td colSpan={5} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Total
                  </td>
                  <td className="px-5 py-3 text-right text-base font-bold text-[var(--text-heading)]">
                    {formatRupees(totalPaise)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ── Smart Status CTA ── */}
      {nextStep && po.status !== 'cancelled' && (
        <div className="premium-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {po.status === 'draft' && (
              <>
                Ready to send this order{' '}
                {po.vendorName
                  ? <>to <span className="font-semibold text-[var(--text-primary)]">{po.vendorName}</span>?</>
                  : 'to the vendor?'}
              </>
            )}
            {po.status === 'sent'         && 'Order sent. Mark acknowledged once the vendor confirms.'}
            {po.status === 'acknowledged' && 'Vendor has acknowledged. Record GRN when delivery arrives.'}
          </p>
          <button
            onClick={() => advanceStatus(nextStep.status)}
            disabled={statusSaving}
            className="shrink-0 rounded-xl bg-[var(--teal,#0d9488)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {statusSaving ? 'Saving…' : nextStep.label}
          </button>
        </div>
      )}

      {/* ── Goods Received Notes ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Goods Received Notes
            </h2>
            {grns.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {grns.length} entr{grns.length === 1 ? 'y' : 'ies'} · Total received:{' '}
                <span className="font-semibold text-emerald-600">
                  {grns.reduce((s, g) => s + g.deliveredQty, 0)} units
                </span>
              </p>
            )}
          </div>
        </div>

        {grns.length === 0 ? (
          <div className="premium-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)]">
              <Package className="h-6 w-6 text-[var(--text-secondary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No GRNs recorded yet</p>
              <p className="text-xs text-[var(--text-secondary)]">Record deliveries as goods arrive from the vendor</p>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              onClick={() => { setGrnForm({ qty: '', notes: '' }); setGrnError(null); setGrnOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              Add First GRN
            </button>
          </div>
        ) : (
          <>
            <div className="premium-card overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-5 py-3">Delivered Qty</th>
                    <th className="px-4 py-3">Received At</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.map(grn => (
                    <tr key={grn.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-5 py-3 font-semibold text-emerald-600">{grn.deliveredQty}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {new Date(grn.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{grn.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                onClick={() => { setGrnForm({ qty: '', notes: '' }); setGrnError(null); setGrnOpen(true); }}
              >
                <Plus className="h-4 w-4" />
                Add GRN
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Vendor Bills / Advance ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Vendor Bills
        </h2>
        <div className="premium-card px-5 py-5">
          {po.advancePaidPaise > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Advance paid</span>
              <span className="font-semibold text-[var(--text-heading)]">{formatRupees(po.advancePaidPaise)}</span>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">No vendor bills yet.</p>
          )}
        </div>
      </section>

      {/* ── Add GRN Dialog ── */}
      <Dialog open={grnOpen} onOpenChange={setGrnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Goods Received</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="grn-qty">Delivered Quantity</Label>
              <Input
                id="grn-qty"
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 5"
                value={grnForm.qty}
                onChange={e => setGrnForm(p => ({ ...p, qty: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grn-notes">Notes (optional)</Label>
              <Textarea
                id="grn-notes"
                placeholder="Delivery condition, batch number, remarks…"
                rows={3}
                value={grnForm.notes}
                onChange={e => setGrnForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            {grnError && <p className="text-xs text-red-600">{grnError}</p>}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button
              onClick={() => setGrnOpen(false)}
              disabled={grnSaving}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={submitGRN}
              disabled={grnSaving}
              className="flex-1 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {grnSaving ? 'Saving…' : 'Record GRN'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
