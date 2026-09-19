'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Package, CheckCircle, Clock, CalendarDays, Download, MessageCircle, Paperclip, Plus, ChevronDown, ChevronUp, FileText } from 'lucide-react';
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
import type { PurchaseOrder, GRN, GRNDeliveryGroup, POLine, POStatus } from '@/types/purchase-orders';
import type { Expense } from '@/types/accounts';

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

function shortDateLocal(dateStr: string) {
  // YYYY-MM-DD without timezone conversion
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupGRNs(items: GRN[]): GRNDeliveryGroup[] {
  const map = new Map<string, GRNDeliveryGroup>();
  const legacy: GRNDeliveryGroup = {
    grnNumber: null, deliveryDate: null, receivedByName: null, notes: null, receivedAt: '', rows: [],
  };

  for (const grn of items) {
    if (!grn.grnNumber) {
      if (!legacy.receivedAt) legacy.receivedAt = grn.receivedAt;
      legacy.rows.push(grn);
    } else {
      if (!map.has(grn.grnNumber)) {
        map.set(grn.grnNumber, {
          grnNumber:      grn.grnNumber,
          deliveryDate:   grn.deliveryDate,
          receivedByName: grn.receivedByName,
          notes:          grn.notes,
          receivedAt:     grn.receivedAt,
          rows:           [],
        });
      }
      map.get(grn.grnNumber)!.rows.push(grn);
    }
  }

  const result = [...map.values()];
  if (legacy.rows.length > 0) result.push(legacy);
  return result;
}

/* ── GRN modal line state ─────────────────────────────────────────────────── */
interface GRNLineInput {
  lineId:             string;
  description:        string;
  unit:               string;
  orderedQty:         number;
  previouslyReceived: number;
  pending:            number;
  receivedNow:        number;
}

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

  // GRN modal state
  const [grnOpen, setGrnOpen]               = useState(false);
  const [grnLines, setGrnLines]             = useState<GRNLineInput[]>([]);
  const [grnDeliveryDate, setGrnDeliveryDate] = useState('');
  const [grnNotes, setGrnNotes]             = useState('');
  const [grnSaving, setGrnSaving]           = useState(false);
  const [grnError, setGrnError]             = useState<string | null>(null);

  // GRN history expanded groups
  const [expandedGrns, setExpandedGrns] = useState<Set<string>>(new Set());

  // Vendor bill state
  const [vendorBills, setVendorBills]       = useState<Expense[]>([]);
  const [billOpen, setBillOpen]             = useState(false);
  const [billAmountRs, setBillAmountRs]     = useState('');
  const [billGstPct, setBillGstPct]         = useState(18);
  const [billDueDate, setBillDueDate]       = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billSaving, setBillSaving]         = useState(false);
  const [billError, setBillError]           = useState<string | null>(null);
  const [billReceiptFile, setBillReceiptFile] = useState<File | null>(null);
  const billReceiptRef = useRef<HTMLInputElement>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [waLoading, setWaLoading]       = useState(false);
  const [waMsg, setWaMsg]               = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, grnRes, billsRes] = await Promise.all([
        fetch(`/api/v1/purchase-orders/${id}`),
        fetch(`/api/v1/purchase-orders/${id}/grn`),
        fetch(`/api/v1/purchase-orders/${id}/vendor-bills`),
      ]);
      if (poRes.status === 404) { setNF(true); return; }
      const { data: poData }    = (await poRes.json()) as { data: EnrichedPO };
      const { data: grnData }   = (await grnRes.json()) as { data: GRN[] };
      const { data: billsData } = (await billsRes.json()) as { data: Expense[] };
      setPo(poData ?? null);
      setGrns(grnData ?? []);
      setVendorBills(billsData ?? []);
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
      const res  = await fetch(`/api/v1/purchase-orders/${id}/whatsapp`, { method: 'POST' });
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
        setPo(prev => prev ? { ...prev, status: newStatus } : prev);
      }
    } finally { setStatusSaving(false); }
  }

  /* ── Open GRN modal ── */
  function openGrnModal() {
    if (!po) return;
    const lines = parseLines(po.linesJson);

    // Build received-by-line from active GRNs
    const receivedByLine: Record<string, number> = {};
    for (const grn of grns) {
      if (grn.lineId && grn.status !== 'void') {
        receivedByLine[grn.lineId] = (receivedByLine[grn.lineId] ?? 0) + grn.deliveredQty;
      }
    }

    // Only show lines that still have pending qty
    const pendingLines = lines
      .map(line => {
        const prev    = receivedByLine[line.id] ?? 0;
        const pending = Math.max(0, line.qty - prev);
        return { lineId: line.id, description: line.description, unit: line.unit, orderedQty: line.qty, previouslyReceived: prev, pending, receivedNow: 0 };
      })
      .filter(l => l.pending > 0);

    if (pendingLines.length === 0) {
      alert('All lines in this PO are already fully received.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setGrnDeliveryDate(today);
    setGrnNotes('');
    setGrnLines(pendingLines);
    setGrnError(null);
    setGrnOpen(true);
  }

  /* ── Submit GRN ── */
  async function submitGRN() {
    setGrnError(null);

    const linesToSend = grnLines
      .filter(l => l.receivedNow > 0)
      .map(l => ({ lineId: l.lineId, receivedQty: l.receivedNow }));

    if (linesToSend.length === 0) {
      setGrnError('Enter a received quantity for at least one line.');
      return;
    }

    if (!grnDeliveryDate) {
      setGrnError('Delivery date is required.');
      return;
    }

    // Client-side over-receipt guard
    for (const l of grnLines) {
      if (l.receivedNow > l.pending) {
        setGrnError(`"${l.description}": ${l.receivedNow} exceeds pending ${l.pending} ${l.unit}.`);
        return;
      }
    }

    setGrnSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: grnDeliveryDate,
          notes: grnNotes.trim() || undefined,
          lines: linesToSend,
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setGrnError(typeof error === 'string' ? error : 'Failed to record GRN.');
        return;
      }

      setGrnOpen(false);
      void load();
    } catch {
      setGrnError('Network error — please try again.');
    } finally {
      setGrnSaving(false);
    }
  }

  /* ── Open Vendor Bill dialog ── */
  function openVendorBillDialog() {
    if (!po) return;
    const ls = parseLines(po.linesJson);
    const recvByLine: Record<string, number> = {};
    for (const grn of grns) {
      if (grn.lineId && grn.status !== 'void') {
        recvByLine[grn.lineId] = (recvByLine[grn.lineId] ?? 0) + grn.deliveredQty;
      }
    }
    const received = ls.reduce((s, l) => s + (recvByLine[l.id] ?? 0) * l.unitRatePaise, 0);
    setBillAmountRs((received / 100).toFixed(0));
    setBillGstPct(18);
    setBillDueDate('');
    setBillDescription('');
    setBillError(null);
    setBillReceiptFile(null);
    setBillOpen(true);
  }

  /* ── Submit Vendor Bill ── */
  async function submitVendorBill() {
    setBillError(null);
    const amountPaise = Math.round(parseFloat(billAmountRs || '0') * 100);
    if (!amountPaise || amountPaise <= 0) {
      setBillError('Enter a valid bill amount.');
      return;
    }
    const gstAmountPaise = Math.round(amountPaise * billGstPct / 100);
    setBillSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/vendor-bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          gstPct: billGstPct,
          gstAmountPaise,
          dueDate: billDueDate || undefined,
          description: billDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        setBillError(typeof error === 'string' ? error : 'Failed to create vendor bill.');
        return;
      }
      const { data: created } = (await res.json()) as { data?: { id: string } };
      // Upload receipt if one was selected
      if (billReceiptFile && created?.id) {
        const form = new FormData();
        form.append('file', billReceiptFile);
        await fetch(`/api/v1/vendor-bills/${created.id}/receipt`, { method: 'POST', body: form });
      }
      setBillOpen(false);
      void load();
    } catch {
      setBillError('Network error — please try again.');
    } finally {
      setBillSaving(false);
    }
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
    if (grn.lineId && grn.status !== 'void') {
      receivedByLine[grn.lineId] = (receivedByLine[grn.lineId] ?? 0) + grn.deliveredQty;
    }
  }

  const receivedPaise = lines.reduce((s, l) => s + (receivedByLine[l.id] ?? 0) * l.unitRatePaise, 0);
  const pendingPaise  = Math.max(0, totalPaise - receivedPaise);

  const sc       = STATUS_CFG[po.status];
  const nextStep = NEXT_STATUS[po.status];
  const days     = po.expectedDeliveryAt ? daysFrom(po.expectedDeliveryAt) : null;

  const grnGroups     = groupGRNs(grns);
  const canAddGrn     = po.status !== 'cancelled' && po.status !== 'complete';
  const canCreateBill = grns.length > 0 && po.status !== 'cancelled';

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
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{grnGroups.filter(g => g.grnNumber).length} GRN{grnGroups.filter(g => g.grnNumber).length !== 1 ? 's' : ''} recorded</p>
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
            {grnGroups.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {grnGroups.filter(g => g.grnNumber).length} delivery event{grnGroups.filter(g => g.grnNumber).length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {canAddGrn && grns.length > 0 && (
            <button
              onClick={openGrnModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add GRN
            </button>
          )}
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
            {canAddGrn && (
              <button
                onClick={openGrnModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Record First Delivery
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {grnGroups.map((group, gi) => {
              const key = group.grnNumber ?? `legacy-${gi}`;
              const isExpanded = expandedGrns.has(key);

              return (
                <div key={key} className="premium-card overflow-hidden">
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => setExpandedGrns(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--surface-muted)]/50 transition-colors text-left"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-mono text-sm font-semibold text-[var(--text-heading)]">
                        {group.grnNumber ?? 'Legacy'}
                      </span>
                      {group.deliveryDate ? (
                        <span className="text-xs text-[var(--text-secondary)]">
                          {shortDateLocal(group.deliveryDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">
                          {new Date(group.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {group.receivedByName && (
                        <span className="text-xs text-[var(--text-secondary)]">
                          Received by <span className="font-medium">{group.receivedByName}</span>
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-secondary)]">
                        {group.rows.reduce((s, r) => s + r.deliveredQty, 0)} units · {group.rows.length} line{group.rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            <th className="px-5 py-2.5 text-left">Item</th>
                            <th className="px-4 py-2.5 text-right">Qty Received</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map(grn => {
                            const lineDef = grn.lineId ? lines.find(l => l.id === grn.lineId) : null;
                            return (
                              <tr key={grn.id} className="border-t border-[var(--border-subtle)]">
                                <td className="px-5 py-3 text-[var(--text-primary)]">
                                  {lineDef?.description ?? (grn.lineId ? grn.lineId.slice(0, 8) + '…' : 'Unknown item')}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                  {grn.deliveredQty}
                                  {lineDef?.unit && <span className="ml-1 text-xs font-normal text-[var(--text-secondary)]">{lineDef.unit}</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {group.notes && (
                        <div className="border-t border-[var(--border-subtle)] px-5 py-3 text-sm text-[var(--text-secondary)]">
                          <span className="font-medium text-[var(--text-primary)]">Notes:</span>{' '}{group.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Vendor Bills ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Vendor Bills
            </h2>
            {vendorBills.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {vendorBills.length} bill{vendorBills.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {canCreateBill && (
            <button
              onClick={openVendorBillDialog}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Vendor Bill
            </button>
          )}
        </div>

        {vendorBills.length === 0 ? (
          <div className="premium-card flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)]">
              <FileText className="h-6 w-6 text-[var(--text-secondary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">No vendor bills yet</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {canCreateBill
                  ? 'Create a vendor bill based on goods received'
                  : 'Record a GRN first to enable vendor billing'}
              </p>
            </div>
            {canCreateBill && (
              <button
                onClick={openVendorBillDialog}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Create Vendor Bill
              </button>
            )}
          </div>
        ) : (
          <div className="premium-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-5 py-3 text-left">Bill #</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendorBills.map(bill => {
                  const total  = bill.amountPaise + bill.gstAmountPaise;
                  const isPaid = !!bill.paidAt;
                  return (
                    <tr key={bill.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs">
                        {bill.expenseNumber ? (
                          <Link
                            href={`/vendor-bills/${bill.id}`}
                            className="font-semibold text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                          >
                            {bill.expenseNumber}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 text-[var(--text-primary)]">
                        {bill.description ?? '—'}
                        {bill.dueDate && (
                          <p className="text-xs text-[var(--text-secondary)]">Due {shortDateLocal(bill.dueDate)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-[var(--text-primary)]">
                        {formatRupees(bill.amountPaise)}
                      </td>
                      <td className="px-4 py-4 text-right text-[var(--text-secondary)]">
                        {bill.gstPct}%
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-[var(--text-heading)]">
                        {formatRupees(total)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                  <td colSpan={4} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Total Billed
                  </td>
                  <td className="px-4 py-3 text-right text-base font-bold text-[var(--text-heading)]">
                    {formatRupees(vendorBills.reduce((s, b) => s + b.amountPaise + b.gstAmountPaise, 0))}
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── Vendor Bill Dialog ── */}
      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Vendor Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-[var(--text-secondary)]">
              Creates a payable linked to this PO. Defaults to the value of goods received so far.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="bill-amount">Bill Amount (₹) <span className="text-red-500">*</span></Label>
              <Input
                id="bill-amount"
                type="number"
                min={0}
                step={1}
                value={billAmountRs}
                placeholder="0"
                onChange={e => setBillAmountRs(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bill-gst">GST %</Label>
                <select
                  id="bill-gst"
                  value={billGstPct}
                  onChange={e => setBillGstPct(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {[0, 5, 12, 18, 28].map(r => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill-due">Due Date <span className="text-[var(--text-secondary)] font-normal">(optional)</span></Label>
                <Input
                  id="bill-due"
                  type="date"
                  value={billDueDate}
                  onChange={e => setBillDueDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {billAmountRs && parseFloat(billAmountRs) > 0 && (
              <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Bill amount</span>
                  <span className="font-medium">{formatRupees(Math.round(parseFloat(billAmountRs) * 100))}</span>
                </div>
                {billGstPct > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-[var(--text-secondary)]">GST ({billGstPct}%)</span>
                    <span className="font-medium">{formatRupees(Math.round(parseFloat(billAmountRs) * billGstPct))}</span>
                  </div>
                )}
                <div className="flex justify-between mt-1.5 border-t border-[var(--border-subtle)] pt-1.5">
                  <span className="font-semibold text-[var(--text-primary)]">Total</span>
                  <span className="font-bold text-[var(--text-heading)]">
                    {formatRupees(Math.round(parseFloat(billAmountRs) * 100 * (1 + billGstPct / 100)))}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bill-desc">Description <span className="text-[var(--text-secondary)] font-normal">(optional)</span></Label>
              <Textarea
                id="bill-desc"
                placeholder="Bill for materials received as per GRN…"
                rows={2}
                value={billDescription}
                onChange={e => setBillDescription(e.target.value)}
              />
            </div>

            {/* Optional receipt attachment */}
            <div className="space-y-1.5">
              <Label htmlFor="bill-receipt">
                Receipt / Bill Document{' '}
                <span className="text-[var(--text-secondary)] font-normal">(optional)</span>
              </Label>
              <div
                className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-2.5 cursor-pointer hover:border-teal-400 transition-colors"
                onClick={() => billReceiptRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">
                  {billReceiptFile ? billReceiptFile.name : 'Click to attach PDF or image…'}
                </span>
                {billReceiptFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setBillReceiptFile(null); if (billReceiptRef.current) billReceiptRef.current.value = ''; }}
                    className="text-xs text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={billReceiptRef}
                id="bill-receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => setBillReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {billError && <p className="text-xs text-red-600">{billError}</p>}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button
              onClick={() => setBillOpen(false)}
              disabled={billSaving}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={submitVendorBill}
              disabled={billSaving || !billAmountRs || parseFloat(billAmountRs) <= 0}
              className="flex-1 rounded-xl bg-[var(--teal,#0d9488)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {billSaving ? 'Creating…' : 'Create Vendor Bill'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GRN Dialog ── */}
      <Dialog open={grnOpen} onOpenChange={setGrnOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Goods Received</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Line table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-4 py-2.5 text-left">Item</th>
                    <th className="px-3 py-2.5 text-right">Ordered</th>
                    <th className="px-3 py-2.5 text-right">Received</th>
                    <th className="px-3 py-2.5 text-right">Pending</th>
                    <th className="px-3 py-2.5 text-right">Receive Now</th>
                  </tr>
                </thead>
                <tbody>
                  {grnLines.map(l => (
                    <tr key={l.lineId} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                        {l.description}
                        <span className="ml-1.5 text-xs font-normal text-[var(--text-secondary)]">{l.unit}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-[var(--text-secondary)]">{l.orderedQty}</td>
                      <td className="px-3 py-3 text-right text-[var(--text-secondary)]">{l.previouslyReceived}</td>
                      <td className="px-3 py-3 text-right font-medium text-amber-600">{l.pending}</td>
                      <td className="px-3 py-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={l.pending}
                          step={1}
                          value={l.receivedNow || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = Math.min(l.pending, Math.max(0, parseInt(e.target.value) || 0));
                            setGrnLines(prev => prev.map(x => x.lineId === l.lineId ? { ...x, receivedNow: val } : x));
                          }}
                          className="h-8 w-20 text-right text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Delivery date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="grn-date">Delivery Date</Label>
                <Input
                  id="grn-date"
                  type="date"
                  value={grnDeliveryDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setGrnDeliveryDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="grn-notes">Notes <span className="text-[var(--text-secondary)] font-normal">(optional)</span></Label>
              <Textarea
                id="grn-notes"
                placeholder="Delivery condition, batch number, damaged items, remarks…"
                rows={2}
                value={grnNotes}
                onChange={e => setGrnNotes(e.target.value)}
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
              disabled={grnSaving || grnLines.every(l => l.receivedNow === 0)}
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
