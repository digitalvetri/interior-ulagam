'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { formatRupees } from '@/lib/utils';
import { Project, ProjectStage } from '@/types/quotes';
import { Milestone, MilestonePaymentStatus } from '@/types/milestones';
import {
  LIFECYCLE_STAGE_ORDER,
  LIFECYCLE_STAGE_LABELS,
} from '@/types/deliverables';

// ─── Cost-to-Complete types ───────────────────────────────────────────────────

interface CostToComplete {
  quotedCostPaise: number;
  quotedClientPaise: number;
  actualExpensesPaise: number;
  remainingPaise: number;
  variancePaise: number;
  burnPct: number;
  status: 'on_track' | 'watch' | 'overrun';
}

// ─── Cost-to-Complete widget ──────────────────────────────────────────────────

interface CostTrackerProps {
  data: CostToComplete;
}

function CostTracker({ data }: CostTrackerProps) {
  const { burnPct, actualExpensesPaise, quotedCostPaise, remainingPaise, variancePaise, status } = data;

  const progressColor =
    burnPct < 60
      ? 'bg-green-500'
      : burnPct < 80
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const chipStyles: Record<CostToComplete['status'], CSSProperties> = {
    on_track: { backgroundColor: 'rgba(22,163,74,0.12)', color: '#15803d' },
    watch: { backgroundColor: 'rgba(202,138,4,0.12)', color: '#b45309' },
    overrun: { backgroundColor: 'rgba(220,38,38,0.12)', color: '#b91c1c' },
  };

  const chipLabels: Record<CostToComplete['status'], string> = {
    on_track: 'On Track',
    watch: 'Watch',
    overrun: 'Over Budget',
  };

  return (
    <div className="premium-card p-5">
      <p className="mb-3 text-base font-semibold text-gray-900">
        Cost-to-Complete Tracker
      </p>
      <div className="space-y-3">
        {/* Overrun banner */}
        {status === 'overrun' && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm font-medium text-red-700">
            Cost overrun detected! Review expenses.
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>
              {formatRupees(actualExpensesPaise)} spent of{' '}
              {formatRupees(quotedCostPaise)} quoted cost ({burnPct}%)
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={chipStyles[status]}
            >
              {chipLabels[status]}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={['h-full rounded-full transition-all', progressColor].join(' ')}
              style={{ width: `${Math.min(burnPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining / variance */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Remaining: </span>
            <span className="font-medium text-gray-900">
              {formatRupees(remainingPaise)}
            </span>
          </div>
          {variancePaise > 0 && (
            <div className="text-red-600">
              <span className="font-medium">{formatRupees(variancePaise)} over quoted cost</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Payment status colour mapping ───────────────────────────────────────────

const PAYMENT_STATUS_STYLES: Record<MilestonePaymentStatus, CSSProperties> = {
  pending: { backgroundColor: 'rgba(107,114,128,0.12)', color: '#374151' },
  link_sent: { backgroundColor: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  paid: { backgroundColor: 'rgba(22,163,74,0.12)', color: '#15803d' },
  overdue: { backgroundColor: 'rgba(220,38,38,0.12)', color: '#b91c1c' },
};

const PAYMENT_STATUS_LABELS: Record<MilestonePaymentStatus, string> = {
  pending: 'Pending',
  link_sent: 'Link Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

// ─── Navigation link definitions ─────────────────────────────────────────────

interface NavLink {
  href: string;
  label: string;
  description: string;
}

function buildNavLinks(projectId: string): NavLink[] {
  return [
    {
      href: `/projects/${projectId}/deliverables`,
      label: 'Deliverables',
      description: '2D plans, renders, working drawings',
    },
    {
      href: `/projects/${projectId}/payments`,
      label: 'Payments',
      description: 'Milestones, links & receipts',
    },
    {
      href: `/projects/${projectId}/site`,
      label: 'Site Logs',
      description: 'Daily progress updates',
    },
    {
      href: `/projects/${projectId}/boq`,
      label: 'BOQ',
      description: 'Bill of quantities',
    },
    {
      href: `/projects/${projectId}/expenses`,
      label: 'Expenses',
      description: 'Petty cash, transport, materials',
    },
    {
      href: `/projects/${projectId}/snag`,
      label: 'Snag List',
      description: 'Open snag items & resolution',
    },
  ];
}

// ─── Lifecycle stepper ────────────────────────────────────────────────────────

interface StepperProps {
  currentStage: ProjectStage;
}

function LifecycleStepper({ currentStage }: StepperProps) {
  const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-0">
        {LIFECYCLE_STAGE_ORDER.map((stage, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast = idx === LIFECYCLE_STAGE_ORDER.length - 1;

          return (
            <li key={stage} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                {/* Dot */}
                <div
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full border-2',
                    isCurrent
                      ? 'border-blue-600 bg-blue-600'
                      : isPast
                      ? 'border-gray-400 bg-gray-400'
                      : 'border-gray-300 bg-white',
                  ].join(' ')}
                />
                {/* Label */}
                <span
                  className={[
                    'max-w-[80px] text-center text-[10px] leading-tight',
                    isCurrent
                      ? 'font-semibold text-blue-600'
                      : isPast
                      ? 'text-gray-500'
                      : 'text-gray-400',
                  ].join(' ')}
                >
                  {LIFECYCLE_STAGE_LABELS[stage]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={[
                    'mx-1 h-0.5 w-8 shrink-0',
                    idx < currentIdx
                      ? 'bg-gray-400'
                      : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [costData, setCostData] = useState<CostToComplete | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/projects/${id}`).then((r) => r.json()),
      fetch(`/api/v1/projects/${id}/milestones`).then((r) => r.json()),
      fetch(`/api/v1/projects/${id}/cost-to-complete`).then((r) => r.json()),
    ])
      .then(
        ([projectRes, milestonesRes, costRes]: [
          { data: Project },
          { data: Milestone[] },
          { data: CostToComplete },
        ]) => {
          setProject(projectRes.data ?? null);
          setMilestones(milestonesRes.data ?? []);
          setCostData(costRes.data ?? null);
        },
      )
      .catch(() => {
        // leave loading state resolved with empty data
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAdvanceStage() {
    if (!project) return;

    const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(project.lifecycleStage);
    const nextStage = LIFECYCLE_STAGE_ORDER[currentIdx + 1];
    if (!nextStage) return;

    setStageError(null);
    setAdvancingStage(true);

    try {
      const res = await fetch(`/api/v1/projects/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });

      const body = (await res.json()) as { data?: Project; error?: string };

      if (!res.ok) {
        setStageError(body.error ?? 'Failed to advance stage');
        return;
      }

      if (body.data) {
        setProject(body.data);
      }
    } catch {
      setStageError('Network error — please try again');
    } finally {
      setAdvancingStage(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-gray-500">Project not found.</p>
        <Link href="/projects" className="text-sm text-blue-600 underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(project.lifecycleStage);
  const nextStage = LIFECYCLE_STAGE_ORDER[currentIdx + 1] ?? null;
  const navLinks = buildNavLinks(id);

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; All Projects
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(200,155,60,0.15)', color: '#C89B3C' }}
            >
              {LIFECYCLE_STAGE_LABELS[project.lifecycleStage]}
            </span>
            {project.expectedEndAt && (
              <span className="text-sm text-gray-500">
                Due{' '}
                {new Date(project.expectedEndAt).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Advance Stage */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            className="btn-primary"
            onClick={handleAdvanceStage}
            disabled={advancingStage || !nextStage}
          >
            {advancingStage
              ? 'Advancing…'
              : nextStage
              ? `Advance to ${LIFECYCLE_STAGE_LABELS[nextStage]}`
              : 'Project Complete'}
          </button>
          {stageError && (
            <p className="text-xs text-red-600">
              {stageError}
            </p>
          )}
        </div>
      </div>

      {/* Lifecycle stepper */}
      <div className="premium-card p-5">
        <p className="mb-3 text-sm font-medium text-gray-500">
          Project Progress
        </p>
        <div className="pb-1">
          <LifecycleStepper currentStage={project.lifecycleStage} />
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Milestones
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <div key={m.id} className="premium-card p-5 space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {m.label}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {formatRupees(m.amountPaise)}
                </p>
                <p className="text-xs text-gray-500">
                  {m.pctOfTotal}% of total
                </p>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={PAYMENT_STATUS_STYLES[m.paymentStatus]}
                >
                  {PAYMENT_STATUS_LABELS[m.paymentStatus]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cost Tracker */}
      {costData && (
        <section>
          <CostTracker data={costData} />
        </section>
      )}

      {/* Navigation links */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Project Sections
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="premium-card p-5 h-full cursor-pointer">
                <p className="font-medium text-gray-900">
                  {link.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
