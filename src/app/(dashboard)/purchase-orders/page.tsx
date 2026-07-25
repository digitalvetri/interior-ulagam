'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import type { PurchaseOrder, POStatus } from '@/types/purchase-orders';

const STATUS_STYLES: Record<POStatus, React.CSSProperties> = {
  draft:        { background: '#F3F4F6', color: '#374151' },
  sent:         { background: '#DBEAFE', color: '#1D4ED8' },
  acknowledged: { background: '#FEF9C3', color: '#92400E' },
  partial:      { background: '#FFEDD5', color: '#C2410C' },
  complete:     { background: '#DCFCE7', color: '#15803D' },
  cancelled:    { background: '#FEE2E2', color: '#B91C1C' },
};

interface NewPOForm {
  projectId: string;
  linesJson: string;
  expectedDeliveryAt: string;
}

const EMPTY_FORM: NewPOForm = {
  projectId: '',
  linesJson: '',
  expectedDeliveryAt: '',
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewPOForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/purchase-orders')
      .then((r) => r.json())
      .then(({ data }: { data: PurchaseOrder[] }) => {
        setOrders(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openDialog() {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setDialogOpen(true);
  }

  function handleFieldChange(field: keyof NewPOForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!form.projectId.trim()) {
      setSubmitError('Project ID is required.');
      return;
    }

    let parsedLines: unknown[];
    try {
      parsedLines = JSON.parse(form.linesJson);
      if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
        setSubmitError('Lines must be a non-empty JSON array.');
        return;
      }
    } catch {
      setSubmitError('Lines JSON is invalid — must be a valid JSON array.');
      return;
    }

    const body: Record<string, unknown> = {
      projectId: form.projectId.trim(),
      linesJson: parsedLines,
    };

    if (form.expectedDeliveryAt) {
      body.expectedDeliveryAt = new Date(form.expectedDeliveryAt).toISOString();
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setSubmitError(payload.error ?? 'Failed to create purchase order.');
        return;
      }

      const { data } = (await res.json()) as { data: PurchaseOrder };
      setOrders((prev) => [data, ...prev]);
      setDialogOpen(false);
      router.push(`/purchase-orders/${data.id}`);
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Purchase Orders
        </h2>
        <button className="btn-primary" onClick={openDialog}>+ New PO</button>
      </div>

      {/* Table / states */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading purchase orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No purchase orders yet.</p>
          <button className="btn-secondary" onClick={openDialog}>
            Create your first PO
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Advance Paid</th>
                <th className="px-4 py-3">Expected Delivery</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr
                  key={po.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => router.push(`/purchase-orders/${po.id}`)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#C89B3C' }}>
                    {po.poNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {po.projectId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatRupees(po.advancePaidPaise)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {po.expectedDeliveryAt
                      ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(po.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New PO Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="po-project-id">Project ID</Label>
              <Input
                id="po-project-id"
                placeholder="Enter project UUID"
                value={form.projectId}
                onChange={(e) => handleFieldChange('projectId', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-lines">Lines JSON</Label>
              <Textarea
                id="po-lines"
                placeholder='Enter JSON array, e.g. [{"description":"Plywood 18mm","qty":10,"unit":"sheets","unitRatePaise":85000,"totalPaise":850000}]'
                rows={5}
                value={form.linesJson}
                onChange={(e) => handleFieldChange('linesJson', e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-delivery">Expected Delivery Date</Label>
              <Input
                id="po-delivery"
                type="date"
                value={form.expectedDeliveryAt}
                onChange={(e) => handleFieldChange('expectedDeliveryAt', e.target.value)}
              />
            </div>

            {submitError && (
              <p className="text-xs text-red-600">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              className="btn-secondary"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create PO'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
