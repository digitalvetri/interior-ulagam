'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Receipt, AlertTriangle, X, ExternalLink } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@/types/accounts';

/* ── Category config ───────────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; bg: string; color: string; dot: string }> = {
  petty_cash: { label: 'Petty Cash', bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
  transport:  { label: 'Transport',  bg: 'var(--accent-soft)', color: 'var(--accent-text)', dot: 'var(--accent-base)' },
  labour:     { label: 'Labour',     bg: 'var(--warning-soft)', color: '#C2410C', dot: '#F97316' },
  material:   { label: 'Material',   bg: 'var(--accent-soft)', color: '#6B21A8', dot: 'var(--accent-base)' },
  other:      { label: 'Other',      bg: 'var(--surface-muted)', color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
};

const ALL_CATEGORIES: ExpenseCategory[] = ['petty_cash', 'transport', 'labour', 'material', 'other'];

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Log Expense Modal ─────────────────────────────────────────────────────── */

function LogExpenseModal({
  projectId, onClose, onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [category,     setCategory]     = useState<ExpenseCategory>('petty_cash');
  const [amountRupees, setAmountRupees] = useState('');
  const [description,  setDescription]  = useState('');
  const [receiptUrl,   setReceiptUrl]   = useState('');
  const [submitting,   setSub]          = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const parsed = parseFloat(amountRupees);
    if (!amountRupees || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount in rupees'); return;
    }
    const amountPaise = Math.round(parsed * 100);
    const payload: { projectId: string; category: ExpenseCategory; amountPaise: number; description?: string; receiptUrl?: string } = {
      projectId, category, amountPaise,
    };
    if (description.trim()) payload.description = description.trim();
    if (receiptUrl.trim())  payload.receiptUrl  = receiptUrl.trim();

    setSub(true);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? 'Failed to log expense'); return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSub(false);
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
                const cfg = CATEGORY_CONFIG[cat];
                const active = category === cat;
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: active ? cfg.dot : 'transparent',
                      background: active ? cfg.bg : 'var(--surface-muted)',
                      color: active ? cfg.color : 'var(--text-secondary)',
                    }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? cfg.dot : 'var(--text-tertiary)' }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Amount (₹) <span style={{ color: 'var(--text-tertiary)' }}>— stored as paise</span>
            </label>
            <input type="number" min="0.01" step="0.01" placeholder="e.g. 1500"
              value={amountRupees} onChange={e => setAmountRupees(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">Description</label>
            <input type="text" placeholder="Brief description of the expense"
              value={description} onChange={e => setDescription(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
          <div>
            <label className="studio-label block mb-1.5">
              Receipt URL <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="url" placeholder="https://…"
              value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)}
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
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            {submitting ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ProjectExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  const fetchExpenses = async () => {
    setLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/expenses`);
      if (!res.ok) { setFetchError('Failed to load expenses'); return; }
      const json = await res.json() as { data: Expense[] };
      setExpenses(json.data);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { void fetchExpenses(); }, [projectId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const totalPaise = expenses.reduce((s, e) => s + e.amountPaise, 0);
  const categoryBreakdown = ALL_CATEGORIES.map(cat => ({
    category: cat,
    totalPaise: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amountPaise, 0),
  })).filter(c => c.totalPaise > 0);

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Project Expenses</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Track site and project expenditure</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl flex-shrink-0">
          <Plus className="h-4 w-4" />Log Expense
        </button>
      </div>

      {/* Summary */}
      {!loading && expenses.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>Total Expenses</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{formatRupees(totalPaise)}</p>
          </div>
          {categoryBreakdown.length > 1 && (
            <>
              <div className="h-px mb-4" style={{ background: 'var(--border-subtle)' }} />
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-tertiary)' }}>BREAKDOWN BY CATEGORY</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categoryBreakdown.map(({ category, totalPaise: catTotal }) => (
                  <div key={category} className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                    style={{ background: CATEGORY_CONFIG[category].bg }}>
                    <span className="text-xs font-medium" style={{ color: CATEGORY_CONFIG[category].color }}>
                      {CATEGORY_CONFIG[category].label}
                    </span>
                    <span className="text-xs font-bold" style={{ color: CATEGORY_CONFIG[category].color }}>
                      {formatRupees(catTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>

      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="h-8 w-8" style={{ color: 'var(--danger)' }} />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{fetchError}</p>
        </div>

      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--warning-soft)' }}>
              <Receipt className="h-10 w-10" style={{ color: '#F97316' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', border: '2px solid var(--surface-card)' }}>
              <Plus className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No expenses logged yet</h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Track petty cash, transport, labour, and material costs to get a full picture of project spend.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
            <Receipt className="h-4 w-4" />Log First Expense
          </button>
        </div>

      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Logged Via</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, idx) => (
                <tr key={expense.id}
                  className="transition-colors hover:bg-[var(--surface-muted)]"
                  style={{ borderBottom: idx < expenses.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td className="px-4 py-3">
                    <CategoryBadge category={expense.category} />
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-heading)' }}>
                    {expense.description ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(expense.amountPaise)}
                  </td>
                  <td className="px-4 py-3 capitalize text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {expense.loggedVia}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(expense.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {expense.receiptUrl ? (
                      <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: 'var(--accent-base)' }}>
                        <ExternalLink className="h-3 w-3" />View
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          {/* Footer total */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Total</span>
            <span className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{formatRupees(totalPaise)}</span>
          </div>
        </div>
      )}

      {modalOpen && (
        <LogExpenseModal
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchExpenses}
        />
      )}
    </div>
  );
}
