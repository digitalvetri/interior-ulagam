'use client';

import { useState } from 'react';
import { Check, X, Trash2, Pencil, Copy, ChevronDown } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';
import { UNIT_PRESETS } from './AddLineForm';

interface LineItemRowProps {
  line: QuoteLine;
  isDraft: boolean;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: Partial<Pick<QuoteLine, 'room' | 'item' | 'unit' | 'qty' | 'costRatePaise' | 'clientRatePaise'>>,
  ) => void;
  onDuplicate: (line: QuoteLine) => void;
}

export function LineItemRow({ line, isDraft, onDelete, onUpdate, onDuplicate }: LineItemRowProps) {
  const [editing,        setEditing]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [deleteError,    setDeleteError]    = useState<string | null>(null);
  const [saveError,      setSaveError]      = useState<string | null>(null);

  const [roomInput,      setRoomInput]      = useState(line.room);
  const [itemInput,      setItemInput]      = useState(line.item);
  const [unitEditPreset, setUnitEditPreset] = useState('');
  const [unitEditCustom, setUnitEditCustom] = useState('');
  const [qtyInput,       setQtyInput]       = useState(String(line.qty));
  const [costInput,      setCostInput]      = useState(String(line.costRatePaise / 100));
  const [clientInput,    setClientInput]    = useState(String(line.clientRatePaise / 100));

  const parsedQty         = Math.max(1, Math.round(Number(qtyInput)    || 1));
  const parsedCostPaise   = Math.round((Number(costInput)   || 0) * 100);
  const parsedClientPaise = Math.round((Number(clientInput) || 0) * 100);
  const liveMarginPaise   = (parsedClientPaise - parsedCostPaise) * parsedQty;
  const unitSaveValue     = unitEditPreset === 'Other' ? unitEditCustom.trim() : unitEditPreset;

  function handleEditStart() {
    setRoomInput(line.room);
    setItemInput(line.item);
    const preset = (UNIT_PRESETS as readonly string[]).includes(line.unit) ? line.unit : 'Other';
    setUnitEditPreset(preset);
    setUnitEditCustom(preset === 'Other' ? line.unit : '');
    setQtyInput(String(line.qty));
    setCostInput(String(line.costRatePaise / 100));
    setClientInput(String(line.clientRatePaise / 100));
    setSaveError(null);
    setEditing(true);
  }

  function handleCancel() {
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${line.quoteId}/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room:            roomInput.trim(),
          item:            itemInput.trim(),
          unit:            unitSaveValue || line.unit,
          qty:             parsedQty,
          costRatePaise:   parsedCostPaise,
          clientRatePaise: parsedClientPaise,
        }),
      });
      if (!res.ok) throw new Error('Save failed — please try again.');
      onUpdate(line.id, {
        room:            roomInput.trim(),
        item:            itemInput.trim(),
        unit:            unitSaveValue || line.unit,
        qty:             parsedQty,
        costRatePaise:   parsedCostPaise,
        clientRatePaise: parsedClientPaise,
      });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${line.quoteId}/lines/${line.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed — please try again.');
      onDelete(line.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed — please try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  /* ── Delete confirmation row ─────────────────────────────────────────── */
  if (confirmDelete) {
    return (
      <tr style={{ background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger-soft)' }}>
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              Delete &quot;{line.item}&quot;? This cannot be undone.
            </span>
            {deleteError && (
              <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{deleteError}</span>
            )}
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--danger)' }}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button"
              onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--surface-muted)]"
              style={{ color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  /* ── Full-width edit row ─────────────────────────────────────────────── */
  if (editing) {
    return (
      <tr style={{ background: '#F9F8FF', borderBottom: '1px solid var(--accent-soft)' }}>
        <td colSpan={6} className="px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Room */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Room</p>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="studio-input w-32"
                placeholder="Room"
                autoFocus
              />
            </div>
            {/* Item */}
            <div className="flex-1 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Item</p>
              <input
                type="text"
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                className="studio-input w-full"
                placeholder="Item description"
              />
            </div>
            {/* Unit */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Unit</p>
              <div className="relative">
                <select
                  value={unitEditPreset}
                  onChange={(e) => { setUnitEditPreset(e.target.value); if (e.target.value !== 'Other') setUnitEditCustom(''); }}
                  className="studio-input w-28 appearance-none pr-7"
                >
                  <option value="">Select…</option>
                  {UNIT_PRESETS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
              {unitEditPreset === 'Other' && (
                <input
                  type="text"
                  value={unitEditCustom}
                  onChange={(e) => setUnitEditCustom(e.target.value)}
                  className="studio-input w-28 mt-1"
                  placeholder="e.g. Bags"
                />
              )}
            </div>
            {/* Qty */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Qty</p>
              <input
                type="number"
                min={1}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="studio-input w-20 text-right"
              />
            </div>
            {/* Rate (Client Rate) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Rate ₹</p>
              <input
                type="number"
                min={0}
                step={0.01}
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                className="studio-input w-28 text-right"
              />
            </div>
            {/* Your cost (internal) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Your cost ₹ <span className="normal-case font-normal">(internal)</span>
              </p>
              <input
                type="number"
                min={0}
                step={0.01}
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                className="studio-input w-28 text-right"
              />
            </div>
            {/* Live margin */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Margin</p>
              <span
                className="text-sm font-semibold"
                style={{ color: liveMarginPaise >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatRupees(liveMarginPaise)}
              </span>
            </div>
            {/* Save / Cancel */}
            <div className="flex items-center gap-1 pb-0.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: 'var(--accent-base)' }}>
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {saveError && (
            <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{saveError}</p>
          )}
        </td>
      </tr>
    );
  }

  /* ── Normal display row ──────────────────────────────────────────────── */
  // Shows: Item | Unit | Qty | Rate | Total | Actions
  // Cost and margin are kept in the DB and visible in the sidebar summary — not shown in the table.
  return (
    <tr
      className="text-sm transition-colors group"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Item */}
      <td className="px-4 py-2.5">
        <div>
          <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{line.item}</span>
          {line.description && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{line.description}</p>
          )}
        </div>
      </td>

      {/* Unit */}
      <td className="px-4 py-2.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>{line.unit}</td>

      {/* Qty */}
      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>{line.qty}</td>

      {/* Rate (client rate) */}
      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>
        {formatRupees(line.clientRatePaise)}
      </td>

      {/* Total = Rate × Qty */}
      <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>
        {formatRupees(line.clientRatePaise * line.qty)}
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5 text-right">
        {isDraft && (
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleEditStart}
              title="Edit"
              className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-violet-50"
              style={{ color: 'var(--accent-base)' }}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(line)}
              title="Duplicate"
              className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-blue-50"
              style={{ color: 'var(--accent-text)' }}>
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              title="Delete"
              className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-red-50"
              style={{ color: 'var(--danger)' }}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
