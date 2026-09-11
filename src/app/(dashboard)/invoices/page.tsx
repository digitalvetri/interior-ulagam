'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Check, ChevronRight, Download, FileText,
  IndianRupee, Plus, Receipt, Search, X, Zap,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';

type PaymentStatus = 'pending' | 'link_sent' | 'paid' | 'overdue' | 'partial';

interface InvoiceRow {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  isInterstate: boolean;
  irn: string | null;
  pdfUrl: string | null;
  paymentStatus: PaymentStatus | null;
}

interface ProjOption {
  id: string;
  name: string;
  customerFullName?: string | null;
  leadContactName?: string | null;
}

interface MilestoneOption {
  id: string;
  label: string;
  amountPaise: number;
  paymentStatus: string;
  invoiceId?: string | null;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; color: string; border: string }> = {
  paid:      { label: 'Paid',        bg: 'var(--success-soft)',  color: 'var(--success-text)',  border: 'rgba(15,157,110,0.24)' },
  overdue:   { label: 'Outstanding', bg: '#FEE2E2',              color: '#B91C1C',              border: '#FCA5A5' },
  link_sent: { label: 'Issued',      bg: '#EEF2FF',              color: '#4338CA',              border: 'rgba(67,56,202,0.22)' },
  pending:   { label: 'Draft',       bg: 'var(--surface-muted)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
  partial:   { label: 'Partial',     bg: '#FFF7ED',              color: '#C2410C',              border: 'rgba(194,65,12,0.22)' },
};

const inputCls = 'studio-input w-full h-10';
const labelCls = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wide';

export default function InvoicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all' | 'outstanding'>('all');

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Step 1
  const [projectList, setProjectList] = useState<ProjOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selProjectId, setSelProjectId] = useState('');
  const [milestoneList, setMilestoneList] = useState<MilestoneOption[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [selMilestoneId, setSelMilestoneId] = useState('');

  // Step 2
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState('');
  const [subtotalInput, setSubtotalInput] = useState('');
  const [isInterstate, setIsInterstate] = useState(false);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/invoices')
      .then((r) => r.json())
      .then((body) => setRows((body.data ?? []) as InvoiceRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openModal() {
    const today = new Date().toISOString().slice(0, 10);
    const year  = new Date().getFullYear();
    setStep(1);
    setCreateError(null);
    setSelProjectId('');
    setSelMilestoneId('');
    setMilestoneList([]);
    setInvNumber(`INV-${year}-${String(rows.length + 1).padStart(4, '0')}`);
    setInvDate(today);
    setSubtotalInput('');
    setIsInterstate(false);
    setModalOpen(true);

    setProjectsLoading(true);
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then((body) => {
        const list = Array.isArray(body.data) ? body.data : (body.data?.rows ?? []);
        setProjectList(list as ProjOption[]);
      })
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
  }

  function handleProjectChange(projectId: string) {
    setSelProjectId(projectId);
    setSelMilestoneId('');
    setMilestoneList([]);
    setSubtotalInput('');
    if (!projectId) return;
    setMilestonesLoading(true);
    fetch(`/api/v1/projects/${projectId}/milestones`)
      .then((r) => r.json())
      .then((body) => {
        const all = (body.data ?? []) as MilestoneOption[];
        setMilestoneList(all.filter((m) => m.paymentStatus !== 'paid' && !m.invoiceId));
      })
      .catch(() => {})
      .finally(() => setMilestonesLoading(false));
  }

  function handleMilestoneChange(milestoneId: string) {
    setSelMilestoneId(milestoneId);
    if (!milestoneId) { setSubtotalInput(''); return; }
    const m = milestoneList.find((m) => m.id === milestoneId);
    if (m) setSubtotalInput(String(m.amountPaise / 100));
  }

  async function handleCreate() {
    const subtotalPaise = Math.round(parseFloat(subtotalInput || '0') * 100);
    if (subtotalPaise <= 0 || !invNumber.trim() || !invDate) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId:     selProjectId,
          milestoneId:   selMilestoneId || undefined,
          invoiceNumber: invNumber.trim(),
          invoiceDate:   invDate,
          subtotalPaise,
          isInterstate,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to create invoice');
      fetchInvoices();
      setModalOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  }

  // ── Derived values for GST preview ────────────────────────────────────────
  const subtotalPaise = Math.round(parseFloat(subtotalInput || '0') * 100);
  const igstPaise   = isInterstate ? Math.round(subtotalPaise * 0.18) : 0;
  const cgstPaise   = isInterstate ? 0 : Math.round(subtotalPaise * 0.09);
  const sgstPaise   = isInterstate ? 0 : Math.round(subtotalPaise * 0.09);
  const totalPaise  = subtotalPaise + cgstPaise + sgstPaise + igstPaise;
  const canCreate   = invNumber.trim().length > 0 && invDate.length > 0 && subtotalPaise > 0 && !!selProjectId;

  // ── Page KPIs ─────────────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    const status = r.paymentStatus ?? 'pending';
    if (statusFilter === 'outstanding' && status !== 'overdue') return false;
    if (statusFilter !== 'all' && statusFilter !== 'outstanding' && status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.invoiceNumber.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      (r.clientName ?? '').toLowerCase().includes(q)
    );
  });

  const totalInvoicedPaise = rows.reduce(
    (s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise,
    0,
  );
  const eInvoiceCount  = rows.filter((r) => r.irn).length;
  const outstandingPaise = rows
    .filter((r) => r.paymentStatus !== 'paid')
    .reduce((s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise, 0);

  return (
    <div className="space-y-6 p-4 lg:p-6">

      {/* ── New Invoice Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Dialog */}
          <div
            className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
                  New Invoice
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Step {step} of 2 — {step === 1 ? 'Select project & milestone' : 'Invoice details & GST'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Step 1: Project & Milestone ─── */}
            {step === 1 && (
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                    Project *
                  </label>
                  {projectsLoading ? (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading projects…</p>
                  ) : (
                    <select
                      value={selProjectId}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select a project…</option>
                      {projectList.map((p) => {
                        const client = p.customerFullName ?? p.leadContactName ?? null;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}{client ? ` — ${client}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {selProjectId && (
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                      Milestone <span className="font-normal normal-case">(optional)</span>
                    </label>
                    {milestonesLoading ? (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading milestones…</p>
                    ) : (
                      <select
                        value={selMilestoneId}
                        onChange={(e) => handleMilestoneChange(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">No milestone — enter custom amount</option>
                        {milestoneList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} — {formatRupees(m.amountPaise)}
                          </option>
                        ))}
                      </select>
                    )}
                    {!milestonesLoading && milestoneList.length === 0 && (
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        No unpaid milestones — enter a custom amount in the next step.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Invoice details ─── */}
            {step === 2 && (
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                      Invoice Number *
                    </label>
                    <input
                      type="text"
                      value={invNumber}
                      onChange={(e) => setInvNumber(e.target.value)}
                      className={inputCls}
                      placeholder="INV-2026-0001"
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                      Invoice Date *
                    </label>
                    <input
                      type="date"
                      value={invDate}
                      onChange={(e) => setInvDate(e.target.value)}
                      className="studio-input h-10 w-full px-3"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                    Amount before GST (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subtotalInput}
                    onChange={(e) => setSubtotalInput(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. 50000"
                  />
                </div>

                <div>
                  <label className={`${labelCls} mb-2`} style={{ color: 'var(--text-secondary)' }}>
                    GST Type
                  </label>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        checked={!isInterstate}
                        onChange={() => setIsInterstate(false)}
                        className="accent-purple-600"
                      />
                      <span className="text-sm" style={{ color: 'var(--text-heading)' }}>
                        Intrastate — 9% CGST + 9% SGST
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        checked={isInterstate}
                        onChange={() => setIsInterstate(true)}
                        className="accent-purple-600"
                      />
                      <span className="text-sm" style={{ color: 'var(--text-heading)' }}>
                        Interstate — 18% IGST
                      </span>
                    </label>
                  </div>
                </div>

                {/* GST summary */}
                <div
                  className="space-y-2 rounded-xl p-4"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span className="tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>
                      {formatRupees(subtotalPaise)}
                    </span>
                  </div>
                  {isInterstate ? (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>IGST 18%</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatRupees(igstPaise)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-secondary)' }}>CGST 9%</span>
                        <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatRupees(cgstPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-secondary)' }}>SGST 9%</span>
                        <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatRupees(sgstPaise)}
                        </span>
                      </div>
                    </>
                  )}
                  <div
                    className="flex justify-between border-t pt-2 text-sm font-bold"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                  >
                    <span>Total</span>
                    <span className="tabular-nums">{formatRupees(totalPaise)}</span>
                  </div>
                </div>

                {createError && (
                  <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
                    {createError}
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between border-t px-6 py-4"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
            >
              {step === 1 ? (
                <>
                  <button
                    onClick={closeModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-card)]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!selProjectId}
                    className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    disabled={creating}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-card)] disabled:opacity-40"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!canCreate || creating}
                    className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40"
                  >
                    {creating ? (
                      'Creating…'
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Create Invoice
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-4 pb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">
            {rows.length > 0 ? `${rows.length} shown` : 'All GST invoices issued across projects'}
          </p>
        </div>
        <button
          onClick={openModal}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New Invoice
        </button>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Invoices"
          value={String(rows.length)}
          icon={FileText}
          iconBg="#E8F5F0"
          iconColor="#2D8A6A"
        />
        <KpiCard
          label="Invoiced (Net)"
          value={formatRupees(totalInvoicedPaise)}
          icon={IndianRupee}
          iconBg="#E8F5F0"
          iconColor="#2D8A6A"
          valueColor="#2D8A6A"
        />
        <KpiCard
          label="Invoiced Outstanding"
          value={formatRupees(outstandingPaise)}
          sub="on invoiced milestones"
          icon={AlertCircle}
          iconBg={outstandingPaise > 0 ? '#FEF3CD' : '#E8F5F0'}
          iconColor={outstandingPaise > 0 ? '#D97706' : '#2D8A6A'}
          valueColor={outstandingPaise > 0 ? '#D97706' : undefined}
        />
        <KpiCard
          label="e-Invoices (IRN)"
          value={String(eInvoiceCount)}
          icon={Zap}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
        />
      </div>

      {/* ── Filter pills + search ─────────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'all',         label: 'All' },
              { key: 'outstanding', label: 'Outstanding' },
              { key: 'pending',     label: 'Draft' },
              { key: 'link_sent',   label: 'Issued' },
              { key: 'partial',     label: 'Partial' },
              { key: 'paid',        label: 'Paid' },
              { key: 'overdue',     label: 'Cancelled' },
            ] as { key: typeof statusFilter; label: string }[]).map(({ key, label }) => {
              const count = key === 'all'         ? rows.length
                          : key === 'outstanding' ? rows.filter(r => r.paymentStatus === 'overdue').length
                          : rows.filter(r => (r.paymentStatus ?? 'pending') === key).length;
              if (key !== 'all' && key !== 'outstanding' && count === 0) return null;
              const active = statusFilter === key;
              return (
                <button key={key} type="button" onClick={() => setStatusFilter(key)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium border transition-all"
                  style={active
                    ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                    : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }
                  }>
                  {label}
                  <span className="tabular-nums" style={{ opacity: 0.8 }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Search invoice #, client, project…"
              value={query} onChange={(e) => setQuery(e.target.value)}
              className="studio-input h-8 w-full text-sm" style={{ paddingLeft: '2.25rem' }} />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-4 w-28 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-5 w-20 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Receipt className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              {query || statusFilter !== 'all' ? 'No invoices match your filters.' : 'No invoices yet.'}
            </p>
            {(query || statusFilter !== 'all') && (
              <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); }}
                className="text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['INVOICE #', 'CLIENT', 'PROJECT/SO', 'INVOICE DATE', 'STATUS', 'AMOUNT', ''].map((h, i) => (
                    <th key={i}
                      className="px-4 py-3 text-xs font-semibold tracking-wide"
                      style={{ color: 'var(--text-secondary)', textAlign: h === 'AMOUNT' ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => {
                  const taxPaise = inv.isInterstate ? inv.igstPaise : inv.cgstPaise + inv.sgstPaise;
                  const total    = inv.subtotalPaise + taxPaise;
                  const status   = inv.paymentStatus ?? 'pending';
                  const cfg      = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={inv.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                      onClick={() => router.push(`/invoices/${inv.id}`)}>

                      {/* INVOICE # */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold font-mono text-sm" style={{ color: 'var(--accent-base)' }}>
                          {inv.invoiceNumber}
                        </div>
                        {inv.irn && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                            e-Invoice
                          </span>
                        )}
                      </td>

                      {/* CLIENT */}
                      <td className="px-4 py-3.5 max-w-[160px] truncate">
                        <span className="font-medium text-sm" style={{ color: 'var(--text-heading)' }}>
                          {inv.clientName ?? '—'}
                        </span>
                      </td>

                      {/* PROJECT/SO */}
                      <td className="px-4 py-3.5 max-w-[180px] truncate">
                        <Link href={`/projects/${inv.projectId}`}
                          className="text-sm hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={e => e.stopPropagation()}>
                          {inv.projectName}
                        </Link>
                      </td>

                      {/* INVOICE DATE */}
                      <td className="px-4 py-3.5 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
                          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* AMOUNT */}
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold"
                        style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(total)}
                        <div className="text-[10px] font-normal" style={{ color: 'var(--text-tertiary)' }}>
                          +{formatRupees(taxPaise)} {inv.isInterstate ? 'IGST' : 'GST'}
                        </div>
                      </td>

                      {/* PDF */}
                      <td className="px-3 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs font-medium transition-all hover:opacity-70"
                            style={{ color: 'var(--text-secondary)' }}>
                            <Download className="h-3.5 w-3.5" />PDF
                          </a>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs transition-all"
                            style={{ color: 'var(--text-tertiary)' }}>
                            <FileText className="h-3.5 w-3.5" />View
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(query || statusFilter !== 'all') && (
              <div className="px-4 py-2 text-xs flex justify-between"
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
                <span>{filtered.length} of {rows.length}</span>
                <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); }}
                  className="font-medium" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconColor, valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </p>
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconBg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
      </div>
      <p
        className="mt-2 text-2xl font-bold tabular-nums"
        style={{ color: valueColor ?? 'var(--text-heading)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
      )}
    </div>
  );
}
