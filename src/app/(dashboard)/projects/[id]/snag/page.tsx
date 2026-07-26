'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { SnagItem, SnagStatus } from '@/types/snag';

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const STATUS_BADGE_VARIANT: Record<SnagStatus, BadgeVariant> = {
  open: 'destructive',
  in_progress: 'secondary',
  resolved: 'outline',
  client_confirmed: 'default',
};

const STATUS_LABEL: Record<SnagStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  client_confirmed: 'Client Confirmed',
};

const STATUS_OPTIONS: SnagStatus[] = ['open', 'in_progress', 'resolved', 'client_confirmed'];

interface AddSnagForm {
  description: string;
  photoUrl: string;
  assigneeId: string;
}

const INITIAL_FORM: AddSnagForm = {
  description: '',
  photoUrl: '',
  assigneeId: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SnagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [snagItems, setSnagItems] = useState<SnagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add snag dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AddSnagForm>(INITIAL_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Client link
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Handover
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverResult, setHandoverResult] = useState<{ success: boolean; message: string } | null>(null);

  // Per-card status update tracking
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<Record<string, string>>({});

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data load ──
  const loadSnagItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/projects/${id}/snag-items`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setLoadError(body.error ?? 'Failed to load snag items');
        return;
      }
      const { data } = (await res.json()) as { data: SnagItem[] };
      setSnagItems(data ?? []);
    } catch {
      setLoadError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Data fetch on mount — TanStack Query refactor tracked separately.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSnagItems(); }, [loadSnagItems]);

  // ── Add snag ──
  function openDialog() {
    setForm(INITIAL_FORM);
    setAddError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof AddSnagForm>(key: K, value: AddSnagForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddSnag() {
    setAddError(null);
    if (!form.description.trim()) {
      setAddError('Description is required');
      return;
    }

    const body: { description: string; photoUrl?: string; assigneeId?: string } = {
      description: form.description.trim(),
    };
    if (form.photoUrl.trim()) body.photoUrl = form.photoUrl.trim();
    if (form.assigneeId.trim()) body.assigneeId = form.assigneeId.trim();

    setAdding(true);
    try {
      const res = await fetch(`/api/v1/projects/${id}/snag-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setAddError(typeof json.error === 'string' ? json.error : 'Failed to add snag item');
        return;
      }

      const { data: created } = (await res.json()) as { data: SnagItem };
      setSnagItems((prev) => [...prev, created]);
      setDialogOpen(false);
    } catch {
      setAddError('Network error — please try again');
    } finally {
      setAdding(false);
    }
  }

  // ── Status update ──
  async function handleStatusChange(snag: SnagItem, newStatus: SnagStatus) {
    if (snag.status === newStatus) return;
    setUpdatingStatus((prev) => ({ ...prev, [snag.id]: true }));
    setStatusError((prev) => {
      const next = { ...prev };
      delete next[snag.id];
      return next;
    });
    try {
      const res = await fetch(`/api/v1/snag-items/${snag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatusError((prev) => ({
          ...prev,
          [snag.id]: body.error ?? `Failed to update (${res.status})`,
        }));
        return;
      }

      const { data: updated } = (await res.json()) as { data: SnagItem };
      setSnagItems((prev) => prev.map((s) => (s.id === snag.id ? updated : s)));
    } catch {
      setStatusError((prev) => ({
        ...prev,
        [snag.id]: 'Network error — please try again',
      }));
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [snag.id]: false }));
    }
  }

  // ── Client link ──
  async function handleGenerateClientLink() {
    setLinkLoading(true);
    setLinkError(null);
    setClientUrl(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/v1/projects/${id}/client-token`);
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setLinkError(json.error ?? 'Failed to generate link');
        return;
      }
      const { data } = (await res.json()) as { data: { token: string; url: string } };
      setClientUrl(data.url);
    } catch {
      setLinkError('Network error — please try again');
    } finally {
      setLinkLoading(false);
    }
  }

  function handleCopyLink() {
    if (!clientUrl) return;
    void navigator.clipboard.writeText(clientUrl).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Handover ──
  const allClear =
    snagItems.length === 0 ||
    snagItems.every((s) => s.status === 'resolved' || s.status === 'client_confirmed');

  async function handleInitiateHandover() {
    setHandoverLoading(true);
    setHandoverResult(null);
    try {
      const res = await fetch(`/api/v1/projects/${id}/handover`, { method: 'POST' });
      const json = (await res.json()) as { data?: { message?: string }; error?: string };
      if (!res.ok) {
        setHandoverResult({ success: false, message: json.error ?? 'Handover failed' });
        return;
      }
      setHandoverResult({ success: true, message: json.data?.message ?? 'Handover initiated' });
    } catch {
      setHandoverResult({ success: false, message: 'Network error — please try again' });
    } finally {
      setHandoverLoading(false);
    }
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            &larr; Back to Project
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Snag List</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleGenerateClientLink} disabled={linkLoading}>
            {linkLoading ? 'Generating…' : 'Generate Client Link'}
          </Button>
          <Button onClick={openDialog}>+ Add Snag Item</Button>
        </div>
      </div>

      {/* Client link result */}
      {clientUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <span className="flex-1 truncate font-mono text-gray-700">{clientUrl}</span>
          <Button size="sm" variant="outline" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}
      {linkError && (
        <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>
      )}

      {/* Snag list */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading snag items…</p>
        </div>
      ) : loadError ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-red-600">{loadError}</p>
        </div>
      ) : snagItems.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-500">No snag items yet.</p>
          <Button variant="outline" size="sm" onClick={openDialog}>
            Add the first snag item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snagItems.map((snag) => (
            <Card key={snag.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium leading-snug text-gray-900 dark:text-white">
                    {snag.description}
                  </CardTitle>
                  <Badge variant={STATUS_BADGE_VARIANT[snag.status]} className="shrink-0">
                    {STATUS_LABEL[snag.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {/* Photo */}
                {snag.photoUrl && (
                  <a href={snag.photoUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={snag.photoUrl}
                      alt="Snag photo"
                      className="h-28 w-full rounded-md object-cover border border-gray-200 hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}

                {/* Meta */}
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {snag.assigneeId && (
                    <p>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Assignee:</span>{' '}
                      {snag.assigneeId}
                    </p>
                  )}
                  {snag.clientConfirmedAt && (
                    <p>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Client confirmed:</span>{' '}
                      {new Date(snag.clientConfirmedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  <p>
                    Added {new Date(snag.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>

                {/* Status select */}
                <div>
                  <Label htmlFor={`status-${snag.id}`} className="sr-only">
                    Update status
                  </Label>
                  <select
                    id={`status-${snag.id}`}
                    value={snag.status}
                    disabled={updatingStatus[snag.id]}
                    onChange={(e) => void handleStatusChange(snag, e.target.value as SnagStatus)}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {statusError[snag.id] && (
                    <p
                      className="mt-1 text-xs text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {statusError[snag.id]}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Handover section */}
      {allClear && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
          <p className="mb-3 text-sm font-medium text-green-800 dark:text-green-200">
            {snagItems.length === 0
              ? 'No snag items. You can proceed to handover.'
              : 'All snag items are resolved or client-confirmed. You can initiate handover.'}
          </p>
          <Button
            onClick={() => void handleInitiateHandover()}
            disabled={handoverLoading}
            className="bg-green-700 text-white hover:bg-green-800"
          >
            {handoverLoading ? 'Initiating…' : 'Initiate Handover'}
          </Button>
          {handoverResult && (
            <p
              className={`mt-2 text-xs font-medium ${
                handoverResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {handoverResult.message}
            </p>
          )}
        </div>
      )}

      {/* Add Snag Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Snag Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="snag-description">Description</Label>
              <Textarea
                id="snag-description"
                placeholder="Describe the snag item…"
                rows={3}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snag-photo">
                Photo URL{' '}
                <span className="text-xs text-gray-400">(optional)</span>
              </Label>
              <Input
                id="snag-photo"
                type="url"
                placeholder="https://…"
                value={form.photoUrl}
                onChange={(e) => setField('photoUrl', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snag-assignee">
                Assignee ID{' '}
                <span className="text-xs text-gray-400">(optional UUID)</span>
              </Label>
              <Input
                id="snag-assignee"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={form.assigneeId}
                onChange={(e) => setField('assigneeId', e.target.value)}
              />
            </div>

            {addError && (
              <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAddSnag()} disabled={adding}>
              {adding ? 'Adding…' : 'Add Snag Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
