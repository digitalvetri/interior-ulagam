'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Edit2, Plus, Receipt, Camera, FileText,
  ChevronRight, X, AlertTriangle, IndianRupee, Layers,
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

interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  paymentStatus: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  paidPaise: number;
  clientName: string | null;
  notes: string | null;
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

/* ── Invoice status helpers ─────────────────────────────────────────────────── */

function invoiceStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:     { label: 'Draft',     bg: 'var(--surface-muted)',  color: 'var(--text-secondary)' },
    issued:    { label: 'Issued',    bg: 'var(--accent-soft)',    color: 'var(--accent-base)' },
    part_paid: { label: 'Part Paid', bg: 'var(--warning-soft)',   color: '#B45309' },
    paid:      { label: 'Paid',      bg: 'var(--success-soft)',   color: 'var(--success)' },
    void:      { label: 'Void',      bg: 'var(--surface-muted)',  color: 'var(--text-tertiary)' },
  };
  return map[status] ?? map.draft;
}

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
    const basePaise      = Math.round(parsed * 100);
    const gstAmountPaise = gstPct > 0 ? Math.round(basePaise * gstPct / 100) : 0;
    const amountPaise    = basePaise + gstAmountPaise;
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
              <label className="studio-label block mb-1.5">Amount (₹) excl. GST</label>
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
          {(() => {
            const base = parseFloat(amountRupees);
            if (!amountRupees || isNaN(base) || base <= 0) return null;
            const gstAmt = gstPct > 0 ? base * gstPct / 100 : 0;
            const total  = base + gstAmt;
            return (
              <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ background: 'var(--surface-muted)' }}>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Base amount (excl. GST)</span>
                  <span className="font-medium text-[var(--text-primary)]">₹{base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {gstPct > 0 && (
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>GST ({gstPct}%)</span>
                    <span className="font-medium text-amber-600">+ ₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                  <span>Total paid</span>
                  <span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })()}
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

/* ── ChangeStageDialog ──────────────────────────────────────────────────────── */

function ChangeStageDialog({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentStage = project.lifecycleStage;
  const currentStyle = STAGE_STYLE_MAP[currentStage];
  const otherStages  = LIFECYCLE_STAGE_ORDER.filter(s => s !== currentStage);
  const [newStage, setNewStage] = useState<ProjectStage>(otherStages[0]);
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/change-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(typeof json.error === 'string' ? json.error : 'Failed to change stage');
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
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <Layers className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Change Project Stage</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="studio-label block mb-2">Current Stage</p>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: currentStyle.bg, color: currentStyle.fg }}>
              {currentStyle.label}
            </span>
          </div>
          <div>
            <label className="studio-label block mb-1.5">New Stage</label>
            <select value={newStage} onChange={e => setNewStage(e.target.value as ProjectStage)}
              className="studio-input w-full text-sm">
              {otherStages.map(s => (
                <option key={s} value={s}>{LIFECYCLE_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Note <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="Reason for stage change…"
              value={note} onChange={e => setNote(e.target.value)}
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
            <Layers className="h-4 w-4" />
            {saving ? 'Saving…' : 'Change Stage'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── CreateInvoiceDialog ────────────────────────────────────────────────────── */

function CreateInvoiceDialog({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const clientName = project.customerFullName ?? project.leadContactName ?? '—';

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate,   setInvoiceDate]   = useState(today);
  const [dueDate,       setDueDate]       = useState('');
  const [description,   setDescription]   = useState('');
  const [amountStr,     setAmountStr]      = useState('');
  const [gstType,       setGstType]        = useState<'none' | 'intrastate' | 'interstate'>('intrastate');
  const [notes,         setNotes]          = useState('');
  const [saving,        setSaving]         = useState(false);
  const [error,         setError]          = useState<string | null>(null);

  const subtotalPaise = amountStr && !isNaN(parseFloat(amountStr)) ? Math.round(parseFloat(amountStr) * 100) : 0;
  const cgstPaise     = gstType === 'intrastate' ? Math.round(subtotalPaise * 0.09) : 0;
  const sgstPaise     = gstType === 'intrastate' ? Math.round(subtotalPaise * 0.09) : 0;
  const igstPaise     = gstType === 'interstate' ? Math.round(subtotalPaise * 0.18) : 0;
  const totalPaise    = subtotalPaise + cgstPaise + sgstPaise + igstPaise;

  async function handleSave() {
    setError(null);
    const parsedAmt = parseFloat(amountStr);
    if (!amountStr || isNaN(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid amount'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId:    project.id,
          invoiceDate,
          subtotalPaise: Math.round(parsedAmt * 100),
          isInterstate:  gstType === 'interstate',
          noGst:         gstType === 'none',
          status:        'issued',
          ...(invoiceNumber.trim()  ? { invoiceNumber:   invoiceNumber.trim() }  : {}),
          ...(dueDate               ? { dueDate }                                : {}),
          ...(description.trim()    ? { hsnSacLinesJson: [{ description: description.trim(), amountPaise: Math.round(parsedAmt * 100) }] } : {}),
          ...(notes.trim()          ? { notes: notes.trim() }                    : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(typeof json.error === 'string' ? json.error : 'Failed to create invoice');
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
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <FileText className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Create Invoice</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Read-only context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Client</label>
              <div className="studio-input w-full text-sm" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                {clientName}
              </div>
            </div>
            <div>
              <label className="studio-label block mb-1.5">Project</label>
              <div className="studio-input w-full text-sm truncate" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                {project.name}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">
                Invoice # <span style={{ color: 'var(--text-tertiary)' }}>(auto if blank)</span>
              </label>
              <input type="text" placeholder="e.g. INV-2026-0001"
                value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="studio-input w-full text-sm" />
            </div>
            <div>
              <label className="studio-label block mb-1.5">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="studio-input w-full text-sm" />
            </div>
          </div>

          <div>
            <label className="studio-label block mb-1.5">
              Due Date <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>

          <div>
            <label className="studio-label block mb-1.5">
              Description / Items <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="e.g. Design & execution — Living room"
              value={description} onChange={e => setDescription(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Amount (₹) excl. GST</label>
              <input type="number" min="0.01" step="0.01" placeholder="e.g. 100000"
                value={amountStr} onChange={e => setAmountStr(e.target.value)}
                className="studio-input w-full text-sm" autoFocus />
            </div>
            <div>
              <label className="studio-label block mb-1.5">GST</label>
              <select value={gstType} onChange={e => setGstType(e.target.value as typeof gstType)}
                className="studio-input w-full text-sm">
                <option value="none">No GST</option>
                <option value="intrastate">Intrastate — 9% CGST + 9% SGST</option>
                <option value="interstate">Interstate — 18% IGST</option>
              </select>
            </div>
          </div>

          {/* Live GST breakdown */}
          {subtotalPaise > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ background: 'var(--surface-muted)' }}>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span className="font-medium text-[var(--text-primary)]">{formatRupees(subtotalPaise)}</span>
              </div>
              {cgstPaise > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>CGST 9%</span>
                  <span className="font-medium text-amber-600">+ {formatRupees(cgstPaise)}</span>
                </div>
              )}
              {sgstPaise > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>SGST 9%</span>
                  <span className="font-medium text-amber-600">+ {formatRupees(sgstPaise)}</span>
                </div>
              )}
              {igstPaise > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>IGST 18%</span>
                  <span className="font-medium text-amber-600">+ {formatRupees(igstPaise)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                <span>Invoice Total</span>
                <span>{formatRupees(totalPaise)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="studio-label block mb-1.5">
              Notes <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <textarea rows={2} placeholder="Payment terms, bank details, or any notes for the client…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="studio-input w-full text-sm resize-none" />
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
            <FileText className="h-4 w-4" />
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── InvoicePaymentDialog ───────────────────────────────────────────────────── */

function InvoicePaymentDialog({
  invoiceId, invoiceNumber, outstandingPaise, onClose, onSaved,
}: {
  invoiceId: string;
  invoiceNumber: string;
  outstandingPaise: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amountStr, setAmountStr] = useState(
    outstandingPaise > 0 ? String(outstandingPaise / 100) : '',
  );
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const parsed = parseFloat(amountStr);
    if (!amountStr || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount'); return;
    }
    if (!note.trim()) {
      setError('Please add a note (e.g. Bank transfer, UPI)'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: Math.round(parsed * 100),
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
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
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Record Payment</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{invoiceNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {outstandingPaise > 0 && (
            <div className="rounded-xl px-4 py-2.5 text-xs flex items-center justify-between" style={{ background: 'var(--surface-muted)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Outstanding on this invoice</span>
              <span className="font-semibold" style={{ color: 'var(--danger)' }}>{formatRupees(outstandingPaise)}</span>
            </div>
          )}
          <div>
            <label className="studio-label block mb-1.5">Amount Received (₹)</label>
            <input type="number" min="0.01" step="0.01"
              value={amountStr} onChange={e => setAmountStr(e.target.value)}
              className="studio-input w-full text-sm" autoFocus />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Payment Mode / Note</label>
            <input type="text" placeholder="e.g. UPI, Bank transfer, Cheque #1234"
              value={note} onChange={e => setNote(e.target.value)}
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

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project,    setProject]    = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [siteLogs,   setSiteLogs]   = useState<SiteLog[]>([]);
  const [invList,    setInvList]    = useState<ProjectInvoice[]>([]);
  const [role,       setRole]       = useState<string>('designer');
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editOpen,         setEditOpen]         = useState(false);
  const [changeStageOpen,  setChangeStageOpen]  = useState(false);
  const [paymentOpen,      setPaymentOpen]      = useState(false);
  const [expenseOpen,      setExpenseOpen]      = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [invoicePayTarget,  setInvoicePayTarget]  = useState<{
    id: string; invoiceNumber: string; outstandingPaise: number;
  } | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUploadErr,  setPhotoUploadErr]  = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const [pRes, mRes, eRes, lRes, iRes] = await Promise.all([
        fetch(`/api/v1/projects/${id}`),
        fetch(`/api/v1/projects/${id}/milestones`),
        fetch(`/api/v1/projects/${id}/expenses`),
        fetch(`/api/v1/projects/${id}/site-logs`),
        fetch(`/api/v1/invoices?projectId=${id}`),
      ]);
      if (!pRes.ok) { setFetchError('Project not found'); setLoading(false); return; }
      const [pd, md, ed, ld, inv] = await Promise.all([
        pRes.json() as Promise<{ data: Project & { currentUserRole?: string } }>,
        mRes.json() as Promise<{ data: Milestone[] }>,
        eRes.json() as Promise<{ data: Expense[] }>,
        lRes.json() as Promise<{ data: SiteLog[] }>,
        iRes.json() as Promise<{ data: ProjectInvoice[] }>,
      ]);
      setProject(pd.data);
      setRole(pd.data.currentUserRole ?? 'designer');
      setMilestones(md.data ?? []);
      setExpenses(ed.data ?? []);
      setSiteLogs(ld.data ?? []);
      setInvList(inv.data ?? []);
    } catch {
      setFetchError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  /* ── Derived values ── */
  const showFinance        = role === 'owner' || role === 'accountant';
  const contractPaise      = project?.totalContractPaise ?? 0;
  const paidMilestones     = milestones.filter(m => m.paymentStatus === 'paid');
  const totalExpensesPaise = expenses.reduce((s, e) => s + e.amountPaise, 0);
  const clientName         = project?.customerFullName ?? project?.leadContactName ?? null;
  const stage              = project ? STAGE_STYLE_MAP[project.lifecycleStage] : null;
  const allPhotos          = siteLogs.flatMap(l => l.photos ?? []);

  // Invoice-based financial KPIs (non-void invoices only)
  const activeInvoices     = invList.filter(inv => inv.status !== 'void');
  const invoicedPaise      = activeInvoices.reduce((s, inv) => s + inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise, 0);
  const invoiceReceivedPaise = activeInvoices.reduce((s, inv) => s + (inv.paidPaise ?? 0), 0);
  const invoiceOutstandingPaise = Math.max(0, invoicedPaise - invoiceReceivedPaise);
  const collectionPct      = invoicedPaise > 0 ? Math.round((invoiceReceivedPaise / invoicedPaise) * 100) : 0;

  async function handlePhotoUpload(files: FileList) {
    if (!files.length) return;
    setUploadingPhotos(true);
    setPhotoUploadErr(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await fetch(`/api/v1/projects/${id}/photos`, { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setPhotoUploadErr(json.error ?? 'Upload failed');
        return;
      }
      await loadAll();
    } catch {
      setPhotoUploadErr('Network error — please try again');
    } finally {
      setUploadingPhotos(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

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
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button type="button" onClick={() => setEditOpen(true)}
          className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
          <Edit2 className="h-4 w-4" />Edit
        </button>
        {showFinance && (
          <button type="button" onClick={() => setCreateInvoiceOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl"
            style={{ borderColor: 'var(--accent-base)', color: 'var(--accent-base)' }}>
            <FileText className="h-4 w-4" />Create Invoice
          </button>
        )}
        {showFinance && (
          <button type="button" onClick={() => setPaymentOpen(true)}
            className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
            <IndianRupee className="h-4 w-4" />Record Payment
          </button>
        )}
        {showFinance && (
          <button type="button" onClick={() => setExpenseOpen(true)}
            className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl">
            <Receipt className="h-4 w-4" />Add Expense
          </button>
        )}
      </div>

      {/* Hero KPI cards — owner/accountant only */}
      {showFinance && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Contract Value</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-heading)' }}>
            {contractPaise > 0
              ? formatRupees(contractPaise)
              : <span className="text-base font-medium" style={{ color: 'var(--text-tertiary)' }}>Not set</span>}
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Invoiced</p>
          <p className="text-2xl font-bold mt-1"
            style={{ color: invoicedPaise > 0 ? 'var(--accent-base)' : 'var(--text-tertiary)' }}>
            {invoicedPaise > 0 ? formatRupees(invoicedPaise) : '₹0'}
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Received</p>
          <p className="text-2xl font-bold mt-1"
            style={{ color: invoiceReceivedPaise > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {invoiceReceivedPaise > 0 ? formatRupees(invoiceReceivedPaise) : '₹0'}
          </p>
        </div>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Outstanding</p>
          <p className="text-2xl font-bold mt-1"
            style={{ color: invoiceOutstandingPaise > 0 ? 'var(--danger)' : invoicedPaise > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {invoicedPaise > 0 ? formatRupees(invoiceOutstandingPaise) : '—'}
          </p>
        </div>
      </div>}

      {/* Collection progress bar — owner/accountant only */}
      {showFinance && invoicedPaise > 0 && (
        <div className="rounded-2xl border px-5 py-4"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Invoice Collection Progress</span>
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

          {/* Project Invoices — owner/accountant only */}
          {showFinance && <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Project Invoices</h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCreateInvoiceOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  <Plus className="h-3.5 w-3.5" />New Invoice
                </button>
                <Link href={`/invoices?projectId=${id}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                  All<ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {invList.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No invoices created yet</p>
                <button type="button" onClick={() => setCreateInvoiceOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent-base)' }}>
                  <FileText className="h-3.5 w-3.5" />Create Invoice
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Invoice #</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Paid</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invList.map((inv, idx) => {
                    const totalPaise = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
                    const outstanding = Math.max(0, totalPaise - (inv.paidPaise ?? 0));
                    const badge = invoiceStatusBadge(inv.status);
                    const canPay = inv.status !== 'void' && outstanding > 0;
                    return (
                      <tr key={inv.id}
                        className="hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ borderBottom: idx < invList.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                          <Link href={`/invoices/${inv.id}`} className="hover:underline"
                            style={{ color: 'var(--accent-base)' }}>
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {formatRupees(totalPaise)}
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold"
                          style={{ color: (inv.paidPaise ?? 0) > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                          {formatRupees(inv.paidPaise ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {canPay && (
                            <button type="button"
                              onClick={() => setInvoicePayTarget({ id: inv.id, invoiceNumber: inv.invoiceNumber, outstandingPaise: outstanding })}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
                              style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                              <IndianRupee className="h-3 w-3" />Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {activeInvoices.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                      <td colSpan={2} className="px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Total ({activeInvoices.length} active)
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(invoicedPaise)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold" style={{ color: 'var(--success)' }}>
                        {formatRupees(invoiceReceivedPaise)}
                      </td>
                      <td colSpan={2} className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                        {invoiceOutstandingPaise > 0 ? `${formatRupees(invoiceOutstandingPaise)} due` : 'Fully paid'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>}

          {/* Ad-hoc Payments — owner/accountant only */}
          {showFinance && <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Ad-hoc Payments</h2>
              <div className="flex items-center gap-3">
                <Link href={`/projects/${id}/payments`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                  All<ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {paidMilestones.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No ad-hoc payments recorded</p>
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="mt-2 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  Record advance payment →
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
              </table>
            )}
          </div>}

          {/* Site Expenses — owner/accountant only */}
          {showFinance && <div className="rounded-2xl border overflow-hidden"
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
          </div>}

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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                  <Camera className="h-3.5 w-3.5" />
                  {uploadingPhotos ? 'Uploading…' : 'Add photos'}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) void handlePhotoUpload(e.target.files); }}
                />
              </div>
            </div>
            {photoUploadErr && (
              <div className="flex items-center gap-2 mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{photoUploadErr}
              </div>
            )}

            {allPhotos.length === 0 ? (
              <div className="py-10 text-center">
                <Camera className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No site photos yet</p>
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="mt-2 text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                  Upload photos →
                </button>
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
            <button type="button" onClick={() => setChangeStageOpen(true)}
              className="mt-4 w-full text-xs font-medium py-2 rounded-xl transition-colors hover:opacity-80"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              Change Stage
            </button>
          </div>

          {/* Money summary — owner/accountant only */}
          {showFinance && <div className="rounded-2xl border p-5 space-y-3"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Money Summary
            </p>
            <div className="space-y-2.5">
              {contractPaise > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Contract</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{formatRupees(contractPaise)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Invoiced</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>{formatRupees(invoicedPaise)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Received</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{formatRupees(invoiceReceivedPaise)}</span>
              </div>
              {invoicedPaise > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Outstanding</span>
                  <span className="text-xs font-semibold"
                    style={{ color: invoiceOutstandingPaise > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatRupees(invoiceOutstandingPaise)}
                  </span>
                </div>
              )}
              {totalExpensesPaise > 0 && (
                <>
                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Site Expenses</span>
                    <span className="text-xs font-semibold" style={{ color: '#F97316' }}>{formatRupees(totalExpensesPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cash Balance</span>
                    <span className="text-xs font-semibold"
                      style={{ color: invoiceReceivedPaise >= totalExpensesPaise ? 'var(--text-heading)' : 'var(--danger)' }}>
                      {formatRupees(invoiceReceivedPaise - totalExpensesPaise)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>}

        </div>
      </div>

      {/* Dialogs */}
      {editOpen           && <EditProjectDialog     project={project}  onClose={() => setEditOpen(false)}           onSaved={loadAll} />}
      {changeStageOpen    && <ChangeStageDialog     project={project}  onClose={() => setChangeStageOpen(false)}    onSaved={loadAll} />}
      {paymentOpen        && <RecordPaymentDialog   projectId={id}     onClose={() => setPaymentOpen(false)}        onSaved={loadAll} />}
      {expenseOpen        && <AddExpenseDialog      projectId={id}     onClose={() => setExpenseOpen(false)}        onSaved={loadAll} />}
      {createInvoiceOpen  && <CreateInvoiceDialog   project={project}  onClose={() => setCreateInvoiceOpen(false)}  onSaved={loadAll} />}
      {invoicePayTarget   && (
        <InvoicePaymentDialog
          invoiceId={invoicePayTarget.id}
          invoiceNumber={invoicePayTarget.invoiceNumber}
          outstandingPaise={invoicePayTarget.outstandingPaise}
          onClose={() => setInvoicePayTarget(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
