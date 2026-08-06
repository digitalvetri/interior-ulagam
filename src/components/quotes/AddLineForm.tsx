'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

interface AddLineFormProps {
  quoteId: string;
  onSuccess: (line: QuoteLine) => void;
  onCancel?: () => void;
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

export function AddLineForm({ quoteId, onSuccess, onCancel }: AddLineFormProps) {
  const [form,       setForm]       = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const parsedQty          = Number(form.qty)            || 0;
  const parsedCostRupees   = Number(form.costRateRupees)   || 0;
  const parsedClientRupees = Number(form.clientRateRupees) || 0;
  const liveMarginPaise    = Math.round((parsedClientRupees - parsedCostRupees) * parsedQty * 100);
  const showMargin         = parsedQty > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!form.room.trim())  { setError('Room name is required'); return; }
    if (!form.item.trim())  { setError('Item name is required'); return; }
    if (!form.unit.trim())  { setError('Unit is required'); return; }
    if (parsedQty <= 0)     { setError('Qty must be greater than 0'); return; }

    const costRatePaise   = Math.round(parsedCostRupees   * 100);
    const clientRatePaise = Math.round(parsedClientRupees * 100);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room:            form.room.trim(),
          item:            form.item.trim(),
          unit:            form.unit.trim(),
          qty:             Math.round(parsedQty),
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
    <form onSubmit={handleSubmit} className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Add Line Item</p>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg p-1 transition-colors hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-1 flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-room">
            Room <span className="text-red-500">*</span>
          </label>
          <input id="add-room" className="studio-input" placeholder="Living Room"
            value={form.room} onChange={(e) => setField('room', e.target.value)} />
        </div>

        <div className="col-span-2 flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-item">
            Item <span className="text-red-500">*</span>
          </label>
          <input id="add-item" className="studio-input" placeholder="Modular Wardrobe"
            value={form.item} onChange={(e) => setField('item', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-unit">
            Unit <span className="text-red-500">*</span>
          </label>
          <input id="add-unit" className="studio-input" placeholder="sqft"
            value={form.unit} onChange={(e) => setField('unit', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-qty">
            Qty <span className="text-red-500">*</span>
          </label>
          <input id="add-qty" type="number" min={1} className="studio-input" placeholder="1"
            value={form.qty} onChange={(e) => setField('qty', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-cost">Cost Rate ₹</label>
          <input id="add-cost" type="number" min={0} step={0.01} className="studio-input" placeholder="0.00"
            value={form.costRateRupees} onChange={(e) => setField('costRateRupees', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-client">Client Rate ₹</label>
          <input id="add-client" type="number" min={0} step={0.01} className="studio-input" placeholder="0.00"
            value={form.clientRateRupees} onChange={(e) => setField('clientRateRupees', e.target.value)} />
        </div>
      </div>

      {/* Footer: margin preview + submit */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {showMargin && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ background: liveMarginPaise >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Live margin:</span>
              <span className="text-sm font-semibold"
                style={{ color: liveMarginPaise >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatRupees(liveMarginPaise)}
              </span>
            </div>
          )}
          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={submitting}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
            {submitting ? 'Adding…' : '+ Add Line'}
          </button>
        </div>
      </div>
    </form>
  );
}
