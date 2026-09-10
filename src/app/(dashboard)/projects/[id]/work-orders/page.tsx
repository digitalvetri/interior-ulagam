'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, HardHat, Calendar, User,
  ChevronDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types ─────────────────────────────────────────────────────────────────────

type WOType = 'inhouse_carpentry' | 'factory' | 'vendor_job' | 'site_work';
type WOStatus = 'draft' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface WorkOrder {
  id: string;
  title: string;
  type: WOType;
  status: WOStatus;
  startDate: string | null;
  dueDate: string | null;
  assignedUserName: string | null;
  assignedVendorName: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Display maps ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<WOType, string> = {
  inhouse_carpentry: 'In-house Carpentry',
  factory:           'Factory',
  vendor_job:        'Vendor Job',
  site_work:         'Site Work',
};

const STATUS_LABELS: Record<WOStatus, string> = {
  draft:       'Draft',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  on_hold:     'On Hold',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

const STATUS_STYLES: Record<WOStatus, { bg: string; color: string }> = {
  draft:       { bg: 'rgba(107,114,128,0.1)',  color: 'var(--text-secondary)' },
  assigned:    { bg: 'rgba(59,130,246,0.12)',  color: 'var(--accent-text)' },
  in_progress: { bg: 'rgba(234,179,8,0.15)',   color: '#92400e' },
  on_hold:     { bg: 'rgba(249,115,22,0.12)',  color: '#9a3412' },
  completed:   { bg: 'rgba(22,163,74,0.12)',   color: 'var(--success-text)' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',    color: 'var(--danger)' },
};

// ─── Status dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({ wo, onUpdated }: { wo: WorkOrder; onUpdated: (updated: WorkOrder) => void }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);

  const statuses: WOStatus[] = ['draft', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const style = STATUS_STYLES[wo.status];

  async function handleSelect(status: WOStatus) {
    if (status === wo.status) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/work-orders/${wo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json() as { data?: WorkOrder };
      if (res.ok && body.data) onUpdated({ ...wo, status });
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:opacity-60"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : STATUS_LABELS[wo.status]}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[130px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1 shadow-lg">
          {statuses.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => void handleSelect(s)}
              className={[
                'w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]',
                s === wo.status ? 'font-bold text-[var(--text-heading)]' : 'text-[var(--text-primary)]',
              ].join(' ')}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (wo: WorkOrder) => void;
}

function CreateWorkOrderDialog({ open, onClose, projectId, onCreated }: CreateDialogProps) {
  const [title,     setTitle]     = useState('');
  const [type,      setType]      = useState<WOType>('site_work');
  const [startDate, setStartDate] = useState('');
  const [dueDate,   setDueDate]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (open) { setTitle(''); setType('site_work'); setStartDate(''); setDueDate(''); setNotes(''); setError(null); }
  }, [open]);

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:     title.trim(),
          type,
          startDate: startDate || undefined,
          dueDate:   dueDate   || undefined,
          notes:     notes     || undefined,
        }),
      });
      const body = await res.json() as { data?: WorkOrder; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      onCreated(body.data!);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="wo-title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="wo-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Master bedroom wardrobe — factory"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wo-type">Type</Label>
            <select
              id="wo-type"
              value={type}
              onChange={e => setType(e.target.value as WOType)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.entries(TYPE_LABELS) as [WOType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wo-start">Start Date</Label>
              <Input id="wo-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-due">Due Date</Label>
              <Input id="wo-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wo-notes">Notes</Label>
            <textarea
              id="wo-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional notes…"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create Work Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [rows,       setRows]       = useState<WorkOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter,     setFilter]     = useState<WOStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${id}/work-orders`);
        const body = await res.json() as { data?: WorkOrder[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Failed');
        setRows(body.data ?? []);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function handleUpdated(updated: WorkOrder) {
    setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  function handleCreated(wo: WorkOrder) {
    setRows(prev => [wo, ...prev]);
  }

  const displayed = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-page)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--text-primary)]" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-heading)]">Work Orders</h1>
            <p className="text-xs text-[var(--text-secondary)]">Carpentry, factory & vendor jobs</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Work Order
        </Button>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Filter tabs */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-[var(--text-heading)] text-[var(--surface-page)]'
                  : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]',
              ].join(' ')}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f as WOStatus]}
              {f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="premium-card divide-y divide-[var(--border-subtle)]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 rounded-full bg-[var(--surface-muted)] p-3">
              <HardHat className="h-6 w-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {filter === 'all' ? 'No work orders yet' : `No ${STATUS_LABELS[filter as WOStatus].toLowerCase()} orders`}
            </p>
            {filter === 'all' && (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Work orders track carpentry, factory, and vendor jobs for this project.
              </p>
            )}
            {filter === 'all' && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                style={{ background: 'var(--violet-primary, var(--accent-base))' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Work Order
              </button>
            )}
          </div>
        ) : (
          displayed.map(wo => (
            <div
              key={wo.id}
              className="flex items-start justify-between gap-4 p-4 first:pt-5 last:pb-5 cursor-pointer hover:bg-[var(--surface-muted)] transition-colors"
              onClick={() => router.push(`/work-orders/${wo.id}`)}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-[var(--text-heading)] leading-snug">{wo.title}</p>
                  <span
                    className="mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: 'rgba(107,114,128,0.1)', color: 'var(--text-secondary)' }}
                  >
                    {TYPE_LABELS[wo.type]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-secondary)]">
                  {(wo.assignedUserName || wo.assignedVendorName) && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {wo.assignedVendorName ?? wo.assignedUserName}
                    </span>
                  )}
                  {(wo.startDate || wo.dueDate) && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {wo.startDate && new Date(wo.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {wo.startDate && wo.dueDate && ' → '}
                      {wo.dueDate && new Date(wo.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {wo.notes && (
                    <span className="truncate max-w-[200px]" title={wo.notes}>{wo.notes}</span>
                  )}
                </div>
              </div>
              <div onClick={e => e.stopPropagation()}>
                <StatusDropdown wo={wo} onUpdated={handleUpdated} />
              </div>
            </div>
          ))
        )}
      </div>

      <CreateWorkOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={id}
        onCreated={handleCreated}
      />
    </div>
  );
}
