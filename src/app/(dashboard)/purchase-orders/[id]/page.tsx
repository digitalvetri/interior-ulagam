'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const STATUS_COLORS: Record<POStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  acknowledged: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  partial: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <p className="text-sm text-gray-500">Loading purchase order…</p>
      </div>
    );
  }

  if (notFound || !po) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">Purchase order not found.</p>
        <Link href="/purchase-orders">
          <Button variant="outline" size="sm">Back to Purchase Orders</Button>
        </Link>
      </div>
    );
  }

  const parsedLines = parseLines(po.linesJson);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/purchase-orders"
          className="hover:text-gray-700 dark:hover:text-gray-200"
        >
          Purchase Orders
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">{po.poNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {po.poNumber}
          </h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[po.status]}`}
          >
            {po.status}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Advance:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatRupees(po.advancePaidPaise)}
            </span>
          </span>
          {po.expectedDeliveryAt && (
            <span className="text-sm text-gray-500">
              Expected:{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN')}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Status update */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
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
          <span className="text-xs text-gray-400">Saving…</span>
        )}
      </div>

      {/* Lines table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Line Items
        </h3>

        {parsedLines !== null ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
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
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      No line items.
                    </td>
                  </tr>
                ) : (
                  parsedLines.map((line, idx) => (
                    <tr
                      key={line.id ?? idx}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                        {line.description}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {line.qty}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{line.unit}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatRupees(line.unitRatePaise)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {formatRupees(line.totalPaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {typeof po.linesJson === 'string'
              ? po.linesJson
              : JSON.stringify(po.linesJson, null, 2)}
          </pre>
        )}
      </div>

      {/* GRN Log */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Goods Received Notes ({grns.length})
          </h3>
          <Button size="sm" onClick={openGrnDialog}>
            + Add GRN
          </Button>
        </div>

        {grns.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400">No GRNs recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-4 py-3">Delivered Qty</th>
                  <th className="px-4 py-3">Received At</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((grn) => (
                  <tr
                    key={grn.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {grn.deliveredQty}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(grn.receivedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
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
              <p className="text-xs text-red-600 dark:text-red-400">{grnError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGrnDialogOpen(false)}
              disabled={grnSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddGRN} disabled={grnSubmitting}>
              {grnSubmitting ? 'Saving…' : 'Record GRN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
