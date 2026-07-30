'use client';

import { use, useEffect, useState, type CSSProperties, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, Pencil, AlertTriangle, RefreshCw,
  FolderOpen, CreditCard, ClipboardList, Package, Receipt, Bug,
  FileText, Activity, Plus, ChevronRight, Calendar,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupees } from '@/lib/utils';
import { Project, ProjectStage } from '@/types/quotes';
import { Milestone, MilestonePaymentStatus } from '@/types/milestones';
import {
  LIFECYCLE_STAGE_ORDER,
  LIFECYCLE_STAGE_LABELS,
} from '@/types/deliverables';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostToComplete {
  quotedCostPaise: number;
  quotedClientPaise: number;
  actualExpensesPaise: number;
  remainingPaise: number;
  variancePaise: number;
  burnPct: number;
  status: 'on_track' | 'watch' | 'overrun';
}

interface ProjectSummary {
  deliverableCount: number;
  siteLogCount: number;
  openSnagCount: number;
  expenseCount: number;
  expenseTotalPaise: number;
}

interface ProjectWithContext extends Project {
  customerId?: string | null;
  leadContactName?: string | null;
  customerFullName?: string | null;
}

interface SiteLog {
  id: string;
  logDate: string;
  transcript: string | null;
  progressPct: number | null;
  source: string;
  createdAt: string;
}

// ─── Donut Ring Chart ─────────────────────────────────────────────────────────

function DonutChart({ pct, size = 100, strokeWidth = 10 }: { pct: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const color = pct < 60 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444';
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = Math.round(size * 0.18);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fontWeight="700" fill="#111827">
        {pct}%
      </text>
    </svg>
  );
}

// ─── Gate Check Row ───────────────────────────────────────────────────────────

function GateItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed
        ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
      <span className={passed ? 'text-gray-700' : 'text-red-600'}>{label}</span>
    </div>
  );
}

// ─── Confirm Advance Dialog ───────────────────────────────────────────────────

interface ConfirmAdvanceProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentStage: ProjectStage;
  nextStage: ProjectStage;
  milestones: Milestone[];
  projectName: string;
  advancing: boolean;
}

