'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

interface AddLineFormProps {
  quoteId: string;
  onSuccess: (line: QuoteLine) => void;
}

interface FormState {
  room: string;
  item: string;
  unit: string;
  qty: string;
  costRateRupees: string;
  clientRateRupees: string;
}

const INITIAL_STATE: FormState = {
  room: '',
  item: '',
  unit: '',
  qty: '',
  costRateRupees: '',
  clientRateRupees: '',
};

export function AddLineForm({ quoteId, onSuccess }: AddLineFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQty = Number(form.qty) || 0;
  const parsedCostRupees = Number(form.costRateRupees) || 0;
  const parsedClientRupees = Number(form.clientRateRupees) || 0;
  const liveMarginRupees = (parsedClientRupees - parsedCostRupees) * parsedQty;
  const liveMarginPaise = Math.round(liveMarginRupees * 100);
  const showMargin = parsedQty > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!form.room.trim()) { setError('Room name is required'); return; }
    if (!form.item.trim()) { setError('Item name is required'); return; }
    if (!form.unit.trim()) { setError('Unit is required'); return; }
    if (parsedQty <= 0) { setError('Qty must be greater than 0'); return; }

    const costRatePaise = Math.round(parsedCostRupees * 100);
    const clientRatePaise = Math.round(parsedClientRupees * 100);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: form.room.trim(),
          item: form.item.trim(),
          unit: form.unit.trim(),
          qty: Math.round(parsedQty),
          costRatePaise,
          clientRatePaise,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Failed to add line');
        return;
      }

      const { data } = (await res.json()) as { data: QuoteLine };
      onSuccess(data);
      setForm(INITIAL_STATE);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-dashed p-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
      <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
        Add Line Item
      </p>

      <div className="flex flex-wrap items-end gap-3">
        {/* Room Name */}
        <div className="flex min-w-[120px] flex-1 flex-col gap-1">
          <Label htmlFor="add-room" className="text-xs">
            Room Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="add-room"
            placeholder="Living Room"
            value={form.room}
            onChange={(e) => setField('room', e.target.value)}
          />
        </div>

        {/* Item Name */}
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <Label htmlFor="add-item" className="text-xs">
            Item Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="add-item"
            placeholder="Modular Wardrobe"
            value={form.item}
            onChange={(e) => setField('item', e.target.value)}
          />
        </div>

        {/* Unit */}
        <div className="flex w-24 flex-col gap-1">
          <Label htmlFor="add-unit" className="text-xs">
            Unit <span className="text-red-500">*</span>
          </Label>
          <Input
            id="add-unit"
            placeholder="sqft"
            value={form.unit}
            onChange={(e) => setField('unit', e.target.value)}
          />
        </div>

        {/* Qty */}
        <div className="flex w-24 flex-col gap-1">
          <Label htmlFor="add-qty" className="text-xs">
            Qty <span className="text-red-500">*</span>
          </Label>
          <Input
            id="add-qty"
            type="number"
            min={1}
            placeholder="1"
            value={form.qty}
            onChange={(e) => setField('qty', e.target.value)}
          />
        </div>

        {/* Cost Rate */}
        <div className="flex w-32 flex-col gap-1">
          <Label htmlFor="add-cost" className="text-xs">
            Cost Rate ₹
          </Label>
          <Input
            id="add-cost"
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.costRateRupees}
            onChange={(e) => setField('costRateRupees', e.target.value)}
          />
        </div>

        {/* Client Rate */}
        <div className="flex w-32 flex-col gap-1">
          <Label htmlFor="add-client" className="text-xs">
            Client Rate ₹
          </Label>
          <Input
            id="add-client"
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.clientRateRupees}
            onChange={(e) => setField('clientRateRupees', e.target.value)}
          />
        </div>

        {/* Live Margin Preview */}
        {showMargin && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Margin</span>
            <span
              className="text-sm font-semibold"
              style={{ color: liveMarginPaise >= 0 ? 'var(--text-accent)' : '#DC2626' }}
            >
              {formatRupees(liveMarginPaise)}
            </span>
          </div>
        )}

        <Button type="submit" disabled={submitting} className="self-end">
          {submitting ? 'Adding…' : '+ Add Line'}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}
