'use client';

import { use, useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
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
import { Textarea } from '@/components/ui/textarea';
import { formatRupees } from '@/lib/utils';
import { Milestone, MilestonePaymentStatus } from '@/types/milestones';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendLinkForm {
  clientName: string;
  contactPhone: string;
  placeOfSupply: string;
  isInterstate: boolean;
}

interface OverrideForm {
  newStatus: 'paid' | 'overdue' | '';
  note: string;
}

interface SendLinkResult {
  shortUrl: string;
}

const INITIAL_SEND_FORM: SendLinkForm = {
  clientName: '',
  contactPhone: '',
  placeOfSupply: '',
  isInterstate: false,
};

const INITIAL_OVERRIDE_FORM: OverrideForm = {
  newStatus: '',
  note: '',
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  MilestonePaymentStatus,
  { label: string; style: CSSProperties }
> = {
  pending: {
    label: 'Pending',
    style: { backgroundColor: 'rgba(107,114,128,0.12)', color: '#374151', borderColor: '#d1d5db' },
  },
  link_sent: {
    label: 'Link Sent',
    style: { backgroundColor: 'rgba(59,130,246,0.12)', color: '#1d4ed8', borderColor: '#bfdbfe' },
  },
  paid: {
    label: 'Paid',
    style: { backgroundColor: 'rgba(22,163,74,0.12)', color: '#15803d', borderColor: '#bbf7d0' },
  },
  overdue: {
    label: 'Overdue',
    style: { backgroundColor: 'rgba(220,38,38,0.12)', color: '#b91c1c', borderColor: '#fecaca' },
  },
};

function PaymentStatusBadge({ status }: { status: MilestonePaymentStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={cfg.style}
    >
      {cfg.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Send Payment Link dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [sendForm, setSendForm] = useState<SendLinkForm>(INITIAL_SEND_FORM);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendLinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Manual Override dialog state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideMilestone, setOverrideMilestone] = useState<Milestone | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>(INITIAL_OVERRIDE_FORM);
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadMilestones = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/milestones`)
      .then((r) => r.json())
      .then(({ data }: { data: Milestone[] }) => {
        setMilestones(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Summary counts ────────────────────────────────────────────────────────

  const totalPaidCount = milestones.filter((m) => m.paymentStatus === 'paid').length;
  const totalOutstandingCount = milestones.filter(
    (m) => m.paymentStatus !== 'paid',
  ).length;
  const totalPaidPaise = milestones
    .filter((m) => m.paymentStatus === 'paid')
    .reduce((sum, m) => sum + m.amountPaise, 0);
  const totalOutstandingPaise = milestones
    .filter((m) => m.paymentStatus !== 'paid')
    .reduce((sum, m) => sum + m.amountPaise, 0);

  // ─── Seed defaults ─────────────────────────────────────────────────────────

  async function handleSeedDefaults() {
    setSeedError(null);
    setSeeding(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedDefaults: true }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSeedError(
          typeof body.error === 'string'
            ? body.error
            : 'Failed to seed milestones',
        );
        return;
      }

      loadMilestones();
    } catch {
      setSeedError('Network error — please try again');
    } finally {
      setSeeding(false);
    }
  }

  // ─── Send payment link ─────────────────────────────────────────────────────

  function openSendDialog(milestone: Milestone) {
    setActiveMilestone(milestone);
    setSendForm(INITIAL_SEND_FORM);
    setSendError(null);
    setSendResult(null);
    setCopied(false);
    setSendDialogOpen(true);
  }

  function closeSendDialog() {
    setSendDialogOpen(false);
    setActiveMilestone(null);
    setSendResult(null);
  }

  function setSendField<K extends keyof SendLinkForm>(
    key: K,
    value: SendLinkForm[K],
  ) {
    setSendForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSendLink() {
    if (!activeMilestone) return;
    setSendError(null);

    if (!sendForm.clientName.trim()) {
      setSendError('Client name is required');
      return;
    }
    if (!sendForm.contactPhone.trim()) {
      setSendError('Contact phone is required');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/milestones/${activeMilestone.id}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: sendForm.clientName.trim(),
            contactPhone: sendForm.contactPhone.trim(),
            placeOfSupply: sendForm.placeOfSupply.trim() || undefined,
            isInterstate: sendForm.isInterstate,
          }),
        },
      );

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSendError(
          typeof body.error === 'string'
            ? body.error
            : 'Failed to send payment link',
        );
        return;
      }

      const body = (await res.json()) as {
        data: { paymentLink: { shortUrl: string } };
      };
      setSendResult({ shortUrl: body.data.paymentLink.shortUrl });
      loadMilestones();
    } catch {
      setSendError('Network error — please try again');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: silently fail
    }
  }

  // ─── Manual override ───────────────────────────────────────────────────────

  function openOverrideDialog(milestone: Milestone) {
    setOverrideMilestone(milestone);
    setOverrideForm(INITIAL_OVERRIDE_FORM);
    setOverrideError(null);
    setOverrideDialogOpen(true);
  }

  function closeOverrideDialog() {
    setOverrideDialogOpen(false);
    setOverrideMilestone(null);
  }

  async function handleOverride() {
    if (!overrideMilestone) return;
    setOverrideError(null);

    if (!overrideForm.newStatus) {
      setOverrideError('Please select a new status');
      return;
    }
    if (!overrideForm.note.trim()) {
      setOverrideError('A note is required for manual overrides');
      return;
    }

    setOverriding(true);
    try {
      const res = await fetch(
        `/api/v1/milestones/${overrideMilestone.id}/override`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newStatus: overrideForm.newStatus,
            note: overrideForm.note.trim(),
          }),
        },
      );

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setOverrideError(
          typeof body.error === 'string'
            ? body.error
            : 'Failed to apply override',
        );
        return;
      }

      closeOverrideDialog();
      loadMilestones();
    } catch {
      setOverrideError('Network error — please try again');
    } finally {
      setOverriding(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Project
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Milestone Payments
        </h2>
      </div>

      {/* Summary cards */}
      {!loading && milestones.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="premium-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatRupees(totalPaidPaise)}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                {totalPaidCount} milestone{totalPaidCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="premium-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Outstanding</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatRupees(totalOutstandingPaise)}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                {totalOutstandingCount} milestone
                {totalOutstandingCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Seed button */}
      {!loading && milestones.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 py-16">
          <p className="text-sm text-gray-500">No milestones yet.</p>
          {seedError && (
            <p className="text-xs text-red-600">{seedError}</p>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleSeedDefaults}
            disabled={seeding}
          >
            {seeding ? 'Seeding…' : 'Seed Default Milestones'}
          </button>
          <p className="text-xs text-gray-400">
            Creates 4 milestones at 10% / 40% / 40% / 10% of the contract value.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading milestones…</p>
        </div>
      )}

      {/* Milestone timeline */}
      {!loading && milestones.length > 0 && (
        <div className="relative space-y-0">
          {milestones.map((milestone, index) => {
            const isLast = index === milestones.length - 1;
            const showSendLink =
              milestone.paymentStatus === 'pending' ||
              milestone.paymentStatus === 'link_sent' ||
              milestone.paymentStatus === 'overdue';

            return (
              <div key={milestone.id} className="relative flex gap-4">
                {/* Timeline spine */}
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-6 h-4 w-4 shrink-0 rounded-full border-2 ${
                      milestone.paymentStatus === 'paid'
                        ? 'border-green-500 bg-green-500'
                        : milestone.paymentStatus === 'overdue'
                          ? 'border-red-500 bg-red-100'
                          : milestone.paymentStatus === 'link_sent'
                            ? 'border-blue-500 bg-blue-100'
                            : 'border-gray-300 bg-white'
                    }`}
                  />
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200" />
                  )}
                </div>

                {/* Milestone card */}
                <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                  <div className="premium-card p-5 transition-shadow hover:shadow-sm">
                    <div className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-gray-900">
                            {milestone.label}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-800">
                              {formatRupees(milestone.amountPaise)}
                            </span>
                            <span className="text-sm text-gray-400">
                              {milestone.pctOfTotal}%
                            </span>
                          </div>
                        </div>
                        <PaymentStatusBadge status={milestone.paymentStatus} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Paid date */}
                      {milestone.paidAt && (
                        <p className="text-sm text-gray-500">
                          Paid on{' '}
                          <span className="font-medium text-green-600">
                            {new Date(milestone.paidAt).toLocaleDateString(
                              'en-IN',
                              { day: '2-digit', month: 'short', year: 'numeric' },
                            )}
                          </span>
                        </p>
                      )}

                      {/* Trigger stage label */}
                      {milestone.triggerStage && (
                        <p className="text-xs text-gray-400">
                          Triggered at: {milestone.triggerStage.replace(/_/g, ' ')}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {showSendLink && (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => openSendDialog(milestone)}
                          >
                            Send Payment Link
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openOverrideDialog(milestone)}
                        >
                          Manual Override
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Send Payment Link Dialog ── */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => !open && closeSendDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Payment Link</DialogTitle>
            {activeMilestone && (
              <p className="text-sm text-gray-500">
                {activeMilestone.label} —{' '}
                <span className="font-semibold text-gray-700">
                  {formatRupees(activeMilestone.amountPaise)}
                </span>
              </p>
            )}
          </DialogHeader>

          {sendResult ? (
            /* Success state: show the short URL */
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium text-green-600">
                Payment link created successfully.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                <span className="flex-1 break-all text-sm text-gray-700">
                  {sendResult.shortUrl}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleCopy(sendResult.shortUrl)}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={closeSendDialog}
                >
                  Close
                </button>
              </DialogFooter>
            </div>
          ) : (
            /* Form state */
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="send-clientName">Client Name</Label>
                <Input
                  id="send-clientName"
                  placeholder="Ramesh Sharma"
                  value={sendForm.clientName}
                  onChange={(e) => setSendField('clientName', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="send-phone">Contact Phone</Label>
                <Input
                  id="send-phone"
                  placeholder="+91 98765 43210"
                  value={sendForm.contactPhone}
                  onChange={(e) => setSendField('contactPhone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="send-pos">
                  Place of Supply{' '}
                  <span className="text-xs text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="send-pos"
                  placeholder="Tamil Nadu"
                  value={sendForm.placeOfSupply}
                  onChange={(e) => setSendField('placeOfSupply', e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send-interstate"
                  checked={sendForm.isInterstate}
                  onChange={(e) => setSendField('isInterstate', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="send-interstate" className="cursor-pointer">
                  Interstate supply (IGST 18%)
                </Label>
              </div>

              {sendError && (
                <p className="text-xs text-red-600">
                  {sendError}
                </p>
              )}

              <DialogFooter>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeSendDialog}
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendLink}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send Link'}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Manual Override Dialog ── */}
      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => !open && closeOverrideDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Override</DialogTitle>
            {overrideMilestone && (
              <p className="text-sm text-gray-500">
                {overrideMilestone.label} —{' '}
                <span className="font-semibold text-gray-700">
                  {formatRupees(overrideMilestone.amountPaise)}
                </span>
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="override-status">New Status</Label>
              <Select
                value={overrideForm.newStatus}
                onValueChange={(val) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    newStatus: val as 'paid' | 'overdue',
                  }))
                }
              >
                <SelectTrigger id="override-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-note">Note</Label>
              <Textarea
                id="override-note"
                placeholder="Reason for manual override…"
                rows={3}
                value={overrideForm.note}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>

            {overrideError && (
              <p className="text-xs text-red-600">
                {overrideError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="btn-secondary"
              onClick={closeOverrideDialog}
              disabled={overriding}
            >
              Cancel
            </button>
            <button
              type="button"
              className={overrideForm.newStatus === 'overdue' ? 'btn-secondary' : 'btn-primary'}
              style={overrideForm.newStatus === 'overdue' ? { backgroundColor: '#b91c1c', color: '#fff', borderColor: '#b91c1c' } : undefined}
              onClick={handleOverride}
              disabled={overriding}
            >
              {overriding ? 'Applying…' : 'Apply Override'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
