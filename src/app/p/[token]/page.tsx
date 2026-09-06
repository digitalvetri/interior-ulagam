'use client';

import { use, useCallback, useEffect, useState } from 'react';
import type { ClientProjectSnapshot, SnagItem, ClientMilestone, ClientDeliverable, ClientSiteLog, ClientDesignDeliverable } from '@/types/snag';
import { formatRupees } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type LifecycleStage = ClientProjectSnapshot['project']['lifecycleStage'];

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<LifecycleStage, string> = {
  design_pending:    'Design Pending',
  design_in_progress:'Design In Progress',
  design_approved:   'Design Approved',
  procurement:       'Procurement',
  execution:         'Execution',
  snagging:          'Snagging',
  handover:          'Handover',
  complete:          'Complete',
};

const DELIVERABLE_LABEL: Record<ClientDeliverable['type'], string> = {
  '2d_plan':         '2D Floor Plan',
  '3d_render':       '3D Render',
  color_palette:     'Colour Palette',
  working_drawings:  'Working Drawings',
  bom:               'Bill of Materials',
};

// ─── Small UI helpers ──────────────────────────────────────────────────────────

function PaymentStatusIcon({ status }: { status: ClientMilestone['paymentStatus'] }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
      <span className="sr-only">Pending</span>
    </span>
  );
}

