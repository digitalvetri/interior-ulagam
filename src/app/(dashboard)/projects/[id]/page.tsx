'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Edit2, Plus, Receipt, Camera,
  ChevronRight, X, AlertTriangle, IndianRupee,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { STAGE_STYLE_MAP, LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGE_ORDER } from '@/types/deliverables';
import type { ProjectStage } from '@/types/deliverables';
import type { Milestone } from '@/types/milestones';
import type { Expense, ExpenseCategory } from '@/types/accounts';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
  lifecycleStage: ProjectStage;
  totalContractPaise: number | null;
  expectedEndAt: string | null;
  startedAt: string | null;
  leadContactName: string | null;
  customerFullName: string | null;
  siteAddress: string | null;
  customerId: string | null;
  leadId: string | null;
}

interface SiteLog {
  id: string;
  logDate: string;
  transcript: string | null;
  photos: string[] | null;
  source: string | null;
  progressPct: number | null;
  createdAt: string;
}

/* ── Category config ────────────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string }> = {
  petty_cash: { label: 'Petty Cash', color: 'var(--text-secondary)' },
  transport:  { label: 'Transport',  color: 'var(--accent-base)' },
  labour:     { label: 'Labour',     color: '#F97316' },
  material:   { label: 'Material',   color: '#9333EA' },
  other:      { label: 'Other',      color: 'var(--text-secondary)' },
};

const ALL_CATEGORIES: ExpenseCategory[] = ['petty_cash', 'transport', 'labour', 'material', 'other'];

/* ── EditProjectDialog ──────────────────────────────────────────────────────── */

