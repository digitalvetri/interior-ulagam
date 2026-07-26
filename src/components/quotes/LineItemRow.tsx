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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [qtyInput, setQtyInput] = useState(String(line.qty));
  const [costInput, setCostInput] = useState(String(line.costRatePaise / 100));
  const [clientInput, setClientInput] = useState(String(line.clientRatePaise / 100));

  const parsedQty = Math.max(1, Math.round(Number(qtyInput) || 1));
  const parsedCostPaise = Math.round((Number(costInput) || 0) * 100);
  const parsedClientPaise = Math.round((Number(clientInput) || 0) * 100);
  const liveMarginPaise = (parsedClientPaise - parsedCostPaise) * parsedQty;

  function handleEditStart() {
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
          qty: parsedQty,
          costRatePaise: parsedCostPaise,
          clientRatePaise: parsedClientPaise,
        }),
      });
      if (!res.ok) throw new Error('Save failed — please try again.');
      onUpdate(line.id, { qty: parsedQty, costRatePaise: parsedCostPaise, clientRatePaise: parsedClientPaise });
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

  const displayMarginPaise = editing ? liveMarginPaise : line.marginPaise;
  const marginPositive = displayMarginPaise >= 0;

  // Confirmation row shown inline instead of the normal row
  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={8} className="px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-700 font-medium">
              Delete &quot;{line.item}&quot; ({line.room})? This cannot be undone.
            </span>
            {deleteError && (
              <span className="text-xs text-red-600">{deleteError}</span>
            )}
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setConfirmDelete(false); setDeleteError(null); }} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="text-sm transition-colors hover:bg-[var(--surface-muted)]"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
      onClick={() => !editing && handleEditStart()}
      role="button"
      tabIndex={editing ? -1 : 0}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) handleEditStart();
      }}
    >
      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{line.room}</td>
      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
        {line.item}
        {saveError && (
          <p className="text-xs text-red-600 mt-0.5">{saveError}</p>
        )}
      </td>
      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{line.unit}</td>

      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input type="number" min={1} value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)} className="w-20" />
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>{line.qty}</span>
        )}
      </td>

      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input type="number" min={0} step={0.01} value={costInput}
            onChange={(e) => setCostInput(e.target.value)} className="w-28" />
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>{formatRupees(line.costRatePaise)}</span>
        )}
      </td>

      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <Input type="number" min={0} step={0.01} value={clientInput}
            onChange={(e) => setClientInput(e.target.value)} className="w-28" />
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>{formatRupees(line.clientRatePaise)}</span>
        )}
      </td>

      <td className="px-3 py-2">
        <span className="font-medium" style={{ color: marginPositive ? 'var(--text-accent)' : '#DC2626' }}>
          {formatRupees(displayMarginPaise)}
        </span>
      </td>

      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleting}>
            Delete
          </Button>
        )}
      </td>
    </tr>
  );
}
