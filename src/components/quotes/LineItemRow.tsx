'use client';

import { useState } from 'react';
import { Check, X, Trash2, Pencil, Copy } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

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
  const [editing,       setEditing]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState<string | null>(null);

  const [roomInput,   setRoomInput]   = useState(line.room);
  const [itemInput,   setItemInput]   = useState(line.item);
  const [unitInput,   setUnitInput]   = useState(line.unit);
  const [qtyInput,    setQtyInput]    = useState(String(line.qty));
  const [costInput,   setCostInput]   = useState(String(line.costRatePaise / 100));
  const [clientInput, setClientInput] = useState(String(line.clientRatePaise / 100));

  const parsedQty         = Math.max(1, Math.round(Number(qtyInput)    || 1));
  const parsedCostPaise   = Math.round((Number(costInput)   || 0) * 100);
  const parsedClientPaise = Math.round((Number(clientInput) || 0) * 100);
  const liveMarginPaise   = (parsedClientPaise - parsedCostPaise) * parsedQty;

  function handleEditStart() {
    setRoomInput(line.room);
    setItemInput(line.item);
    setUnitInput(line.unit);
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
          unit:            unitInput.trim(),
          qty:             parsedQty,
          costRatePaise:   parsedCostPaise,
          clientRatePaise: parsedClientPaise,
        }),
      });
      if (!res.ok) throw new Error('Save failed — please try again.');
      onUpdate(line.id, {
        room:            roomInput.trim(),
        item:            itemInput.trim(),
        unit:            unitInput.trim(),
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
      <tr style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
        <td colSpan={7} className="px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium" style={{ color: '#DC2626' }}>
              Delete &quot;{line.item}&quot;? This cannot be undone.
            </span>
            {deleteError && (
              <span className="text-xs" style={{ color: '#B91C1C' }}>{deleteError}</span>
            )}
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: '#DC2626' }}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button"
              onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:bg-gray-100"
              style={{ color: '#6B6459' }}>
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
      <tr style={{ background: '#F9F8FF', borderBottom: '1px solid #EDE9FE' }}>
        <td colSpan={7} className="px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Room</p>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="studio-input w-32"
                placeholder="Room"
                autoFocus
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Item</p>
              <input
                type="text"
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                className="studio-input w-full"
                placeholder="Item description"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Unit</p>
              <input
                type="text"
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value)}
                className="studio-input w-20"
                placeholder="sqft"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Qty</p>
              <input
                type="number"
                min={1}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="studio-input w-20 text-right"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Cost ₹</p>
              <input
                type="number"
                min={0}
                step={0.01}
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                className="studio-input w-28 text-right"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Client ₹</p>
              <input
                type="number"
                min={0}
                step={0.01}
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                className="studio-input w-28 text-right"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#A79E8E' }}>Margin</p>
              <span
                className="text-sm font-semibold"
                style={{ color: liveMarginPaise >= 0 ? '#16A34A' : '#DC2626' }}>
                {formatRupees(liveMarginPaise)}
              </span>
            </div>
            <div className="flex items-center gap-1 pb-0.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: '#7C3AED' }}>
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-gray-100"
                style={{ color: '#6B6459' }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {saveError && (
            <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{saveError}</p>
          )}
        </td>
      </tr>
    );
  }

  /* ── Normal display row ──────────────────────────────────────────────── */
  return (
    <tr
      className="text-sm transition-colors group"
      style={{ borderBottom: '1px solid #F0EEE9' }}
    >
      {/* Item */}
      <td className="px-4 py-2.5">
        <div>
          <span className="font-medium" style={{ color: '#1C1916' }}>{line.item}</span>
          {line.description && (
            <p className="text-[11px] mt-0.5" style={{ color: '#A79E8E' }}>{line.description}</p>
          )}
        </div>
      </td>

      {/* Unit */}
      <td className="px-4 py-2.5" style={{ color: '#6B6459' }}>{line.unit}</td>

      {/* Qty */}
      <td className="px-4 py-2.5 text-right" style={{ color: '#1C1916' }}>{line.qty}</td>

      {/* Cost Rate */}
      <td className="px-4 py-2.5 text-right" style={{ color: '#1C1916' }}>
        {formatRupees(line.costRatePaise)}
      </td>

      {/* Client Rate */}
      <td className="px-4 py-2.5 text-right" style={{ color: '#1C1916' }}>
        {formatRupees(line.clientRatePaise)}
      </td>

      {/* Margin */}
      <td className="px-4 py-2.5 text-right">
        <span className="font-semibold" style={{ color: line.marginPaise >= 0 ? '#16A34A' : '#DC2626' }}>
          {formatRupees(line.marginPaise)}
        </span>
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
              style={{ color: '#7C3AED' }}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(line)}
              title="Duplicate"
              className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-blue-50"
              style={{ color: '#1D4ED8' }}>
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              title="Delete"
              className="inline-flex items-center rounded-lg p-1.5 transition-all hover:bg-red-50"
              style={{ color: '#DC2626' }}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
