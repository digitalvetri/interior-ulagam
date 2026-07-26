'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupees } from '@/lib/utils';
import type { PurchaseOrder, GRN, POLine, POStatus } from '@/types/purchase-orders';

const PO_STATUSES: POStatus[] = [
  'draft',
  'sent',
  'acknowledged',
  'partial',
  'complete',
  'cancelled',
];

const STATUS_STYLES: Record<POStatus, React.CSSProperties> = {
  draft:        { background: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  sent:         { background: 'var(--purple-soft)', color: 'var(--purple)' },
  acknowledged: { background: 'var(--gold-soft)', color: 'var(--text-gold)' },
  partial:      { background: 'var(--teal-soft)', color: 'var(--text-accent)' },
  complete:     { background: 'var(--teal)', color: '#FFFFFF' },
  cancelled:    { background: '#FEE2E2', color: '#B91C1C' },
};

interface GRNForm {
  deliveredQty: string;
  notes: string;
}

const EMPTY_GRN_FORM: GRNForm = { deliveredQty: '', notes: '' };

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [grnForm, setGrnForm] = useState<GRNForm>(EMPTY_GRN_FORM);
  const [grnSubmitting, setGrnSubmitting] = useState(false);
  const [grnError, setGrnError] = useState<string | null>(null);

  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, grnRes] = await Promise.all([
        fetch(`/api/v1/purchase-orders/${id}`),
        fetch(`/api/v1/purchase-orders/${id}/grn`),
      ]);

      if (poRes.status === 404) {
        setNotFound(true);
        return;
      }

      const { data: poData } = (await poRes.json()) as { data: PurchaseOrder };
      const { data: grnData } = (await grnRes.json()) as { data: GRN[] };

      setPo(poData ?? null);
      setGrns(grnData ?? []);
    } catch {
      // leave state as-is; loading will clear
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleStatusChange(newStatus: string) {
    if (!po || newStatus === po.status) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const { data } = (await res.json()) as { data: PurchaseOrder };
        setPo(data);
      }
    } finally {
      setStatusUpdating(false);
    }
  }

  function openGrnDialog() {
    setGrnForm(EMPTY_GRN_FORM);
    setGrnError(null);
    setGrnDialogOpen(true);
  }

  async function handleAddGRN() {
    setGrnError(null);

    const qty = parseInt(grnForm.deliveredQty, 10);
    if (!grnForm.deliveredQty || isNaN(qty) || qty <= 0) {
      setGrnError('Delivered quantity must be a positive integer.');
      return;
    }

    setGrnSubmitting(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${id}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveredQty: qty,
          notes: grnForm.notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setGrnError(payload.error ?? 'Failed to add GRN.');
        return;
      }

      const { data: newGrn } = (await res.json()) as { data: GRN };
      setGrns((prev) => [...prev, newGrn]);
      setGrnDialogOpen(false);
    } catch {
      setGrnError('Network error — please try again.');
    } finally {
      setGrnSubmitting(false);
    }
  }

  // Parse linesJson safely
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-[var(--text-secondary)]">Loading purchase order…</p>
      </div>
    );
  }

  if (notFound || !po) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">Purchase order not found.</p>
        <Link href="/purchase-orders">
          <button className="btn-secondary">Back to Purchase Orders</button>
        </Link>
      </div>
    );
  }

  const parsedLines = parseLines(po.linesJson);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <nav className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Link
          href="/purchase-orders"
          className="hover:text-[var(--text-primary)]"
        >
          Purchase Orders
        </Link>
        <span>/</span>
        <span className="text-[var(--text-heading)]">{po.poNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            {po.poNumber}
          </h2>
          <span
            style={{
              ...STATUS_STYLES[po.status],
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '9999px',
              padding: '2px 10px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {po.status}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">
            Advance:{' '}
            <span className="font-semibold text-[var(--text-heading)]">
              {formatRupees(po.advancePaidPaise)}
            </span>
          </span>
          {po.expectedDeliveryAt && (
            <span className="text-sm text-[var(--text-secondary)]">
              Expected:{' '}
              <span className="font-semibold text-[var(--text-heading)]">
                {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN')}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Status update */}
      <div className="premium-card p-5 flex items-center gap-3">
        <Label htmlFor="po-status-select" className="shrink-0 text-sm font-medium">
          Update Status
        </Label>
        <Select
          value={po.status}
          onValueChange={handleStatusChange}
          disabled={statusUpdating}
        >
          <SelectTrigger id="po-status-select" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PO_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusUpdating && (
          <span className="text-xs text-[var(--text-secondary)]">Saving…</span>
        )}
      </div>

      {/* Lines table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Line Items
        </h3>

        {parsedLines !== null ? (
          <div className="premium-card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Unit Rate</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {parsedLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]"
                    >
                      No line items.
                    </td>
                  </tr>
                ) : (
                  parsedLines.map((line, idx) => (
                    <tr
                      key={line.id ?? idx}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {line.description}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {line.qty}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{line.unit}</td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {formatRupees(line.unitRatePaise)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                        {formatRupees(line.totalPaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-xs text-[var(--text-secondary)]">
            {typeof po.linesJson === 'string'
              ? po.linesJson
              : JSON.stringify(po.linesJson, null, 2)}
          </pre>
        )}
      </div>

      {/* GRN Log */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Goods Received Notes ({grns.length})
          </h3>
          <button className="btn-primary" onClick={openGrnDialog}>
            + Add GRN
          </button>
        </div>

        {grns.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-secondary)]">No GRNs recorded yet.</p>
          </div>
        ) : (
          <div className="premium-card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Delivered Qty</th>
                  <th className="px-4 py-3">Received At</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((grn) => (
                  <tr
                    key={grn.id}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                      {grn.deliveredQty}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {new Date(grn.receivedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {grn.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add GRN Dialog */}
      <Dialog open={grnDialogOpen} onOpenChange={setGrnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Goods Received Note</DialogTitle>
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
                value={grnForm.deliveredQty}
                onChange={(e) =>
                  setGrnForm((prev) => ({ ...prev, deliveredQty: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grn-notes">Notes (optional)</Label>
              <Textarea
                id="grn-notes"
                placeholder="Any delivery remarks…"
                rows={3}
                value={grnForm.notes}
                onChange={(e) =>
                  setGrnForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            {grnError && (
              <p className="text-xs text-red-600">{grnError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              className="btn-secondary"
              onClick={() => setGrnDialogOpen(false)}
              disabled={grnSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddGRN}
              disabled={grnSubmitting}
            >
              {grnSubmitting ? 'Saving…' : 'Record GRN'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
