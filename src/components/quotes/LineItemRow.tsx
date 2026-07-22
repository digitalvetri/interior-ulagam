'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

interface LineItemRowProps {
  line: QuoteLine;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: { qty?: number; costRatePaise?: number; clientRatePaise?: number },
  ) => void;
}

export function LineItemRow({ line, onDelete, onUpdate }: LineItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Local edit state — input values in rupees (display), stored in paise
  const [qtyInput, setQtyInput] = useState(String(line.qty));
  const [costInput, setCostInput] = useState(String(line.costRatePaise / 100));
  const [clientInput, setClientInput] = useState(
    String(line.clientRatePaise / 100),
  );

  const parsedQty = Math.max(1, Math.round(Number(qtyInput) || 1));
  const parsedCostPaise = Math.round((Number(costInput) || 0) * 100);
  const parsedClientPaise = Math.round((Number(clientInput) || 0) * 100);
  const liveMarginPaise = (parsedClientPaise - parsedCostPaise) * parsedQty;

  function handleEditStart() {
    setQtyInput(String(line.qty));
    setCostInput(String(line.costRatePaise / 100));
    setClientInput(String(line.clientRatePaise / 100));
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/quotes/${line.quoteId}/lines/${line.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qty: parsedQty,
            costRatePaise: parsedCostPaise,
            clientRatePaise: parsedClientPaise,
          }),
        },
      );
      if (!res.ok) throw new Error('Save failed');
      onUpdate(line.id, {
        qty: parsedQty,
        costRatePaise: parsedCostPaise,
        clientRatePaise: parsedClientPaise,
      });
      setEditing(false);
    } catch {
      // Error already surfaced by the failed state — caller will refetch
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/quotes/${line.quoteId}/lines/${line.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Delete failed');
      onDelete(line.id);
    } catch {
      // Error surfaced by failed state
    } finally {
      setDeleting(false);
    }
  }

  const displayMarginPaise = editing ? liveMarginPaise : line.marginPaise;
  const marginPositive = displayMarginPaise >= 0;

  return (
    <tr
      className="border-b border-gray-100 text-sm dark:border-gray-800"
      onClick={() => !editing && handleEditStart()}
      role="button"
      tabIndex={editing ? -1 : 0}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) handleEditStart();
      }}
    >
      {/* Room */}
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
        {line.room}
      </td>

      {/* Item */}
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
        {line.item}
      </td>

      {/* Unit */}
      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
        {line.unit}
      </td>

      {/* Qty */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input
            type="number"
            min={1}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            className="w-20"
          />
        ) : (
          <span className="text-gray-700 dark:text-gray-300">{line.qty}</span>
        )}
      </td>

      {/* Cost Rate */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input
            type="number"
            min={0}
            step={0.01}
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            className="w-28"
          />
        ) : (
          <span className="text-gray-700 dark:text-gray-300">
            {formatRupees(line.costRatePaise)}
          </span>
        )}
      </td>

      {/* Client Rate */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input
            type="number"
            min={0}
            step={0.01}
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            className="w-28"
          />
        ) : (
          <span className="text-gray-700 dark:text-gray-300">
            {formatRupees(line.clientRatePaise)}
          </span>
        )}
      </td>

      {/* Margin */}
      <td className="px-3 py-2">
        <span
          className={
            marginPositive
              ? 'font-medium text-green-600 dark:text-green-400'
              : 'font-medium text-red-600 dark:text-red-400'
          }
        >
          {formatRupees(displayMarginPaise)}
        </span>
      </td>

      {/* Actions */}
      <td
        className="px-3 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </td>
    </tr>
  );
}
