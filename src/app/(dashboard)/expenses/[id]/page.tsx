'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  Receipt,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseDetail {
  id: string;
  tenantId: string;
  projectId: string;
  category: string;
  amountPaise: number;
  description: string | null;
  receiptUrl: string | null;
  loggedBy: string;
  loggedVia: string;
  approvedBy: string | null;
  approvedAt: string | null;
  vendorName: string | null;
  gstPct: number | null;
  gstAmountPaise: number | null;
  createdAt: string;
  projectName: string;
  loggedByName: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  petty_cash: 'Petty Cash',
  transport: 'Transport',
  labour: 'Labour',
  material: 'Material',
  other: 'Other',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

function fmtAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN');
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--text-heading)] text-right">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-[var(--surface-muted)]" />
      <div className="h-4 w-40 rounded bg-[var(--surface-muted)]" />
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="sticky top-6 self-start space-y-4">
          <div className="h-24 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const loadExpense = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/v1/expenses/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((body: { data?: ExpenseDetail; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed to load expense');
        setExpense(body.data);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadExpense();
  }, [loadExpense]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/v1/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApproveError(body?.error ?? 'Failed to approve expense.');
        return;
      }
      loadExpense();
    } catch {
      setApproveError('Network error. Try again.');
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <Skeleton />;

  if (fetchError || !expense) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          {fetchError ?? 'Expense not found.'}
        </div>
      </div>
    );
  }

  const isApproved = !!expense.approvedAt;
  const pageTitle = expense.description || `Expense — ${categoryLabel(expense.category)}`;

  return (
    <div className="px-6 py-6 space-y-6">

      {/* Header */}
      <PageHeader
        title={pageTitle}
        subtitle={expense.projectName}
        actions={
          <>
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                Pending approval
              </span>
            )}
            <button
              onClick={handleApprove}
              disabled={isApproved || approving}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-base)' }}
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
          </>
        }
      />

      {approveError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {approveError}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">

        {/* LEFT — main content */}
        <div className="space-y-4">

          {/* Expense Details card */}
          <Card title="Expense Details" icon={Tag}>
            <div className="space-y-2.5">
              <Row
                label="Category"
                value={
                  <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)] capitalize">
                    {categoryLabel(expense.category)}
                  </span>
                }
              />
              <Row label="Amount" value={fmtAmount(expense.amountPaise)} />
              {expense.gstPct !== null && (
                <Row label="GST %" value={`${expense.gstPct}%`} />
              )}
              {expense.gstAmountPaise !== null && (
                <Row label="GST Amount" value={fmtAmount(expense.gstAmountPaise)} />
              )}
              {expense.vendorName && (
                <Row label="Vendor" value={expense.vendorName} />
              )}
              <Row label="Logged by" value={expense.loggedByName} />
              <Row label="Logged via" value={expense.loggedVia} />
              <Row label="Date" value={fmtDate(expense.createdAt)} />
            </div>
          </Card>

          {/* Receipt card */}
          <Card title="Receipt" icon={Receipt}>
            {expense.receiptUrl ? (
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--accent-base)' }}
              >
                View receipt
              </a>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No receipt uploaded</p>
            )}
          </Card>

          {/* Approval card */}
          <Card title="Approval" icon={ShieldCheck}>
            {isApproved ? (
              <div className="space-y-2.5">
                <Row label="Status" value={
                  <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved
                  </span>
                } />
                <Row label="Approved on" value={fmtDate(expense.approvedAt!)} />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">Pending approval</p>
            )}
          </Card>

        </div>

        {/* RIGHT */}
        <div className="sticky top-6 self-start space-y-4">

          {/* Related card */}
          <Card title="Related" icon={FolderKanban}>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Project</p>
              <Link
                href={`/projects/${expense.projectId}`}
                className="text-sm font-medium text-[var(--text-heading)] hover:text-violet-600 transition-colors underline underline-offset-2"
              >
                {expense.projectName}
              </Link>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
