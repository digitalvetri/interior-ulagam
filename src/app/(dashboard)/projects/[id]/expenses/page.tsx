'use client';

import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Receipt, AlertTriangle, X,
  ExternalLink, Search, TrendingDown, Users, Tag,
  Calendar,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@/types/accounts';

/* ── Category config ───────────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; bg: string; color: string; dot: string; bar: string }> = {
  petty_cash: { label: 'Petty Cash',  bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8', bar: '#94A3B8' },
  transport:  { label: 'Transport',   bg: '#EFF6FF', color: '#2563EB', dot: '#3B82F6', bar: '#3B82F6' },
  labour:     { label: 'Labour',      bg: '#FFF7ED', color: '#C2410C', dot: '#F97316', bar: '#F97316' },
  material:   { label: 'Material',    bg: '#F5F3FF', color: '#7C3AED', dot: '#8B5CF6', bar: '#8B5CF6' },
  other:      { label: 'Other',       bg: '#F0FDF4', color: '#15803D', dot: '#22C55E', bar: '#22C55E' },
};

const ALL_CATEGORIES: ExpenseCategory[] = ['petty_cash', 'transport', 'labour', 'material', 'other'];

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.dot}30` }}>
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Log Expense Modal ─────────────────────────────────────────────────────── */

function LogExpenseModal({ projectId, onClose, onSuccess }: {
  projectId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [category,     setCategory]     = useState<ExpenseCategory>('petty_cash');
  const [amountRupees, setAmountRupees] = useState('');
  const [description,  setDescription]  = useState('');
  const [receiptUrl,   setReceiptUrl]   = useState('');
  const [vendorName,   setVendorName]   = useState('');
  const [vendorId,     setVendorId]     = useState('');
  const [vendorList,   setVendorList]   = useState<{ id: string; name: string }[]>([]);
  const [gstPct,       setGstPct]       = useState(0);
  const [submitting,   setSub]          = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/vendors').then(r => r.json())
      .then(b => setVendorList(Array.isArray(b.data) ? b.data : []))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    setError(null);
    const parsed = parseFloat(amountRupees);
    if (!amountRupees || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount'); return;
    }
    const basePaise      = Math.round(parsed * 100);
    const gstAmountPaise = gstPct > 0 ? Math.round(basePaise * gstPct / 100) : 0;
    const amountPaise    = basePaise + gstAmountPaise;

    const payload: Record<string, unknown> = { projectId, category, amountPaise, gstPct, gstAmountPaise };
    if (description.trim()) payload.description = description.trim();
    if (receiptUrl.trim())  payload.receiptUrl  = receiptUrl.trim();
    if (vendorName.trim())  payload.vendorName  = vendorName.trim();
    if (vendorId)           payload.vendorId    = vendorId;

    setSub(true);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? 'Failed to log expense'); return;
      }
      onSuccess(); onClose();
    } catch {
      setError('Network error — please try again');
    } finally { setSub(false); }
  }

  const base    = parseFloat(amountRupees);
  const gstAmt  = (!isNaN(base) && base > 0 && gstPct > 0) ? base * gstPct / 100 : 0;
  const total   = (!isNaN(base) && base > 0) ? base + gstAmt : 0;
  const showGst = !isNaN(base) && base > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--warning-soft)' }}>
              <Receipt className="h-4 w-4" style={{ color: '#F97316' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Log Expense</h2>
          </div>
          <button type="button" onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Category */}
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

          {/* Vendor */}
          {vendorList.length > 0 && (
            <div>
              <label className="studio-label block mb-1.5">
                Vendor (registered) <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
              </label>
              <select value={vendorId} onChange={e => {
                const sel = e.target.value;
                setVendorId(sel);
                if (sel) {
                  const v = vendorList.find(v => v.id === sel);
                  if (v) setVendorName(v.name);
                }
              }} className="studio-input w-full text-sm">
                <option value="">Not in vendor list</option>
                {vendorList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="studio-label block mb-1.5">
              Vendor / Paid To <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="e.g. Raj Carpentry Works"
              value={vendorName} onChange={e => setVendorName(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>

          {/* Amount + GST */}
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

          {/* Live GST breakdown */}
          {showGst && (
            <div className="rounded-xl px-4 py-3 text-xs space-y-1.5"
              style={{ background: 'var(--surface-muted)' }}>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Base amount (excl. GST)</span>
                <span className="font-medium text-[var(--text-primary)]">
                  ₹{base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {gstPct > 0 && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>GST ({gstPct}%)</span>
                  <span className="font-medium text-amber-600">
                    + ₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                <span>Total paid</span>
                <span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="studio-label block mb-1.5">Description</label>
            <input type="text" placeholder="Brief description of the expense"
              value={description} onChange={e => setDescription(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>

          {/* Receipt URL */}
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

  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState<ExpenseCategory | 'all'>('all');

  const fetchExpenses = async () => {
    setLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/expenses`);
      if (!res.ok) { setFetchError('Failed to load expenses'); return; }
      const json = await res.json() as { data: Expense[] };
      setExpenses(json.data);
    } catch {
      setFetchError('Network error — please try again');
    } finally { setLoading(false); }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { void fetchExpenses(); }, [projectId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* ── Derived stats ─────────────────────────────────────────────────────── */
  const totalPaise = expenses.reduce((s, e) => s + e.amountPaise, 0);

  const now = new Date();
  const thisMonthPaise = expenses
    .filter(e => {
      const d = new Date(e.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amountPaise, 0);

  const categoryTotals = useMemo(() =>
    ALL_CATEGORIES.map(cat => ({
      category: cat,
      totalPaise: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amountPaise, 0),
    })).filter(c => c.totalPaise > 0).sort((a, b) => b.totalPaise - a.totalPaise),
    [expenses]
  );

  const topCategory = categoryTotals[0] ?? null;
  const vendorCount = new Set(expenses.map(e => e.vendorName).filter(Boolean)).size;
  const maxCatTotal = categoryTotals[0]?.totalPaise ?? 1;

  /* ── Filtered rows ─────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses.filter(e => {
      const matchCat = catFilter === 'all' || e.category === catFilter;
      const matchQ   = !q || (e.description ?? '').toLowerCase().includes(q) || (e.vendorName ?? '').toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [expenses, search, catFilter]);

  /* ── Skeleton ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-5 w-32 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-10 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Project Expenses</h1>
          {expenses.length > 0 && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'} · {formatRupees(totalPaise)} booked
            </p>
          )}
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white flex-shrink-0 transition-opacity hover:opacity-90"
          style={{ background: 'var(--text-heading)' }}>
          <Plus className="h-4 w-4" />Record Expense
        </button>
      </div>

      {/* KPI Cards */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Expenses */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--warning-soft)' }}>
              <TrendingDown className="h-5 w-5" style={{ color: '#F97316' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total Expenses</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{formatRupees(totalPaise)}</p>
            </div>
          </div>

          {/* This Month */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-soft)' }}>
              <Calendar className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>This Month</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>
                {thisMonthPaise > 0 ? formatRupees(thisMonthPaise) : '—'}
              </p>
            </div>
          </div>

          {/* Top Category */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: topCategory ? CATEGORY_CONFIG[topCategory.category].bg : 'var(--surface-muted)' }}>
              <Tag className="h-5 w-5" style={{ color: topCategory ? CATEGORY_CONFIG[topCategory.category].dot : 'var(--text-tertiary)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Top Category</p>
              {topCategory ? (
                <>
                  <p className="text-base font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>
                    {CATEGORY_CONFIG[topCategory.category].label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatRupees(topCategory.totalPaise)}</p>
                </>
              ) : (
                <p className="text-base font-bold mt-0.5" style={{ color: 'var(--text-tertiary)' }}>—</p>
              )}
            </div>
          </div>

          {/* Vendors */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#F0FDF4' }}>
              <Users className="h-5 w-5" style={{ color: '#16A34A' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Vendors</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{vendorCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{fetchError}
        </div>
      )}

      {/* Empty state */}
      {!fetchError && expenses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--warning-soft)' }}>
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
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white"
            style={{ background: 'var(--text-heading)' }}>
            <Receipt className="h-4 w-4" />Log First Expense
          </button>
        </div>
      )}

      {/* Main content — filters + table + sidebar */}
      {!fetchError && expenses.length > 0 && (
        <div className="flex gap-5 items-start">

          {/* Left: filters + table */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Filter bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search description or vendor…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="studio-input w-full pl-9 text-sm"
                />
              </div>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value as ExpenseCategory | 'all')}
                className="studio-input text-sm px-3 pr-8"
                style={{ minWidth: '150px' }}>
                <option value="all">All categories</option>
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No expenses match your filter.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                          <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Category</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Vendor</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((e, idx) => (
                          <tr key={e.id}
                            className="transition-colors hover:bg-[var(--surface-muted)]"
                            style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                            <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(e.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </td>
                            <td className="px-5 py-3.5 text-xs font-medium" style={{ color: 'var(--text-heading)', maxWidth: '200px' }}>
                              {e.description
                                ? <span className="line-clamp-1">{e.description}</span>
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                              }
                            </td>
                            <td className="px-5 py-3.5">
                              <CategoryBadge category={e.category} />
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {e.vendorName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold" style={{ color: '#EA580C' }}>
                              {formatRupees(e.amountPaise)}
                              {e.gstPct > 0 && (
                                <div className="text-xs font-normal mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                  incl. {e.gstPct}% GST
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {e.receiptUrl ? (
                                <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer"
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
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                      {formatRupees(filtered.reduce((s, e) => s + e.amountPaise, 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right sidebar: By category */}
          <div className="w-56 flex-shrink-0 rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>By category</p>
            {categoryTotals.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
            ) : (
              <div className="space-y-3.5">
                {categoryTotals.map(({ category, totalPaise: catTotal }) => {
                  const cfg = CATEGORY_CONFIG[category];
                  const pct = Math.round((catTotal / totalPaise) * 100);
                  const barW = Math.round((catTotal / maxCatTotal) * 100);
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>
                          {(catTotal / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }) === '0'
                            ? formatRupees(catTotal)
                            : `₹${(catTotal / 100 >= 1000
                              ? `${(catTotal / 100000).toFixed(1)}K`
                              : (catTotal / 100).toLocaleString('en-IN')
                            )}`
                          }
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${barW}%`, background: cfg.bar }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{pct}% of total</p>
                    </div>
                  );
                })}
              </div>
            )}
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
