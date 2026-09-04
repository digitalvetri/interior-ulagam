import type { ClientProjectSnapshot, SnagItem, ClientMilestone, ClientDeliverable, ClientSiteLog } from '@/types/snag';
import { formatRupees } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type LifecycleStage = ClientProjectSnapshot['project']['lifecycleStage'];

const STAGE_LABEL: Record<LifecycleStage, string> = {
  design_pending: 'Design Pending',
  design_in_progress: 'Design In Progress',
  design_approved: 'Design Approved',
  procurement: 'Procurement',
  execution: 'Execution',
  snagging: 'Snagging',
  handover: 'Handover',
  complete: 'Complete',
};

const DELIVERABLE_LABEL: Record<ClientDeliverable['type'], string> = {
  '2d_plan': '2D Floor Plan',
  '3d_render': '3D Render',
  color_palette: 'Colour Palette',
  working_drawings: 'Working Drawings',
  bom: 'Bill of Materials',
};

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
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-orange-100 text-orange-700',
    resolved: 'bg-blue-100 text-blue-700',
    client_confirmed: 'bg-green-100 text-green-700',
  };
  const labels: Record<SnagItem['status'], string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    client_confirmed: 'Client Confirmed',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}

export default async function ClientTrustTimelinePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/v1/client-view/${token}`, { cache: 'no-store' });

  if (!res.ok) {
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

  const { data }: { data: ClientProjectSnapshot } = await res.json();
  const { project, milestones, deliverables, recentSiteLogs, snagItems } = data;

  const allPhotos: string[] = recentSiteLogs.flatMap((log: ClientSiteLog) => log.photos);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Konst Design
            </p>
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
                {new Date(project.expectedEndAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
          </section>
        )}

        {/* Milestone Timeline */}
        {milestones.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Payment Milestones</h2>
            <div className="space-y-3">
              {milestones.map((milestone: ClientMilestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <PaymentStatusIcon status={milestone.paymentStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{milestone.label}</p>
                    {milestone.paidAt && (
                      <p className="text-xs text-gray-400">
                        Paid on {new Date(milestone.paidAt).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatRupees(milestone.amountPaise)}
                    </p>
                    <p className="text-xs text-gray-400">{milestone.pctOfTotal}% of total</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Approved Deliverables */}
        {deliverables.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Approved Deliverables</h2>
            <div className="space-y-2">
              {deliverables.map((deliverable: ClientDeliverable) => (
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {DELIVERABLE_LABEL[deliverable.type]}
                    </p>
                    {deliverable.approvedAt && (
                      <p className="text-xs text-gray-400">
                        Approved {new Date(deliverable.approvedAt).toLocaleDateString('en-IN')}
                      </p>
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
                  <img
                    src={url}
                    alt={`Site photo ${idx + 1}`}
                    className="h-32 w-full rounded-lg object-cover border border-gray-200 hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Resolved Snag Items */}
        {snagItems.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Resolved Snag Items</h2>
            <div className="space-y-3">
              {snagItems.map((snag: SnagItem) => (
                <div
                  key={snag.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-800">{snag.description}</p>
                    <SnagStatusChip status={snag.status} />
                  </div>
                  {snag.photoUrl && (
                    <a href={snag.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={snag.photoUrl}
                        alt="Snag photo"
                        className="h-24 w-auto rounded-md object-cover border border-gray-200"
                      />
                    </a>
                  )}
                  {snag.clientConfirmedAt && (
                    <p className="mt-1 text-xs text-gray-400">
                      Confirmed on {new Date(snag.clientConfirmedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
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