function ConfirmAdvanceDialog({
  open, onClose, onConfirm,
  currentStage, nextStage,
  milestones, projectName, advancing,
}: ConfirmAdvanceProps) {
  const needsGate      = nextStage === 'procurement';
  const isDesignApproved = currentStage === 'design_approved';
  const hasPaidMilestone = milestones.some(m => m.paymentStatus === 'paid');
  const canAdvance     = !needsGate || (isDesignApproved && hasPaidMilestone);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Advance Stage?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-gray-700">
            Move <strong>{projectName}</strong> from{' '}
            <strong>{LIFECYCLE_STAGE_LABELS[currentStage]}</strong> to{' '}
            <strong>{LIFECYCLE_STAGE_LABELS[nextStage]}</strong>.
          </p>
          {needsGate && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Requirements for Procurement
              </p>
              <GateItem label="Design Approved" passed={isDesignApproved} />
              <GateItem label="At least 1 milestone paid" passed={hasPaidMilestone} />
              {!canAdvance && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  Complete the requirements above before advancing to Procurement.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400">This stage advance cannot be reversed from this page.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={advancing}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!canAdvance || advancing}>
            {advancing ? 'Advancing…' : `Advance → ${LIFECYCLE_STAGE_LABELS[nextStage]}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Project Dialog ──────────────────────────────────────────────────────

interface EditProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectWithContext;
  onSuccess: (updated: Partial<ProjectWithContext>) => void;
}

function EditProjectDialog({ open, onClose, project, onSuccess }: EditProjectDialogProps) {
  const [name,           setName]     = useState(project.name);
  const [contractRupees, setContract] = useState(
    project.totalContractPaise ? Math.round(project.totalContractPaise / 100).toString() : '',
  );
  const [endDate, setEndDate] = useState(
    project.expectedEndAt ? project.expectedEndAt.slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setContract(project.totalContractPaise ? Math.round(project.totalContractPaise / 100).toString() : '');
      setEndDate(project.expectedEndAt ? project.expectedEndAt.slice(0, 10) : '');
      setError(null);
    }
  }, [open, project]);

  async function handleSave() {
    if (!name.trim()) { setError('Project name is required.'); return; }
    setSaving(true);
    setError(null);

    const contractVal = parseFloat(contractRupees);
    const payload: Record<string, unknown> = { name: name.trim() };
    if (contractRupees.trim() && !isNaN(contractVal) && contractVal >= 0) {
      payload.totalContractPaise = Math.round(contractVal * 100);
    }
    payload.expectedEndAt = endDate || null;

    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({})) as { data?: Project; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      onSuccess(body.data ?? payload as Partial<ProjectWithContext>);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Project Name <span className="text-red-500">*</span></Label>
            <Input id="ep-name" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-contract">Total Contract Value (₹)</Label>
            <Input
              id="ep-contract" type="number" min="0" step="1000"
              value={contractRupees} onChange={e => setContract(e.target.value)}
              className="h-9 text-sm" placeholder="e.g. 1500000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-end">Expected Completion Date</Label>
            <Input id="ep-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment status constants ─────────────────────────────────────────────────

const PAYMENT_STATUS_STYLES: Record<MilestonePaymentStatus, CSSProperties> = {
  pending:   { backgroundColor: 'rgba(107,114,128,0.12)', color: '#374151' },
  link_sent: { backgroundColor: 'rgba(59,130,246,0.12)',  color: '#1d4ed8' },
  paid:      { backgroundColor: 'rgba(22,163,74,0.12)',   color: '#15803d' },
  overdue:   { backgroundColor: 'rgba(220,38,38,0.12)',   color: '#b91c1c' },
};

const PAYMENT_STATUS_LABELS: Record<MilestonePaymentStatus, string> = {
  pending:   'Pending',
  link_sent: 'Link Sent',
  paid:      'Paid',
  overdue:   'Overdue',
};

// ─── Section tile definitions ─────────────────────────────────────────────────

interface SectionTile {
  href: string;
  label: string;
  description: string;
  badge: string | null;
  Icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  actionLabel: string;
}

function buildTiles(id: string, summary: ProjectSummary | null): SectionTile[] {
  const s = summary;
  return [
    {
      href: `/projects/${id}/deliverables`,
      label: 'Deliverables',
      description: '2D plans, renders, working drawings',
      badge: s && s.deliverableCount > 0 ? String(s.deliverableCount) : null,
      Icon: FolderOpen,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      actionLabel: 'Browse',
    },
    {
      href: `/projects/${id}/payments`,
      label: 'Payments',
      description: 'Milestones, links & receipts',
      badge: null,
      Icon: CreditCard,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      actionLabel: 'Collect',
    },
    {
      href: `/projects/${id}/site`,
      label: 'Site Logs',
      description: 'Daily progress updates',
      badge: s && s.siteLogCount > 0 ? String(s.siteLogCount) : null,
      Icon: ClipboardList,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      actionLabel: 'Log',
    },
    {
      href: `/projects/${id}/boq`,
      label: 'BOQ',
      description: 'Bill of quantities',
      badge: null,
      Icon: Package,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      actionLabel: 'View',
    },
    {
      href: `/projects/${id}/expenses`,
      label: 'Expenses',
      description: 'Petty cash, transport, materials',
      badge: s && s.expenseTotalPaise > 0 ? formatRupees(s.expenseTotalPaise) : null,
      Icon: Receipt,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      actionLabel: 'Add',
    },
    {
      href: `/projects/${id}/snag`,
      label: 'Snag List',
      description: 'Open items & client sign-off',
      badge: s && s.openSnagCount > 0 ? `${s.openSnagCount} open` : null,
      Icon: Bug,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      actionLabel: 'Manage',
    },
  ];
}

// ─── Lifecycle Stepper ────────────────────────────────────────────────────────

function LifecycleStepper({ currentStage }: { currentStage: ProjectStage }) {
  const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-start gap-0">
        {LIFECYCLE_STAGE_ORDER.map((stage, idx) => {
          const isPast    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast    = idx === LIFECYCLE_STAGE_ORDER.length - 1;

          return (
            <li key={stage} className="flex items-start">
              <div className="flex flex-col items-center gap-2">
                {/* Step dot */}
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                    isCurrent
                      ? 'border-violet-600 bg-violet-600 shadow shadow-violet-200'
                      : isPast
                      ? 'border-gray-300 bg-gray-300'
                      : 'border-gray-200 bg-white',
                  ].join(' ')}
                >
                  {isPast && <CheckCircle2 className="h-4 w-4 text-white" />}
                  {isCurrent && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                </div>
                {/* Stage label */}
                <span
                  className={[
                    'max-w-[68px] text-center text-[9px] font-medium leading-tight',
                    isCurrent ? 'text-violet-700' : isPast ? 'text-gray-400' : 'text-gray-300',
                  ].join(' ')}
                >
                  {LIFECYCLE_STAGE_LABELS[stage]}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    'mx-1 mt-3.5 h-0.5 w-8 shrink-0',
                    idx < currentIdx ? 'bg-gray-300' : 'bg-gray-200',
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

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project,        setProject]        = useState<ProjectWithContext | null>(null);
  const [milestones,     setMilestones]     = useState<Milestone[]>([]);
  const [costData,       setCostData]       = useState<CostToComplete | null>(null);
  const [summary,        setSummary]        = useState<ProjectSummary | null>(null);
  const [siteLogs,       setSiteLogs]       = useState<SiteLog[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState(false);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [stageError,     setStageError]     = useState<string | null>(null);
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [editOpen,       setEditOpen]       = useState(false);
  const [creatingQuote,  setCreatingQuote]  = useState(false);

  useEffect(() => {
    setFetchError(false);
    setLoading(true);

    Promise.all([
      fetch(`/api/v1/projects/${id}`).then(r => r.json()),
      fetch(`/api/v1/projects/${id}/milestones`).then(r => r.json()),
      fetch(`/api/v1/projects/${id}/cost-to-complete`).then(r => r.json()),
      fetch(`/api/v1/projects/${id}/summary`).then(r => r.json()),
      fetch(`/api/v1/projects/${id}/site-logs`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([projectRes, milestonesRes, costRes, summaryRes, logsRes]: [
        { data: ProjectWithContext },
        { data: Milestone[] },
        { data: CostToComplete },
        { data: ProjectSummary },
        { data: SiteLog[] },
      ]) => {
        setProject(projectRes.data ?? null);
        setMilestones(milestonesRes.data ?? []);
        setCostData(costRes.data ?? null);
        setSummary(summaryRes.data ?? null);
        setSiteLogs((logsRes.data ?? []).slice(0, 3));
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreateQuote() {
    setCreatingQuote(true);
    try {
      const res = await fetch('/api/v1/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
      const body = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to create quotation');
      router.push(`/quotes/${body.data!.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create quotation');
      setCreatingQuote(false);
    }
  }

  async function handleAdvanceStage() {
    if (!project) return;
    const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(project.lifecycleStage);
    const nextStage  = LIFECYCLE_STAGE_ORDER[currentIdx + 1];
    if (!nextStage) return;

    setStageError(null);
    setAdvancingStage(true);

    try {
      const res = await fetch(`/api/v1/projects/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      const body = await res.json() as { data?: Project; error?: string };
      if (!res.ok) { setStageError(body.error ?? 'Failed to advance stage'); return; }
      if (body.data) setProject(prev => prev ? { ...prev, ...body.data } : prev);
    } catch {
      setStageError('Network error — please try again');
    } finally {
      setAdvancingStage(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading project…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchError || !project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm">
            {fetchError
              ? 'Could not load project data. Check your connection and try again.'
              : 'Project not found.'}
          </p>
        </div>
        <div className="flex gap-3">
          {fetchError && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          <Link href="/projects" className="text-sm text-blue-600 underline">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const currentIdx = LIFECYCLE_STAGE_ORDER.indexOf(project.lifecycleStage);
  const nextStage  = LIFECYCLE_STAGE_ORDER[currentIdx + 1] ?? null;
  const tiles      = buildTiles(id, summary);
  const burnPct    = costData?.burnPct ?? 0;
  const paidCount  = milestones.filter(m => m.paymentStatus === 'paid').length;

  return (
    <div className="space-y-6 pb-10">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/projects" className="font-medium text-gray-500 hover:text-gray-700">
          ← All Projects
        </Link>
        {project.leadId && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <Link
              href={`/leads/${project.leadId}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              Lead{project.leadContactName ? ` · ${project.leadContactName}` : ''}
            </Link>
          </>
        )}
        {project.customerId && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <Link
              href={`/customers/${project.customerId}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#065f46', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              Customer{project.customerFullName ? ` · ${project.customerFullName}` : ''}
            </Link>
          </>
        )}
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Title + stage badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            title="Edit project details"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'rgba(200,155,60,0.15)', color: '#C89B3C' }}
          >
            {LIFECYCLE_STAGE_LABELS[project.lifecycleStage]}
          </span>
          {project.expectedEndAt && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              Due {new Date(project.expectedEndAt).toLocaleDateString('en-IN')}
            </span>
          )}
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit Project
          </Button>

          <Button
            variant="outline" size="sm"
            onClick={handleCreateQuote}
            disabled={creatingQuote}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {creatingQuote ? 'Creating…' : 'Create Quotation'}
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${id}/deliverables`}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              Documents
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${id}/payments`}>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Payments
            </Link>
          </Button>

          {nextStage ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={advancingStage}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--violet-primary, #7c3aed)' }}
            >
              {advancingStage ? 'Advancing…' : 'Advance Stage'}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(22,163,74,0.12)', color: '#15803d' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Project Complete
            </span>
          )}

          {stageError && (
            <p className="text-xs text-red-600">{stageError}</p>
          )}
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Contract Value */}
        <div className="premium-card p-4">
          <p className="mb-1 text-xs text-gray-500">Contract Value</p>
          <p className="text-lg font-bold text-gray-900">
            {project.totalContractPaise ? formatRupees(project.totalContractPaise) : '—'}
          </p>
        </div>

        {/* Cost Budget */}
        <div className="premium-card p-4">
          <p className="mb-1 text-xs text-gray-500">Cost Budget</p>
          <p className="text-lg font-bold text-gray-900">
            {costData && costData.quotedCostPaise > 0 ? formatRupees(costData.quotedCostPaise) : '—'}
          </p>
          {(!costData || costData.quotedCostPaise === 0) && (
            <p className="mt-0.5 text-xs text-amber-600">No approved quote</p>
          )}
        </div>

        {/* Amount Spent */}
        <div className="premium-card p-4">
          <p className="mb-1 text-xs text-gray-500">Amount Spent</p>
          <p className="text-lg font-bold text-gray-900">
            {costData && costData.actualExpensesPaise > 0
              ? formatRupees(costData.actualExpensesPaise)
              : summary && summary.expenseTotalPaise > 0
              ? formatRupees(summary.expenseTotalPaise)
              : '₹0'}
          </p>
        </div>

        {/* Remaining */}
        <div className="premium-card p-4">
          <p className="mb-1 text-xs text-gray-500">Remaining</p>
          <p className={[
            'text-lg font-bold',
            costData && costData.remainingPaise < 0 ? 'text-red-600' : 'text-gray-900',
          ].join(' ')}>
            {costData && costData.quotedCostPaise > 0
              ? formatRupees(Math.abs(costData.remainingPaise))
              : '—'}
          </p>
          {costData && costData.remainingPaise < 0 && (
            <p className="mt-0.5 text-xs text-red-600">Over budget</p>
          )}
        </div>

        {/* Progress (spans 2 cols on mobile so it's not tiny) */}
        <div className="premium-card p-4 col-span-2 flex items-center gap-3 sm:col-span-1">
          <DonutChart pct={burnPct} size={60} strokeWidth={7} />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Progress</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {costData?.status === 'on_track'
                ? 'On Track'
                : costData?.status === 'watch'
                ? 'Watch'
                : costData?.status === 'overrun'
                ? 'Over Budget'
                : 'No data'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Project Progress Stepper ────────────────────────────────────────── */}
      <div className="premium-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Project Timeline</p>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Stage {currentIdx + 1} of {LIFECYCLE_STAGE_ORDER.length}
          </span>
        </div>
        <LifecycleStepper currentStage={project.lifecycleStage} />
      </div>

      {/* ── Milestones + Cost Tracker ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Milestones (left — 3/5 width on lg) */}
        <div className="premium-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Milestones
              {milestones.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  ({paidCount}/{milestones.length} paid)
                </span>
              )}
            </h2>
            <Link
              href={`/projects/${id}/payments`}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              View All →
            </Link>
          </div>

          {milestones.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 rounded-full bg-gray-100 p-3">
                <CreditCard className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mb-1 text-sm font-medium text-gray-700">No milestones set up yet</p>
              <p className="mb-4 max-w-xs text-xs text-gray-500">
                Milestones track client payments — typically 10% / 40% / 40% / 10% of the contract value.
              </p>
              <Link
                href={`/projects/${id}/payments`}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'var(--violet-primary, #7c3aed)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Set Up Milestones
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {milestones.map(m => (
                <div key={m.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-gray-900">{m.label}</p>
                  <p className="text-xl font-bold text-gray-900">{formatRupees(m.amountPaise)}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{m.pctOfTotal}% of total</p>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={PAYMENT_STATUS_STYLES[m.paymentStatus]}
                    >
                      {PAYMENT_STATUS_LABELS[m.paymentStatus]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Tracker (right — 2/5 width on lg) */}
        <div className="premium-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Cost-to-Complete</h2>
            {costData && costData.quotedCostPaise > 0 && (
              <Link
                href={`/projects/${id}/expenses`}
                className="text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                View Details →
              </Link>
            )}
          </div>

          {!costData || costData.quotedCostPaise === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 rounded-full bg-amber-50 p-3">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <p className="mb-1 text-sm font-medium text-gray-700">No approved quote yet</p>
              <p className="mb-3 text-xs text-gray-500">Cost tracking starts when a quote is approved.</p>
              <Link href="/quotes" className="text-xs font-medium text-violet-600 hover:underline">
                Create &amp; approve a quote →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5">
              <DonutChart pct={burnPct} size={120} strokeWidth={12} />
              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Budget (from Quote)</span>
                  <span className="font-semibold text-gray-900">{formatRupees(costData.quotedCostPaise)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Spent</span>
                  <span className="font-semibold text-gray-900">{formatRupees(costData.actualExpensesPaise)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-sm">
                  <span className="text-gray-500">Remaining</span>
                  <span className={['font-bold', costData.remainingPaise < 0 ? 'text-red-600' : 'text-green-600'].join(' ')}>
                    {costData.remainingPaise < 0 && '−'}
                    {formatRupees(Math.abs(costData.remainingPaise))}
                  </span>
                </div>
              </div>
              {costData.status === 'overrun' && (
                <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Cost overrun detected — review expenses.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Project Sections ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Project Sections</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map(tile => (
            <Link key={tile.href} href={tile.href}>
              <div className="premium-card group h-full cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className={['rounded-xl p-2.5', tile.iconBg].join(' ')}>
                    <tile.Icon className={['h-5 w-5', tile.iconColor].join(' ')} />
                  </div>
                  {tile.badge && (
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(107,114,128,0.12)', color: '#374151' }}
                    >
                      {tile.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-violet-700">
                  {tile.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">{tile.description}</p>
                <div className="mt-2.5 flex items-center gap-0.5 text-xs font-medium text-gray-400 transition-colors group-hover:text-violet-600">
                  {tile.actionLabel}
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent Activities + Recent Documents ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Recent Activities */}
        <div className="premium-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activities</h2>
            <Link
              href={`/projects/${id}/site`}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              View All →
            </Link>
          </div>

          {siteLogs.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Activity className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-500">No activities logged yet.</p>
              <p className="mt-1 text-xs text-gray-400">Site logs will appear here as work progresses.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {siteLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <ClipboardList className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Site Log —{' '}
                      {new Date(log.logDate + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                      })}
                    </p>
                    {log.transcript && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{log.transcript}</p>
                    )}
                    {log.progressPct !== null && (
                      <p className="mt-0.5 text-xs text-gray-400">{log.progressPct}% progress reported</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Documents */}
        <div className="premium-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Documents</h2>
            <Link
              href={`/projects/${id}/deliverables`}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              View All →
            </Link>
          </div>
          <div className="flex flex-col items-center py-6 text-center">
            <FileText className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
            <Link
              href={`/projects/${id}/deliverables`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Plus className="h-3 w-3" />
              Upload First Document
            </Link>
          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {nextStage && (
        <ConfirmAdvanceDialog
          open={confirmOpen}
          onClose={() => { setConfirmOpen(false); setStageError(null); }}
          onConfirm={() => { setConfirmOpen(false); handleAdvanceStage(); }}
          currentStage={project.lifecycleStage}
          nextStage={nextStage}
          milestones={milestones}
          projectName={project.name}
          advancing={advancingStage}
        />
      )}

      <EditProjectDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
        onSuccess={updated => setProject(prev => prev ? { ...prev, ...updated } : prev)}
      />
    </div>
  );
}