function EditProjectDialog({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,        setName]        = useState(project.name);
  const [contractStr, setContractStr] = useState(
    project.totalContractPaise != null ? String(project.totalContractPaise / 100) : '',
  );
  const [stage,       setStage]       = useState<ProjectStage>(project.lifecycleStage);
  const [expectedEnd, setExpectedEnd] = useState(
    project.expectedEndAt ? project.expectedEndAt.split('T')[0] : '',
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError('Project name is required'); return; }
    const totalContractPaise = contractStr ? Math.round(parseFloat(contractStr) * 100) : undefined;
    if (contractStr && (isNaN(totalContractPaise!) || totalContractPaise! < 0)) {
      setError('Invalid contract value'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          lifecycleStage: stage,
          ...(contractStr ? { totalContractPaise } : {}),
          expectedEndAt: expectedEnd || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(typeof json.error === 'string' ? json.error : 'Failed to save');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <Edit2 className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Edit Project</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="studio-label block mb-1.5">Project Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Contract Value (₹)</label>
            <input type="number" min="0" step="100" placeholder="e.g. 500000"
              value={contractStr} onChange={e => setContractStr(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Project Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value as ProjectStage)}
              className="studio-input w-full text-sm">
              {LIFECYCLE_STAGE_ORDER.map(s => (
                <option key={s} value={s}>{LIFECYCLE_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Expected End Date <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="date" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Edit2 className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── RecordPaymentDialog ────────────────────────────────────────────────────── */

function RecordPaymentDialog({
  projectId, onClose, onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amountRupees, setAmountRupees] = useState('');
  const [notes,        setNotes]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const parsed = parseFloat(amountRupees);
    if (!amountRupees || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label:         notes.trim() || 'Payment received',
          pctOfTotal:    0,
          amountPaise:   Math.round(parsed * 100),
          paymentStatus: 'paid',
          paidAt:        new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: unknown };
        setError(typeof json.error === 'string' ? json.error : 'Failed to record payment');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-soft)' }}>
              <IndianRupee className="h-4 w-4" style={{ color: 'var(--success)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Record Payment</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="studio-label block mb-1.5">Amount Received (₹)</label>
            <input type="number" min="0.01" step="0.01" placeholder="e.g. 50000"
              value={amountRupees} onChange={e => setAmountRupees(e.target.value)}
              className="studio-input w-full text-sm" autoFocus />
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Description <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="e.g. Advance, Design approval payment…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <IndianRupee className="h-4 w-4" />
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AddExpenseDialog ───────────────────────────────────────────────────────── */

function AddExpenseDialog({
  projectId, onClose, onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const CATEGORY_FULL: Record<ExpenseCategory, { label: string; bg: string; color: string; dot: string }> = {
    petty_cash: { label: 'Petty Cash', bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
    transport:  { label: 'Transport',  bg: 'var(--accent-soft)',   color: 'var(--accent-text)',  dot: 'var(--accent-base)' },
    labour:     { label: 'Labour',     bg: 'var(--warning-soft)',  color: '#C2410C',             dot: '#F97316' },
    material:   { label: 'Material',   bg: 'var(--accent-soft)',   color: '#6B21A8',             dot: 'var(--accent-base)' },
    other:      { label: 'Other',      bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
  };

  const [category,     setCategory]     = useState<ExpenseCategory>('petty_cash');
  const [amountRupees, setAmountRupees] = useState('');
  const [description,  setDescription]  = useState('');
  const [vendorName,   setVendorName]   = useState('');
  const [gstPct,       setGstPct]       = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const parsed = parseFloat(amountRupees);
    if (!amountRupees || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount'); return;
    }
    const amountPaise    = Math.round(parsed * 100);
    const gstAmountPaise = gstPct > 0 ? Math.round(amountPaise * gstPct / (100 + gstPct)) : 0;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          category,
          amountPaise,
          gstPct,
          gstAmountPaise,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(vendorName.trim()  ? { vendorName:  vendorName.trim()  } : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? 'Failed to log expense');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-soft)' }}>
              <Receipt className="h-4 w-4" style={{ color: '#F97316' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Log Expense</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="studio-label block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(cat => {
                const cfg    = CATEGORY_FULL[cat];
                const active = category === cat;
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: active ? cfg.dot : 'transparent',
                      background:  active ? cfg.bg : 'var(--surface-muted)',
                      color:       active ? cfg.color : 'var(--text-secondary)',
                    }}>
                    <span className="h-1.5 w-1.5 rounded-full"
                      style={{ background: active ? cfg.dot : 'var(--text-tertiary)' }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Vendor / Paid To <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="e.g. Raj Carpentry Works"
              value={vendorName} onChange={e => setVendorName(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Amount (₹) incl. GST</label>
              <input type="number" min="0.01" step="0.01" placeholder="e.g. 1500"
                value={amountRupees} onChange={e => setAmountRupees(e.target.value)}
                className="studio-input w-full text-sm" />
            </div>
            <div>
              <label className="studio-label block mb-1.5">GST Rate</label>
              <select value={gstPct} onChange={e => setGstPct(Number(e.target.value))}
                className="studio-input w-full text-sm">
                <option value={0}>0% (No GST)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          </div>
          <div>
            <label className="studio-label block mb-1.5">Description</label>
            <input type="text" placeholder="Brief description of the expense"
              value={description} onChange={e => setDescription(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project,    setProject]    = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [siteLogs,   setSiteLogs]   = useState<SiteLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editOpen,    setEditOpen]    = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const [pRes, mRes, eRes, lRes] = await Promise.all([
        fetch(`/api/v1/projects/${id}`),
        fetch(`/api/v1/projects/${id}/milestones`),
        fetch(`/api/v1/projects/${id}/expenses`),
        fetch(`/api/v1/projects/${id}/site-logs`),
      ]);
      if (!pRes.ok) { setFetchError('Project not found'); setLoading(false); return; }
      const [pd, md, ed, ld] = await Promise.all([
        pRes.json() as Promise<{ data: Project }>,
        mRes.json() as Promise<{ data: Milestone[] }>,
        eRes.json() as Promise<{ data: Expense[] }>,
        lRes.json() as Promise<{ data: SiteLog[] }>,
      ]);
      setProject(pd.data);
      setMilestones(md.data ?? []);
      setExpenses(ed.data ?? []);
      setSiteLogs(ld.data ?? []);
    } catch {
      setFetchError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  /* ── Derived values ── */
  const contractPaise      = project?.totalContractPaise ?? 0;
  const paidMilestones     = milestones.filter(m => m.paymentStatus === 'paid');
  const receivedPaise      = paidMilestones.reduce((s, m) => s + m.amountPaise, 0);
  const outstandingPaise   = Math.max(0, contractPaise - receivedPaise);
  const totalExpensesPaise = expenses.reduce((s, e) => s + e.amountPaise, 0);
  const collectionPct      = contractPaise > 0 ? Math.round((receivedPaise / contractPaise) * 100) : 0;
  const clientName         = project?.customerFullName ?? project?.leadContactName ?? null;
  const stage              = project ? STAGE_STYLE_MAP[project.lifecycleStage] : null;
  const allPhotos          = siteLogs.flatMap(l => l.photos ?? []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (fetchError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="h-8 w-8" style={{ color: 'var(--danger)' }} />
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{fetchError ?? 'Project not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setEditOpen(true)}
          className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
          <Edit2 className="h-4 w-4" />Edit
        </button>
        <button type="button" onClick={() => setPaymentOpen(true)}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
          <IndianRupee className="h-4 w-4" />Record Payment
        </button>
        <button type="button" onClick={() => setExpenseOpen(true)}
          className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
          <Receipt className="h-4 w-4" />Add Expense
        </button>
      </div>

      {/* Hero KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Contract Value</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-heading)' }}>
            {contractPaise > 0
              ? formatRupees(contractPaise)
              : <span className="text-base font-medium" style={{ color: 'var(--text-tertiary)' }}>Not set</span>}
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Received</p>
          <p className="text-2xl font-bold mt-1"
            style={{ color: receivedPaise > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {receivedPaise > 0 ? formatRupees(receivedPaise) : '₹0'}
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Outstanding</p>
          <p className="text-2xl font-bold mt-1"
            style={{ color: outstandingPaise > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {contractPaise > 0
              ? formatRupees(outstandingPaise)
              : <span className="text-base font-medium" style={{ color: 'var(--text-tertiary)' }}>—</span>}
          </p>
        </div>
      </div>

      {/* Collection progress bar */}
      {contractPaise > 0 && (
        <div className="rounded-2xl border px-5 py-4"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Collection Progress</span>
            <span className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{collectionPct}% collected</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(collectionPct, 100)}%`, background: 'var(--accent-base)' }} />
          </div>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Payments Received */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Payments Received</h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPaymentOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  <Plus className="h-3.5 w-3.5" />Record
                </button>
                <Link href={`/projects/${id}/payments`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                  All<ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {paidMilestones.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No payments recorded yet</p>
                <button type="button" onClick={() => setPaymentOpen(true)}
                  className="mt-3 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  Record first payment →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paidMilestones.map((m, idx) => (
                    <tr key={m.id}
                      className="hover:bg-[var(--surface-muted)] transition-colors"
                      style={{ borderBottom: idx < paidMilestones.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.paidAt
                          ? new Date(m.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                        {m.label}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: 'var(--success)' }}>
                        {formatRupees(m.amountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                    <td colSpan={2} className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Total Received
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                      {formatRupees(receivedPaise)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Site Expenses */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Site Expenses</h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setExpenseOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  <Plus className="h-3.5 w-3.5" />Add
                </button>
                <Link href={`/projects/${id}/expenses`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                  All<ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No expenses logged yet</p>
                <button type="button" onClick={() => setExpenseOpen(true)}
                  className="mt-3 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  Log first expense →
                </button>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Category</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.slice(0, 8).map((e, idx) => (
                      <tr key={e.id}
                        className="hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ borderBottom: idx < Math.min(expenses.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-5 py-3 text-xs font-medium"
                          style={{ color: CATEGORY_CONFIG[e.category].color }}>
                          {CATEGORY_CONFIG[e.category].label}
                        </td>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {e.description ?? e.vendorName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {formatRupees(e.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                      <td colSpan={3} className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Total Expenses
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(totalExpensesPaise)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {expenses.length > 8 && (
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Link href={`/projects/${id}/expenses`} className="text-xs font-medium"
                      style={{ color: 'var(--accent-base)' }}>
                      View all {expenses.length} expenses →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Site Logs */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Recent Site Logs</h2>
              <Link href={`/projects/${id}/site`}
                className="inline-flex items-center gap-0.5 text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}>
                All<ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {siteLogs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No site logs yet</p>
              </div>
            ) : (
              <div>
                {siteLogs.slice(0, 5).map((log, idx) => (
                  <div key={log.id}
                    className="px-5 py-4 hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ borderBottom: idx < Math.min(siteLogs.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-heading)' }}>
                          {new Date(log.logDate).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {log.progressPct != null && (
                            <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                              · {log.progressPct}% done
                            </span>
                          )}
                        </p>
                        {log.transcript ? (
                          <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {log.transcript}
                          </p>
                        ) : (
                          <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                            {log.source === 'whatsapp' ? 'WhatsApp log' : 'Site visit logged'}
                          </p>
                        )}
                      </div>
                      {log.photos && log.photos.length > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs"
                          style={{ color: 'var(--text-tertiary)' }}>
                          <Camera className="h-3 w-3" />{log.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Site Photos */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Site Photos</h2>
                {allPhotos.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <Link href={`/projects/${id}/site`}
                className="inline-flex items-center gap-0.5 text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}>
                All<ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {allPhotos.length === 0 ? (
              <div className="py-10 text-center">
                <Camera className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No site photos yet</p>
                <Link href={`/projects/${id}/site`}
                  className="mt-2 inline-block text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  Add via site logs →
                </Link>
              </div>
            ) : (
              <>
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {allPhotos.slice(0, 12).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-xl overflow-hidden block hover:opacity-90 transition-opacity">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
                {allPhotos.length > 12 && (
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Link href={`/projects/${id}/site`} className="text-xs font-medium"
                      style={{ color: 'var(--accent-base)' }}>
                      View all {allPhotos.length} photos →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Client & Site */}
          <div className="rounded-2xl border p-5 space-y-4"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Client
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{clientName ?? '—'}</p>
              {project.customerId && (
                <Link href={`/customers/${project.customerId}`}
                  className="text-xs hover:underline" style={{ color: 'var(--accent-base)' }}>
                  View profile →
                </Link>
              )}
            </div>

            {project.siteAddress && (
              <>
                <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Site Address
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {project.siteAddress}
                  </p>
                </div>
              </>
            )}

            {(project.startedAt || project.expectedEndAt) && (
              <>
                <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                <div className="grid grid-cols-2 gap-3">
                  {project.startedAt && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        Started
                      </p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                        {new Date(project.startedAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                  {project.expectedEndAt && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        Expected End
                      </p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                        {new Date(project.expectedEndAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Stage */}
          <div className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Project Stage
            </p>
            {stage && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
                style={{ background: stage.bg, color: stage.fg }}>
                {stage.label}
              </span>
            )}
            <button type="button" onClick={() => setEditOpen(true)}
              className="mt-4 w-full text-xs font-medium py-2 rounded-xl transition-colors hover:opacity-80"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              Change Stage
            </button>
          </div>

          {/* Money summary */}
          {contractPaise > 0 && (
            <div className="rounded-2xl border p-5 space-y-3"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Money Summary
              </p>
              <div className="space-y-2.5">
                {[
                  { label: 'Contract',           amount: contractPaise,                       color: 'var(--text-heading)' },
                  { label: 'Received',            amount: receivedPaise,                       color: 'var(--success)' },
                  { label: 'Expenses',            amount: totalExpensesPaise,                  color: '#F97316' },
                  { label: 'Balance (Rcv − Exp)', amount: receivedPaise - totalExpensesPaise,  color: receivedPaise >= totalExpensesPaise ? 'var(--text-heading)' : 'var(--danger)' },
                ].map(({ label, amount, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="text-xs font-semibold" style={{ color }}>{formatRupees(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Dialogs */}
      {editOpen    && <EditProjectDialog   project={project} onClose={() => setEditOpen(false)}    onSaved={loadAll} />}
      {paymentOpen && <RecordPaymentDialog projectId={id}    onClose={() => setPaymentOpen(false)} onSaved={loadAll} />}
      {expenseOpen && <AddExpenseDialog    projectId={id}    onClose={() => setExpenseOpen(false)} onSaved={loadAll} />}
    </div>
  );
}
