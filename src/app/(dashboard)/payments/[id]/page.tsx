'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { formatRupees } from '@/lib/utils';

type PaymentStatus = 'pending' | 'link_sent' | 'paid' | 'overdue';

interface Milestone {
  id: string;
  projectId: string;
  label: string;
  pctOfTotal: number;
  amountPaise: number;
  triggerStage: string | null;
  invoiceId: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  razorpayLinkId: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  customerFullName: string | null;
  leadContactName: string | null;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; bg: string; color: string }
> = {
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  link_sent: { label: 'Link Sent', bg: 'var(--blue-soft, #dbeafe)', color: 'var(--blue, #2563eb)' },
  paid:      { label: 'Paid',      bg: 'var(--success-soft)',  color: 'var(--success)' },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',   color: 'var(--danger-text, var(--danger))' },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <dt className="text-sm shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd className="text-sm font-medium text-right" style={{ color: 'var(--text-heading)' }}>{children}</dd>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl border p-5 animate-pulse space-y-3"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="h-4 w-1/3 rounded" style={{ background: 'var(--surface-muted)' }} />
      <div className="h-4 w-2/3 rounded" style={{ background: 'var(--surface-muted)' }} />
      <div className="h-4 w-1/2 rounded" style={{ background: 'var(--surface-muted)' }} />
    </div>
  );
}

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const msRes = await fetch(`/api/v1/milestones/${id}`);
      if (msRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!msRes.ok) {
        setError('Failed to load milestone.');
        return;
      }
      const { data: ms } = (await msRes.json()) as { data: Milestone };
      setMilestone(ms);

      // Fetch project using projectId from milestone (sequential — depends on ms)
      const prRes = await fetch(`/api/v1/projects/${ms.projectId}`);
      if (prRes.ok) {
        const { data: pr } = (await prRes.json()) as { data: Project };
        setProject(pr);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="px-6 py-6 space-y-6">
        <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--surface-muted)' }} />
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--surface-muted)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="sticky top-6 self-start">
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  // --- Not found / error state ---
  if (notFound || !milestone) {
    return (
      <div className="px-6 py-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <p className="mt-6 text-sm" style={{ color: 'var(--danger)' }}>
          {notFound ? 'Milestone not found.' : (error ?? 'Something went wrong.')}
        </p>
      </div>
    );
  }

  const customerName = project?.customerFullName ?? project?.leadContactName ?? null;
  const subtitle = project
    ? [project.name, customerName].filter(Boolean).join(' — ')
    : null;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {milestone.label}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <StatusBadge status={milestone.paymentStatus} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* LEFT — main content */}
        <div className="space-y-4">

          {/* Milestone Details card */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Milestone Details
            </h2>
            <dl>
              <DetailRow label="% of Contract">
                {milestone.pctOfTotal}%
              </DetailRow>
              <DetailRow label="Amount">
                {formatRupees(milestone.amountPaise)}
              </DetailRow>
              {milestone.triggerStage && (
                <DetailRow label="Trigger Stage">
                  <span className="capitalize">{milestone.triggerStage.replace(/_/g, ' ')}</span>
                </DetailRow>
              )}
              {milestone.paidAt && (
                <DetailRow label="Paid On">
                  {new Date(milestone.paidAt).toLocaleDateString('en-IN')}
                </DetailRow>
              )}
              {milestone.razorpayLinkId && (
                <DetailRow label="Razorpay Link ID">
                  <span className="font-mono text-xs">{milestone.razorpayLinkId}</span>
                </DetailRow>
              )}
              <div className="flex items-start justify-between gap-4 pt-3">
                <dt className="text-sm shrink-0" style={{ color: 'var(--text-secondary)' }}>Created</dt>
                <dd className="text-sm font-medium text-right" style={{ color: 'var(--text-heading)' }}>
                  {new Date(milestone.createdAt).toLocaleDateString('en-IN')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Invoice card */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Invoice
            </h2>
            {milestone.invoiceId ? (
              <Link
                href={`/invoices/${milestone.invoiceId}`}
                className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent-base)' }}
              >
                View Invoice <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No invoice linked
              </p>
            )}
          </div>

          {/* Payment history card */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Payment History
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Payment tracking via Razorpay webhook
            </p>
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="sticky top-6 self-start space-y-4">
          {/* Related card */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Related
            </h2>
            <div className="space-y-2">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Project</p>
                <Link
                  href={`/projects/${milestone.projectId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {project?.name ?? 'View Project'} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              {milestone.projectId && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Milestones</p>
                  <Link
                    href={`/projects/${milestone.projectId}/payments`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    All milestones <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
