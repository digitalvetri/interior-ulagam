'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  FileText,
  Users,
  CalendarDays,
  DollarSign,
  StickyNote,
  FolderKanban,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  id: string;
  tenantId: string;
  projectId: string;
  quoteLineId: string | null;
  title: string;
  type: string;
  priority: string;
  description: string | null;
  room: string | null;
  assignedUserId: string | null;
  assignedVendorId: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  estimatedCostPaise: number | null;
  actualCostPaise: number | null;
  notes: string | null;
  createdAt: string;
  assignedUserName: string | null;
  assignedVendorName: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  inhouse_carpentry: 'In-house Carpentry',
  factory:           'Factory',
  vendor_job:        'Vendor Job',
  site_work:         'Site Work',
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  low:    { bg: 'var(--surface-muted)', color: 'var(--text-secondary)', label: 'Low' },
  normal: { bg: '#EFF6FF',              color: '#1D4ED8',               label: 'Normal' },
  high:   { bg: '#FFF7ED',              color: '#C2410C',               label: 'High' },
  urgent: { bg: 'var(--danger-soft)',   color: 'var(--danger)',         label: 'Urgent' },
};

// status → valid next transitions: [{ label, nextStatus }]
const TRANSITIONS: Record<string, { label: string; nextStatus: string }[]> = {
  draft:       [{ label: 'Assign',        nextStatus: 'assigned' }],
  assigned:    [{ label: 'Start Work',    nextStatus: 'in_progress' }],
  in_progress: [
    { label: 'Put on Hold',   nextStatus: 'on_hold' },
    { label: 'Mark Complete', nextStatus: 'completed' },
    { label: 'Cancel',        nextStatus: 'cancelled' },
  ],
  on_hold:     [
    { label: 'Resume',  nextStatus: 'in_progress' },
    { label: 'Cancel',  nextStatus: 'cancelled' },
  ],
  completed:   [],
  cancelled:   [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAmount(paise: number | null): string {
  if (paise === null) return '—';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
        <h2 className="text-sm font-semibold text-[var(--text-heading)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-[var(--surface-muted)]" />
      <div className="h-4 w-48 rounded bg-[var(--surface-muted)]" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  function loadWorkOrder() {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/v1/work-orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((body: { data?: WorkOrder; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed to load work order');
        setWorkOrder(body.data);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadWorkOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleTransition(nextStatus: string) {
    if (!id || transitioning) return;
    setTransitioning(nextStatus);
    try {
      const r = await fetch(`/api/v1/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      loadWorkOrder();
    } catch (e) {
      console.error('Transition failed:', e);
    } finally {
      setTransitioning(null);
    }
  }

  if (loading) return <LoadingSkeleton />;

  if (fetchError || !workOrder) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          {fetchError ?? 'Work order not found.'}
        </div>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[workOrder.type] ?? workOrder.type;
  const priorityCfg = PRIORITY_STYLES[workOrder.priority] ?? PRIORITY_STYLES.normal;
  const availableTransitions = TRANSITIONS[workOrder.status] ?? [];
  const assigneeName = workOrder.assignedUserName ?? workOrder.assignedVendorName ?? null;

  const priorityBadge = (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: priorityCfg.bg, color: priorityCfg.color }}
    >
      {priorityCfg.label}
    </span>
  );

  const actionButtons = availableTransitions.map(({ label, nextStatus }) => {
    const isPending = transitioning === nextStatus;
    const isDestructive = nextStatus === 'cancelled';
    return (
      <button
        key={nextStatus}
        disabled={!!transitioning}
        onClick={() => handleTransition(nextStatus)}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60"
        style={
          isDestructive
            ? { background: 'var(--danger-soft)', color: 'var(--danger)' }
            : { background: 'var(--violet-primary)', color: '#fff' }
        }
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {label}
      </button>
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

      {/* Header */}
      <PageHeader
        title={workOrder.title}
        subtitle={typeLabel}
        actions={
          <>
            {priorityBadge}
            <StatusBadge module="work_orders" status={workOrder.status} />
            {actionButtons}
          </>
        }
      />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* LEFT — lg:col-span-2 */}
        <div className="lg:col-span-2 space-y-4">

          {/* Scope */}
          <Card title="Scope" icon={FileText}>
            <div className="space-y-3">
              {workOrder.description ? (
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                  {workOrder.description}
                </p>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">No description</p>
              )}
              <div className="flex flex-wrap gap-6 pt-1">
                <InfoRow label="Room" value={workOrder.room ?? '—'} />
                <InfoRow label="Type" value={typeLabel} />
              </div>
            </div>
          </Card>

          {/* People & Dates */}
          <Card title="People & Dates" icon={Users}>
            <div className="flex flex-wrap gap-6">
              <InfoRow
                label="Assigned to"
                value={assigneeName ?? <span className="text-[var(--text-tertiary)]">Unassigned</span>}
              />
              <InfoRow
                label="Start Date"
                value={
                  workOrder.startDate
                    ? fmtDate(workOrder.startDate)
                    : <span className="text-[var(--text-tertiary)]">Not set</span>
                }
              />
              <InfoRow
                label="Due Date"
                value={
                  workOrder.dueDate
                    ? fmtDate(workOrder.dueDate)
                    : <span className="text-[var(--text-tertiary)]">Not set</span>
                }
              />
            </div>
          </Card>

          {/* Costs */}
          <Card title="Costs" icon={DollarSign}>
            <div className="flex flex-wrap gap-6">
              <InfoRow label="Estimated" value={fmtAmount(workOrder.estimatedCostPaise)} />
              <InfoRow label="Actual" value={fmtAmount(workOrder.actualCostPaise)} />
            </div>
          </Card>

          {/* Notes */}
          <Card title="Notes" icon={StickyNote}>
            {workOrder.notes ? (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {workOrder.notes}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No notes</p>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Related */}
          <Card title="Related" icon={FolderKanban}>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Project</p>
              <Link
                href={`/projects/${workOrder.projectId}`}
                className="text-sm font-medium text-[var(--text-heading)] hover:text-violet-600 transition-colors underline underline-offset-2"
              >
                {workOrder.projectId}
              </Link>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Created</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{fmtDate(workOrder.createdAt)}</p>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
