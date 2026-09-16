'use client';

import { useState } from 'react';
import { X, Check, Receipt, Loader2 } from 'lucide-react';

type ExpenseCategory = 'petty_cash' | 'transport' | 'labour' | 'material' | 'other';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'transport',  label: 'Transport'  },
  { value: 'labour',     label: 'Labour'     },
  { value: 'material',   label: 'Material'   },
  { value: 'other',      label: 'Other'      },
];

const GST_RATES = [0, 5, 12, 18, 28] as const;

interface LogExpenseDialogProps {
  projectId: string;
  projectName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function LogExpenseDialog({ projectId, projectName, onClose, onSaved }: LogExpenseDialogProps) {
  const [category, setCategory]     = useState<ExpenseCategory>('petty_cash');
  const [vendor, setVendor]         = useState('');
  const [amountStr, setAmountStr]   = useState('');
  const [gstPct, setGstPct]         = useState<number>(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSave() {
    const amountRupees = parseFloat(amountStr);
    if (!amountStr || isNaN(amountRupees) || amountRupees <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const totalPaise = Math.round(amountRupees * 100);
      // Back-calculate GST from inclusive total: gst = total * rate / (100 + rate)
      const gstAmountPaise = gstPct > 0
        ? Math.round(totalPaise * gstPct / (100 + gstPct))
        : 0;

      const res = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          category,
          amountPaise: totalPaise,
          vendorName:  vendor.trim() || undefined,
          description: description.trim() || undefined,
          gstPct,
          gstAmountPaise,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Save failed (${res.status})`);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              Log Expense{projectName ? ` — ${projectName}` : ''}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent-base)' }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Expense
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--border-subtle)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Category — chip select */}
          <div>
            <label className="studio-label block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={category === c.value
                    ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                    : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="studio-label block mb-1">Vendor / Paid To (optional)</label>
            <input
              type="text"
              className="studio-input w-full"
              placeholder="e.g. ABC Hardware, Auto driver"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
            />
          </div>

          {/* Amount + GST */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1">Amount ₹ (incl. GST)</label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                  style={{ color: 'var(--text-secondary)' }}
                >₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="studio-input w-full"
                  style={{ paddingLeft: '1.75rem' }}
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="studio-label block mb-1">GST Rate</label>
              <div className="relative">
                <select
                  className="studio-input w-full appearance-none pr-8"
                  value={gstPct}
                  onChange={e => setGstPct(Number(e.target.value))}
                >
                  {GST_RATES.map(r => (
                    <option key={r} value={r}>{r === 0 ? '0% — No GST' : `${r}%`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* GST breakdown preview */}
          {gstPct > 0 && amountStr && !isNaN(parseFloat(amountStr)) && parseFloat(amountStr) > 0 && (() => {
            const total = parseFloat(amountStr);
            const gstAmt = total * gstPct / (100 + gstPct);
            const base = total - gstAmt;
            return (
              <div className="rounded-lg px-3 py-2 text-xs space-y-0.5" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                <div className="flex justify-between"><span>Base amount</span><span>₹{base.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>GST ({gstPct}%)</span><span>₹{gstAmt.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold" style={{ color: 'var(--text-heading)' }}><span>Total</span><span>₹{total.toFixed(2)}</span></div>
              </div>
            );
          })()}

          {/* Description */}
          <div>
            <label className="studio-label block mb-1">Description (optional)</label>
            <textarea
              className="studio-input w-full resize-none text-sm"
              rows={2}
              placeholder="What was this expense for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