function SnagStatusChip({ status }: { status: SnagItem['status'] }) {
  const classes: Record<SnagItem['status'], string> = {
    open:             'bg-red-100 text-red-700',
    in_progress:      'bg-orange-100 text-orange-700',
    resolved:         'bg-blue-100 text-blue-700',
    client_confirmed: 'bg-green-100 text-green-700',
  };
  const labels: Record<SnagItem['status'], string> = {
    open:             'Open',
    in_progress:      'In Progress',
    resolved:         'Resolved',
    client_confirmed: 'Client Confirmed',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Design Deliverable card with approve / request-changes ────────────────────

function DesignDeliverableCard({ deliverable, token, onUpdated }: {
  deliverable: ClientDesignDeliverable;
  token: string;
  onUpdated: (id: string, newStatus: string) => void;
}) {
  const [busy, setBusy]               = useState<string | null>(null);
  const [showCommentBox, setShowBox]  = useState(false);
  const [comment, setComment]         = useState('');
  const [localStatus, setLocalStatus] = useState(deliverable.status);

  async function act(action: 'approve' | 'changes_requested') {
    setBusy(action);
    try {
      const res = await fetch(`/api/v1/client-view/${token}/deliverables/${deliverable.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      setLocalStatus(action === 'approve' ? 'approved' : 'changes_requested');
      onUpdated(deliverable.id, action === 'approve' ? 'approved' : 'changes_requested');
      setShowBox(false);
    } catch {
      // silent — buttons re-enable
    } finally {
      setBusy(null);
    }
  }

  const isDone = localStatus === 'approved' || localStatus === 'changes_requested';

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{deliverable.title}</p>
          <p className="text-xs text-gray-400 capitalize">{deliverable.type.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {localStatus === 'approved' && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Approved</span>
          )}
          {localStatus === 'changes_requested' && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Changes requested</span>
          )}
          {deliverable.latestFileUrl && (
            <a
              href={deliverable.latestFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View file
            </a>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="space-y-2">
          {showCommentBox && (
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe the changes needed…"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => act('approve')}
              disabled={!!busy}
              className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {busy === 'approve' ? 'Approving…' : '✓ Approve'}
            </button>
            {!showCommentBox && (
              <button
                type="button"
                onClick={() => setShowBox(true)}
                disabled={!!busy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Request changes
              </button>
            )}
            {showCommentBox && (
              <>
                <button
                  type="button"
                  onClick={() => act('changes_requested')}
                  disabled={!!busy || !comment.trim()}
                  className="rounded-lg border border-orange-400 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  {busy === 'changes_requested' ? 'Sending…' : 'Send request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBox(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Snag confirm card ─────────────────────────────────────────────────────────

function SnagCard({ snag, token, onConfirmed }: {
  snag: SnagItem;
  token: string;
  onConfirmed: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localStatus, setStatus] = useState(snag.status);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/client-view/${token}/snags/${snag.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('client_confirmed');
      onConfirmed(snag.id);
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-800">{snag.description}</p>
        <SnagStatusChip status={localStatus} />
      </div>
      {snag.photoUrl && (
        <a href={snag.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snag.photoUrl} alt="Snag photo" className="h-24 w-auto rounded-md object-cover border border-gray-200" />
        </a>
      )}
      {localStatus === 'resolved' && !snag.clientConfirmedAt && (
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="mt-2 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Confirming…' : '✓ Confirm resolved'}
        </button>
      )}
      {snag.clientConfirmedAt && (
        <p className="mt-1 text-xs text-gray-400">
          Confirmed on {new Date(snag.clientConfirmedAt).toLocaleDateString('en-IN')}
        </p>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export default function ClientTrustTimelinePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [data, setData]     = useState<ClientProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  const load = useCallback(() => {
    fetch(`/api/v1/client-view/${token}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) { setError(true); setLoading(false); return null; }
        return r.json();
      })
      .then(body => {
        if (body) { setData(body.data as ClientProjectSnapshot); }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function handleDeliverableUpdate(id: string, newStatus: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pendingDesignDeliverables: prev.pendingDesignDeliverables.map(d =>
          d.id === id ? { ...d, status: newStatus as ClientDesignDeliverable['status'] } : d,
        ),
      };
    });
  }

  function handleSnagConfirmed(id: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        snagItems: prev.snagItems.map(s =>
          s.id === id ? { ...s, status: 'client_confirmed' as const, clientConfirmedAt: new Date().toISOString() } : s,
        ),
      };
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-gray-800">Link Not Found</h1>
          <p className="mt-3 text-gray-500">
            This project link is invalid or has expired. Please contact your designer for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const { project, milestones, deliverables, pendingDesignDeliverables, recentSiteLogs, snagItems } = data;
  const allPhotos: string[] = recentSiteLogs.flatMap((log: ClientSiteLog) => log.photos);
  const unpaidMilestones = milestones.filter(m => m.paymentStatus !== 'paid');

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Konst Design</p>
            <h1 className="mt-0.5 text-xl font-bold text-gray-900">{project.name}</h1>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 border border-amber-200">
            {STAGE_LABEL[project.lifecycleStage]}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">

        {/* Expected Completion */}
        {project.expectedEndAt && (
          <section>
            <p className="text-sm text-gray-500">
              Expected completion:{' '}
              <span className="font-medium text-gray-800">
                {new Date(project.expectedEndAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          </section>
        )}

        {/* Design Deliverables — awaiting approval */}
        {pendingDesignDeliverables.length > 0 && (
          <section>
            <h2 className="mb-1 text-base font-semibold text-gray-900">Design Deliverables</h2>
            <p className="mb-4 text-xs text-gray-500">Please review and approve the designs below, or request changes.</p>
            <div className="space-y-3">
              {pendingDesignDeliverables.map(d => (
                <DesignDeliverableCard key={d.id} deliverable={d} token={token} onUpdated={handleDeliverableUpdate} />
              ))}
            </div>
          </section>
        )}

        {/* Payment Milestones */}
        {milestones.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Payment Milestones</h2>
            <div className="space-y-3">
              {milestones.map((milestone: ClientMilestone) => (
                <div key={milestone.id} className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <PaymentStatusIcon status={milestone.paymentStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{milestone.label}</p>
                    {milestone.paidAt && (
                      <p className="text-xs text-gray-400">Paid on {new Date(milestone.paidAt).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatRupees(milestone.amountPaise)}</p>
                    <p className="text-xs text-gray-400">{milestone.pctOfTotal}% of total</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pay now — for unpaid milestones with a Razorpay link */}
            {unpaidMilestones.some(m => m.razorpayLinkId) && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">Pay securely online</p>
                {unpaidMilestones.filter(m => m.razorpayLinkId).map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-500">{formatRupees(m.amountPaise)}</p>
                    </div>
                    <a
                      href={`https://rzp.io/l/${m.razorpayLinkId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                    >
                      Pay now →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Approved Deliverables (download only) */}
        {deliverables.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Approved Deliverables</h2>
            <div className="space-y-2">
              {deliverables.map((deliverable: ClientDeliverable) => (
                <div key={deliverable.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{DELIVERABLE_LABEL[deliverable.type]}</p>
                    {deliverable.approvedAt && (
                      <p className="text-xs text-gray-400">Approved {new Date(deliverable.approvedAt).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                  {deliverable.latestFileUrl && (
                    <a
                      href={deliverable.latestFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Site Photos */}
        {allPhotos.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Site Progress Photos</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allPhotos.map((url: string, idx: number) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Site photo ${idx + 1}`}
                    className="h-32 w-full rounded-lg object-cover border border-gray-200 hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Snag Items — resolved/confirm */}
        {snagItems.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Resolved Snag Items</h2>
            <div className="space-y-3">
              {snagItems.map((snag: SnagItem) => (
                <SnagCard key={snag.id} snag={snag} token={token} onConfirmed={handleSnagConfirmed} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">Powered by Konst Design — DigitalVetri</p>
      </footer>
    </div>
  );
}
