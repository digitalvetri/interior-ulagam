'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
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
  qty: string;
  clientRateRupees: string;
  costRateRupees: string;
}

const INITIAL_STATE: FormState = {
  room: '', item: '', qty: '', clientRateRupees: '', costRateRupees: '',
};

export const UNIT_PRESETS = [
  'Nos', 'Sq.ft', 'Running Ft', 'Sq.m', 'Rmt', 'Lump Sum', 'Set', 'Lot', 'Other',
] as const;

export function AddLineForm({ quoteId, onSuccess, onCancel }: AddLineFormProps) {
  const [form,        setForm]        = useState<FormState>(INITIAL_STATE);
  const [unitPreset,  setUnitPreset]  = useState('');
  const [unitCustom,  setUnitCustom]  = useState('');
  const [showCost,    setShowCost]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const unitValue          = unitPreset === 'Other' ? unitCustom.trim() : unitPreset;
  const parsedQty          = Number(form.qty)              || 0;
  const parsedCostRupees   = Number(form.costRateRupees)   || 0;
  const parsedClientRupees = Number(form.clientRateRupees) || 0;
  const liveTotal          = parsedClientRupees * parsedQty;
  const liveMarginPaise    = Math.round((parsedClientRupees - parsedCostRupees) * parsedQty * 100);
  const showMargin         = showCost && parsedQty > 0 && parsedCostRupees > 0 && parsedClientRupees > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleUnitPresetChange(val: string) {
    setUnitPreset(val);
    if (val !== 'Other') setUnitCustom('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!form.room.trim())       { setError('Room / Category is required'); return; }
    if (!form.item.trim())       { setError('Item description is required'); return; }
    if (!unitValue)              { setError('Unit is required'); return; }
    if (parsedQty <= 0)          { setError('Qty must be greater than 0'); return; }
    if (parsedClientRupees <= 0) { setError('Rate must be greater than 0'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room:            form.room.trim(),
          item:            form.item.trim(),
          unit:            unitValue,
          qty:             Math.round(parsedQty),
          costRatePaise:   Math.round(parsedCostRupees   * 100),
          clientRatePaise: Math.round(parsedClientRupees * 100),
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
      setUnitPreset('');
      setUnitCustom('');
      setShowCost(false);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          New Line Item
        </p>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg p-1 transition-colors hover:bg-[var(--surface-card)]">
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      {/* Main fields */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-[minmax(120px,1fr)_minmax(160px,2fr)_140px_80px_120px]">
        {/* Room / Category */}
        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-room">
            Room / Category <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="add-room"
            className="studio-input h-9"
            placeholder="Living Room"
            value={form.room}
            onChange={(e) => setField('room', e.target.value)}
            autoFocus
          />
        </div>

        {/* Item / Description */}
        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-item">
            Item / Description <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="add-item"
            className="studio-input h-9"
            placeholder="Modular Wardrobe"
            value={form.item}
            onChange={(e) => setField('item', e.target.value)}
          />
        </div>

        {/* Unit */}
        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-unit">
            Unit <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div className="relative">
            <select
              id="add-unit"
              value={unitPreset}
              onChange={(e) => handleUnitPresetChange(e.target.value)}
              className="studio-input h-9 w-full appearance-none pr-7"
            >
              <option value="">Select…</option>
              {UNIT_PRESETS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>
          {unitPreset === 'Other' && (
            <input
              className="studio-input h-9 mt-1"
              placeholder="e.g. Bags"
              value={unitCustom}
              onChange={(e) => setUnitCustom(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Qty */}
        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-qty">
            Qty <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="add-qty"
            type="number"
            min={1}
            className="studio-input h-9 text-right"
            placeholder="1"
            value={form.qty}
            onChange={(e) => setField('qty', e.target.value)}
          />
        </div>

        {/* Rate */}
        <div className="flex flex-col gap-1">
          <label className="studio-label" htmlFor="add-rate">
            Rate ₹ <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="add-rate"
            type="number"
            min={0}
            step={0.01}
            className="studio-input h-9 text-right"
            placeholder="0"
            value={form.clientRateRupees}
            onChange={(e) => setField('clientRateRupees', e.target.value)}
          />
        </div>
      </div>

      {/* Live total */}
      {parsedQty > 0 && parsedClientRupees > 0 && (
        <p className="mt-2 text-right text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Line total:{' '}
          <span className="font-semibold tnum" style={{ color: 'var(--text-heading)' }}>
            ₹{liveTotal.toLocaleString('en-IN')}
          </span>
        </p>
      )}

      {/* Cost tracking (optional / collapsible) */}
      {!showCost ? (
        <button
          type="button"
          onClick={() => setShowCost(true)}
          className="mt-3 text-[11px] font-medium"
          style={{ color: 'var(--accent-base)' }}
        >
          + Track your cost &amp; margin (optional)
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="studio-label" htmlFor="add-cost">
              Your cost ₹{' '}
              <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(internal)</span>
            </label>
            <input
              id="add-cost"
              type="number"
              min={0}
              step={0.01}
              className="studio-input h-9 w-36 text-right"
              placeholder="0"
              value={form.costRateRupees}
              onChange={(e) => setField('costRateRupees', e.target.value)}
              autoFocus
            />
          </div>
          {showMargin && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 mb-0.5"
              style={{ background: liveMarginPaise >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)' }}
            >
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Margin:</span>
              <span
                className="text-[13px] font-semibold tnum"
                style={{ color: liveMarginPaise >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {formatRupees(liveMarginPaise)}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setShowCost(false); setField('costRateRupees', ''); }}
            className="mb-0.5 text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        {error
          ? <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>
          : <span />
        }
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-card)]"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary rounded-xl px-3.5 py-2 text-[13px] font-semibold"
          >
            {submitting ? 'Adding…' : '+ Add Line'}
          </button>
        </div>
      </div>
    </form>
  );
}
