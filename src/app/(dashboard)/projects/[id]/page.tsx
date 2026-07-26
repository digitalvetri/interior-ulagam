'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  const chipClasses: Record<CostToComplete['status'], string> = {
    on_track:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    watch:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    overrun:
      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };

  const chipLabels: Record<CostToComplete['status'], string> = {
    on_track: 'On Track',
    watch: 'Watch',
    overrun: 'Over Budget',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          Cost-to-Complete Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overrun banner */}
        {status === 'overrun' && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            Cost overrun detected! Review expenses.
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {formatRupees(actualExpensesPaise)} spent of{' '}
              {formatRupees(quotedCostPaise)} quoted cost ({burnPct}%)
            </span>
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                chipClasses[status],
              ].join(' ')}
            >
              {chipLabels[status]}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={['h-full rounded-full transition-all', progressColor].join(' ')}
              style={{ width: `${Math.min(burnPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining / variance */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Remaining: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatRupees(remainingPaise)}
            </span>
          </div>
          {variancePaise > 0 && (
            <div className="text-red-600 dark:text-red-400">
              <span className="font-medium">{formatRupees(variancePaise)} over quoted cost</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment status colour mapping ───────────────────────────────────────────

const PAYMENT_STATUS_CLASSES: Record<MilestonePaymentStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  link_sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
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
                      : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900',
                  ].join(' ')}
                />
                {/* Label */}
                <span
                  className={[
                    'max-w-[80px] text-center text-[10px] leading-tight',
                    isCurrent
                      ? 'font-semibold text-blue-600 dark:text-blue-400'
                      : isPast
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-600',
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
                      : 'bg-gray-200 dark:bg-gray-700',
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
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; All Projects
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
              ].join(' ')}
            >
              {LIFECYCLE_STAGE_LABELS[project.lifecycleStage]}
            </span>
            {project.expectedEndAt && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Due{' '}
                {new Date(project.expectedEndAt).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Advance Stage */}
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={handleAdvanceStage}
            disabled={advancingStage || !nextStage}
          >
            {advancingStage
              ? 'Advancing…'
              : nextStage
              ? `Advance to ${LIFECYCLE_STAGE_LABELS[nextStage]}`
              : 'Project Complete'}
          </Button>
          {stageError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {stageError}
            </p>
          )}
        </div>
      </div>

      {/* Lifecycle stepper */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Project Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <LifecycleStepper currentStage={project.lifecycleStage} />
        </CardContent>
      </Card>

      {/* Milestones */}
      {milestones.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Milestones
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-2 pt-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {m.label}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatRupees(m.amountPaise)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.pctOfTotal}% of total
                  </p>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      PAYMENT_STATUS_CLASSES[m.paymentStatus],
                    ].join(' ')}
                  >
                    {PAYMENT_STATUS_LABELS[m.paymentStatus]}
                  </span>
                </CardContent>
              </Card>
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Project Sections
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="pt-4">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {link.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
