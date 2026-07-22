'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Deliverable,
  DeliverableStatus,
  DeliverableType,
} from '@/types/deliverables';

// ─── Constants & label maps ───────────────────────────────────────────────────

const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  '2d_plan': '2D Plan',
  '3d_render': '3D Render',
  color_palette: 'Color Palette',
  working_drawings: 'Working Drawings',
  bom: 'Bill of Materials',
};

const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const DELIVERABLE_STATUS_CLASSES: Record<DeliverableStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress:
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_review:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved:
    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const ALL_TYPES: DeliverableType[] = [
  '2d_plan',
  '3d_render',
  'color_palette',
  'working_drawings',
  'bom',
];

const ALL_STATUSES: DeliverableStatus[] = [
  'pending',
  'in_progress',
  'in_review',
  'approved',
  'rejected',
];

// ─── Deliverable card ─────────────────────────────────────────────────────────

interface DeliverableCardProps {
  deliverable: Deliverable;
  changeOrderIds: Set<string>;
  onStatusChange: (id: string, status: DeliverableStatus) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
}

function DeliverableCard({
  deliverable: d,
  changeOrderIds,
  onStatusChange,
  onApprove,
}: DeliverableCardProps) {
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleStatusChange(value: string) {
    setSaving(true);
    await onStatusChange(d.id, value as DeliverableStatus);
    setSaving(false);
  }

  async function handleApprove() {
    setApproving(true);
    await onApprove(d.id);
    setApproving(false);
  }

  const overCap = d.revisionCount > d.revisionCap;
  const showChangeOrderWarning = changeOrderIds.has(d.id) || overCap;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug text-gray-900 dark:text-white">
            {DELIVERABLE_TYPE_LABELS[d.type]}
          </CardTitle>
          <span
            className={[
              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
              DELIVERABLE_STATUS_CLASSES[d.status],
            ].join(' ')}
          >
            {DELIVERABLE_STATUS_LABELS[d.status]}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Change order warning */}
        {showChangeOrderWarning && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
            Revision cap exceeded — a change-order quote is required.
          </div>
        )}

        {/* Revision meter */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span
            className={
              overCap
                ? 'font-semibold text-red-600 dark:text-red-400'
                : 'font-medium'
            }
          >
            {d.revisionCount}
          </span>
          <span className="text-gray-400"> / {d.revisionCap} revisions</span>
        </p>

        {/* File link */}
        {d.latestFileUrl && (
          <a
            href={d.latestFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm text-blue-600 underline dark:text-blue-400"
          >
            View latest file
          </a>
        )}

        {/* Approved at */}
        {d.approvedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Approved on{' '}
            {new Date(d.approvedAt).toLocaleDateString('en-IN')}
          </p>
        )}

        {/* Status change select */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Change Status</Label>
          <Select
            value={d.status}
            onValueChange={handleStatusChange}
            disabled={saving}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {DELIVERABLE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Approve button */}
        {d.status !== 'approved' && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleApprove}
            disabled={approving}
          >
            {approving ? 'Approving…' : 'Approve'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add deliverable dialog ───────────────────────────────────────────────────

interface AddDeliverableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: (deliverable: Deliverable) => void;
}

function AddDeliverableDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: AddDeliverableDialogProps) {
  const [type, setType] = useState<DeliverableType>('2d_plan');
  const [revisionCap, setRevisionCap] = useState('2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(value: boolean) {
    if (!saving) {
      setError(null);
      onOpenChange(value);
    }
  }

  async function handleSubmit() {
    setError(null);
    const cap = parseInt(revisionCap, 10);
    if (isNaN(cap) || cap < 0) {
      setError('Revision cap must be a non-negative number');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, revisionCap: cap }),
      });

      const body = (await res.json()) as {
        data?: Deliverable;
        error?: string;
      };

      if (!res.ok) {
        setError(body.error ?? 'Failed to add deliverable');
        return;
      }

      if (body.data) {
        onCreated(body.data);
      }
      onOpenChange(false);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Deliverable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="del-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DeliverableType)}
            >
              <SelectTrigger id="del-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DELIVERABLE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Revision cap */}
          <div className="space-y-2">
            <Label htmlFor="del-cap">Revision Cap</Label>
            <Input
              id="del-cap"
              type="number"
              min={0}
              step={1}
              value={revisionCap}
              onChange={(e) => setRevisionCap(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Adding…' : 'Add Deliverable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DeliverablesPage({ params }: PageProps) {
  const { id } = use(params);

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which deliverable IDs have a server-reported changeOrderNeeded flag
  const [changeOrderIds, setChangeOrderIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}/deliverables`)
      .then((r) => r.json())
      .then(({ data }: { data: Deliverable[] }) => {
        setDeliverables(data ?? []);
      })
      .catch(() => {
        // leave empty state
      })
      .finally(() => setLoading(false));
  }, [id]);

  function updateDeliverable(updated: Deliverable) {
    setDeliverables((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d)),
    );
  }

  async function handleStatusChange(
    deliverableId: string,
    status: DeliverableStatus,
  ) {
    const res = await fetch(`/api/v1/deliverables/${deliverableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const body = (await res.json()) as {
      data?: Deliverable;
      changeOrderNeeded?: boolean;
      error?: string;
    };

    if (!res.ok || !body.data) return;

    updateDeliverable(body.data);

    if (body.changeOrderNeeded) {
      setChangeOrderIds((prev) => new Set(prev).add(deliverableId));
    }
  }

  async function handleApprove(deliverableId: string) {
    const res = await fetch(
      `/api/v1/deliverables/${deliverableId}/approve`,
      { method: 'POST' },
    );

    const body = (await res.json()) as {
      data?: Deliverable;
      error?: string;
    };

    if (!res.ok || !body.data) return;

    updateDeliverable(body.data);
    // Clear any change-order warning on explicit approval
    setChangeOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(deliverableId);
      return next;
    });
  }

  function handleCreated(deliverable: Deliverable) {
    setDeliverables((prev) => [deliverable, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; Back to Project
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Deliverables
        </h1>
        <Button onClick={() => setDialogOpen(true)}>+ Add Deliverable</Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading deliverables…</p>
        </div>
      ) : deliverables.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-500">No deliverables yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            Add first deliverable
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              changeOrderIds={changeOrderIds}
              onStatusChange={handleStatusChange}
              onApprove={handleApprove}
            />
          ))}
        </div>
      )}

      {/* Add Deliverable Dialog */}
      <AddDeliverableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={id}
        onCreated={handleCreated}
      />
    </div>
  );
}
