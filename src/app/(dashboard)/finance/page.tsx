'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowUpRight, Check, ChevronDown, ChevronRight,
  Download, FileSpreadsheet, FileText, HandCoins, IndianRupee,
  Loader2, Plus, Receipt, Search, TrendingUp, Truck, Wallet, X, Zap,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'invoices' | 'payments' | 'expenses' | 'vendor_payables';

type PaymentStatus = 'pending' | 'link_sent' | 'paid' | 'overdue';

interface InvoiceRow {
  id: string; projectId: string; projectName: string;
  invoiceNumber: string; invoiceDate: string;
  subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
  isInterstate: boolean; irn: string | null; pdfUrl: string | null;
  paymentStatus: PaymentStatus | null;
}

interface OverviewPayload {
  kpis: {
    outstandingPaise: number; overduePaise: number; openReceivableCount: number;
    collected30dPaise: number; collected30dCount: number;
    collectedAllTimePaise: number; collectedAllTimeCount: number;
  };
  receivables: {
    id: string; projectId: string; projectName: string; clientName: string | null;
    label: string; amountPaise: number;
    paymentStatus: 'pending' | 'link_sent' | 'overdue'; daysSinceCreation: number;
  }[];
  payments: {
    id: string; invoiceId: string; projectId: string | null; projectName: string | null;
    invoiceNumber: string | null; amountPaise: number; status: string;
    source: 'razorpay' | 'manual'; reference: string | null;
    reconciledAt: string | null; createdAt: string;
  }[];
}

interface ExpenseRow {
  id: string; projectId: string; category: string; amountPaise: number;
  description: string | null; receiptUrl: string | null; createdAt: string;
}

interface VendorPayable {
  vendorId: string; vendorName: string; poCount: number;
  totalOrderedPaise: number; advancePaidPaise: number; netPayablePaise: number;
}

interface ProjOption { id: string; name: string; customerFullName?: string | null; leadContactName?: string | null }
interface MilestoneOption { id: string; label: string; amountPaise: number; paymentStatus: string; invoiceId?: string | null }
interface InvoiceOption { id: string; invoiceNumber: string; subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; paymentStatus: string; }

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'invoices',        label: 'Invoices',          icon: FileText    },
  { key: 'payments',        label: 'Payments received', icon: HandCoins   },
  { key: 'expenses',        label: 'Expenses',          icon: Receipt     },
  { key: 'vendor_payables', label: 'Vendor payables',   icon: Truck       },
];

const INV_STATUS: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
  paid:      { label: 'Paid',      bg: 'var(--success-soft)', color: 'var(--success)'        },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',  color: 'var(--danger)'          },
  link_sent: { label: 'Link sent', bg: '#FEF9C3',             color: '#92400E'                },
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)',color: 'var(--text-secondary)'  },
};

const RCV_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  link_sent: { label: 'Link sent', bg: '#FEF9C3',              color: '#92400E'                },
  overdue:   { label: 'Overdue',   bg: 'var(--danger-soft)',   color: 'var(--danger)'          },
};

const PAY_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  captured: { label: 'Received', bg: '#D1FAE5', color: '#059669' },
  pending:  { label: 'Pending',  bg: '#FEF3CD', color: '#D97706' },
  failed:   { label: 'Failed',   bg: 'var(--danger-soft)', color: 'var(--danger)' },
};

const EXP_CATEGORIES = ['petty_cash','transport','labour','material','other'] as const;
const EXP_LABEL: Record<string, string> = {
  petty_cash: 'Petty Cash', transport: 'Transport', labour: 'Labour',
  material: 'Material', other: 'Other',
};

const inputCls = 'studio-input w-full h-10';
const labelCls = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wide';

// ─── Helper ────────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function startOfPrevMonth(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); }
function endOfPrevMonth(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); }
function startOfFY(d: Date) {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 3, 1));
}

// ─── Invoices Tab ──────────────────────────────────────────────────────────────

function InvoicesTab() {
  const [rows, setRows]       = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [modalOpen, setModal] = useState(false);
  const [step, setStep]       = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectList, setProjectList]   = useState<ProjOption[]>([]);
  const [projLoading, setProjLoading]   = useState(false);
  const [selProjectId, setSelProject]   = useState('');
  const [milestoneList, setMilestones]  = useState<MilestoneOption[]>([]);
  const [milLoading, setMilLoading]     = useState(false);
  const [selMilestoneId, setSelMile]    = useState('');
  const [invNumber, setInvNumber]       = useState('');
  const [invDate, setInvDate]           = useState('');
  const [subtotalInput, setSubtotal]    = useState('');
  const [isInterstate, setInterstate]   = useState(false);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/invoices')
      .then(r => r.json())
      .then(b => setRows((b.data ?? []) as InvoiceRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  function openModal() {
    const today = new Date().toISOString().slice(0, 10);
    setStep(1); setCreateError(null); setSelProject(''); setSelMile('');
    setMilestones([]); setInvNumber(`INV-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, '0')}`);
    setInvDate(today); setSubtotal(''); setInterstate(false); setModal(true);
    setProjLoading(true);
    fetch('/api/v1/projects').then(r => r.json())
      .then(b => {
        const list = Array.isArray(b.data) ? b.data : (b.data?.rows ?? []);
        setProjectList(list as ProjOption[]);
      })
      .catch(() => {})
      .finally(() => setProjLoading(false));
  }

  function handleProjectChange(id: string) {
    setSelProject(id); setSelMile(''); setMilestones([]); setSubtotal('');
    if (!id) return;
    setMilLoading(true);
    fetch(`/api/v1/projects/${id}/milestones`).then(r => r.json())
      .then(b => {
        const all = (b.data ?? []) as MilestoneOption[];
        setMilestones(all.filter(m => m.paymentStatus !== 'paid' && !m.invoiceId));
      })
      .catch(() => {})
      .finally(() => setMilLoading(false));
  }

  async function handleCreate() {
    const sub = Math.round(parseFloat(subtotalInput || '0') * 100);
    if (sub <= 0 || !invNumber.trim() || !invDate || !selProjectId) return;
    setCreating(true); setCreateError(null);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: selProjectId, milestoneId: selMilestoneId || undefined,
          invoiceNumber: invNumber.trim(), invoiceDate: invDate,
          subtotalPaise: sub, isInterstate,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed');
      fetchInvoices(); setModal(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  const sub = Math.round(parseFloat(subtotalInput || '0') * 100);
  const igst = isInterstate ? Math.round(sub * 0.18) : 0;
  const cgst = isInterstate ? 0 : Math.round(sub * 0.09);
  const sgst = isInterstate ? 0 : Math.round(sub * 0.09);
  const total = sub + cgst + sgst + igst;
  const canCreate = invNumber.trim().length > 0 && invDate.length > 0 && sub > 0 && !!selProjectId;

  const filtered = rows.filter(r =>
    query === '' ||
    r.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
    r.projectName.toLowerCase().includes(query.toLowerCase()),
  );
  const totalPaise = rows.reduce((s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise, 0);
  const outstanding = rows.filter(r => r.paymentStatus !== 'paid')
    .reduce((s, r) => s + r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise, 0);

  return (
    <div className="space-y-5">
      {/* New Invoice modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creating && setModal(false)} />
          <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>New Invoice</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Step {step} of 2 — {step === 1 ? 'Select project & milestone' : 'Invoice details & GST'}
                </p>
              </div>
              <button onClick={() => !creating && setModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {step === 1 && (
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Project *</label>
                  {projLoading ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p> : (
                    <select value={selProjectId} onChange={e => handleProjectChange(e.target.value)} className={inputCls}>
                      <option value="">Select a project…</option>
                      {projectList.map(p => {
                        const c = p.customerFullName ?? p.leadContactName ?? null;
                        return <option key={p.id} value={p.id}>{p.name}{c ? ` — ${c}` : ''}</option>;
                      })}
                    </select>
                  )}
                </div>
                {selProjectId && (
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                      Milestone <span className="font-normal normal-case">(optional)</span>
                    </label>
                    {milLoading ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p> : (
                      <select value={selMilestoneId} onChange={e => {
                        setSelMile(e.target.value);
                        const m = milestoneList.find(x => x.id === e.target.value);
                        if (m) setSubtotal(String(m.amountPaise / 100));
                        else setSubtotal('');
                      }} className={inputCls}>
                        <option value="">No milestone — enter custom amount</option>
                        {milestoneList.map(m => <option key={m.id} value={m.id}>{m.label} — {formatRupees(m.amountPaise)}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Invoice Number *</label>
                    <input type="text" value={invNumber} onChange={e => setInvNumber(e.target.value)} className={inputCls} placeholder="INV-2026-0001" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Invoice Date *</label>
                    <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} className="studio-input h-10 w-full px-3" />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount before GST (₹) *</label>
                  <input type="number" min="0" step="0.01" value={subtotalInput} onChange={e => setSubtotal(e.target.value)} className={inputCls} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className={`${labelCls} mb-2`} style={{ color: 'var(--text-secondary)' }}>GST Type</label>
                  <div className="flex flex-wrap gap-5">
                    {[false, true].map(inter => (
                      <label key={String(inter)} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" checked={isInterstate === inter} onChange={() => setInterstate(inter)} className="accent-purple-600" />
                        <span className="text-sm" style={{ color: 'var(--text-heading)' }}>
                          {inter ? 'Interstate — 18% IGST' : 'Intrastate — 9% CGST + 9% SGST'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 rounded-xl p-4" style={{ background: 'var(--surface-muted)' }}>
                  {[
                    ['Subtotal', sub],
                    ...(isInterstate ? [['IGST 18%', igst]] : [['CGST 9%', cgst], ['SGST 9%', sgst]]),
                  ].map(([lbl, val]) => (
                    <div key={String(lbl)} className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>{lbl}</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 text-sm font-bold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                    <span>Total</span><span className="tabular-nums">{formatRupees(total)}</span>
                  </div>
                </div>
                {createError && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{createError}</p>}
              </div>
            )}
            <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
              {step === 1 ? (
                <>
                  <button onClick={() => setModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--surface-card)]" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                  <button onClick={() => setStep(2)} disabled={!selProjectId} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40">
                    Next <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setStep(1)} disabled={creating} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--surface-card)] disabled:opacity-40" style={{ color: 'var(--text-secondary)' }}>← Back</button>
                  <button onClick={handleCreate} disabled={!canCreate || creating} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40">
                    {creating ? 'Creating…' : <><Check className="h-3.5 w-3.5" strokeWidth={2.25} />Create Invoice</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 flex-1">
          <StatCard label="Total Invoiced" value={formatRupees(totalPaise)} icon={IndianRupee} iconBg="#E8F5F0" iconColor="#2D8A6A" valueColor="#2D8A6A" />
          <StatCard label="Outstanding" value={formatRupees(outstanding)} icon={AlertCircle}
            iconBg={outstanding > 0 ? '#FEF3CD' : '#E8F5F0'} iconColor={outstanding > 0 ? '#D97706' : '#2D8A6A'} />
          <StatCard label="Invoices" value={String(rows.length)} icon={FileText} iconBg="#EDE9FE" iconColor="#7C3AED" />
        </div>
        <button onClick={openModal} className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px] shrink-0">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />New Invoice
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input type="text" placeholder="Search invoice # or project…" value={query} onChange={e => setQuery(e.target.value)}
          className="h-9 w-full rounded-xl border bg-[var(--surface-card)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
          <Receipt className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{query ? 'No invoices match your search' : 'No invoices yet'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Invoice #','Project','Date','Subtotal','Tax','Total','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const taxPaise = inv.isInterstate ? inv.igstPaise : inv.cgstPaise + inv.sgstPaise;
                  const invTotal = inv.subtotalPaise + taxPaise;
                  const status   = inv.paymentStatus ?? 'pending';
                  const cfg      = INV_STATUS[status] ?? INV_STATUS.pending;
                  return (
                    <tr key={inv.id} className="hover:bg-[var(--surface-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent-base)' }}>
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoiceNumber}</Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-heading)' }}>
                        <Link href={`/projects/${inv.projectId}`} className="hover:underline">{inv.projectName}</Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(inv.subtotalPaise)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatRupees(taxPaise)}<span className="ml-0.5 text-[10px]">{inv.isInterstate ? 'igst' : 'gst'}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: 'var(--text-heading)' }}>{formatRupees(invTotal)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.pdfUrl
                          ? <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><Download className="h-3.5 w-3.5" /> PDF</a>
                          : <Link href={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-70" style={{ color: 'var(--text-tertiary)' }}><FileText className="h-3.5 w-3.5" /> View</Link>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ──────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [data, setData]         = useState<OverviewPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [tallyOpen, setTally]   = useState(false);
  const [exportErr, setExErr]   = useState<string | null>(null);
  const [busyExp, setBusy]      = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [tallyFrom, setTFrom]   = useState(isoDate(startOfMonth(today)));
  const [tallyTo, setTTo]       = useState(isoDate(today));

  // Record Payment modal
  const [recOpen, setRecOpen]         = useState(false);
  const [recProjList, setRecProjList] = useState<ProjOption[]>([]);
  const [recProjLd, setRecProjLd]     = useState(false);
  const [recProjId, setRecProjId]     = useState('');
  const [recInvList, setRecInvList]   = useState<InvoiceOption[]>([]);
  const [recInvLd, setRecInvLd]       = useState(false);
  const [recInvId, setRecInvId]       = useState('');
  const [recAmount, setRecAmount]     = useState('');
  const [recNote, setRecNote]         = useState('');
  const [recSaving, setRecSaving]     = useState(false);
  const [recError, setRecError]       = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/accounts/overview').then(r => r.json())
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openRecPay() {
    setRecOpen(true); setRecProjId(''); setRecInvList([]); setRecInvId('');
    setRecAmount(''); setRecNote(''); setRecError(null); setRecProjLd(true);
    fetch('/api/v1/projects').then(r => r.json())
      .then(b => setRecProjList(Array.isArray(b.data) ? b.data : (b.data?.rows ?? [])))
      .catch(() => {})
      .finally(() => setRecProjLd(false));
  }

  function handleRecProj(id: string) {
    setRecProjId(id); setRecInvList([]); setRecInvId(''); setRecAmount('');
    if (!id) return;
    setRecInvLd(true);
    fetch(`/api/v1/invoices?projectId=${id}`).then(r => r.json())
      .then(b => setRecInvList(
        ((b.data ?? []) as InvoiceOption[]).filter(inv => inv.paymentStatus !== 'paid')
      ))
      .catch(() => {})
      .finally(() => setRecInvLd(false));
  }

  function handleRecInv(id: string) {
    setRecInvId(id);
    const inv = recInvList.find(x => x.id === id);
    if (inv) {
      const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
      setRecAmount(String(total / 100));
    } else { setRecAmount(''); }
  }

  async function submitRecPay() {
    setRecError(null);
    if (!recInvId) { setRecError('Please select an invoice'); return; }
    const amtPaise = Math.round(parseFloat(recAmount || '0') * 100);
    if (amtPaise <= 0) { setRecError('Enter a valid amount'); return; }
    if (!recNote.trim()) { setRecError('Reference / note is required'); return; }
    setRecSaving(true);
    try {
      const res = await fetch(`/api/v1/invoices/${recInvId}/payments`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountPaise: amtPaise, note: recNote.trim() }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed');
      setRecOpen(false); fetchData();
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Failed');
    } finally { setRecSaving(false); }
  }

  async function dlExport(url: string, filename: string) {
    setExErr(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch { setExErr('Export failed — please try again.'); }
  }

  async function dlTally(kind: string) {
    if (!tallyFrom || !tallyTo) { setExErr('Pick a date range first.'); return; }
    if (tallyFrom > tallyTo)   { setExErr('"From" must be before "To".'); return; }
    setBusy(kind);
    const ext  = kind.endsWith('xml') ? 'xml' : 'csv';
    const type = kind.includes('sales') ? 'sales' : 'receipts';
    try { await dlExport(`/api/v1/exports/${kind}?from=${tallyFrom}&to=${tallyTo}`, `tally_${type}_${tallyFrom}_to_${tallyTo}.${ext}`); }
    finally { setBusy(null); }
  }

  function applyPreset(p: 'this-month' | 'last-month' | 'fy') {
    const now = new Date();
    if (p === 'this-month') { setTFrom(isoDate(startOfMonth(now))); setTTo(isoDate(now)); }
    else if (p === 'last-month') { setTFrom(isoDate(startOfPrevMonth(now))); setTTo(isoDate(endOfPrevMonth(now))); }
    else { setTFrom(isoDate(startOfFY(now))); setTTo(isoDate(now)); }
  }

  const filteredRcv = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.receivables;
    return data.receivables.filter(r =>
      r.projectName.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) || (r.clientName ?? '').toLowerCase().includes(q));
  }, [data, search]);

  const filteredPay = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.payments;
    return data.payments.filter(p =>
      (p.projectName ?? '').toLowerCase().includes(q) || (p.invoiceNumber ?? '').toLowerCase().includes(q));
  }, [data, search]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div>;
  if (!data)   return <div className="p-4 text-sm text-red-600">Failed to load accounts data.</div>;

  const k = data.kpis;
  return (
    <div className="space-y-5">
      {/* Record Payment modal */}
      {recOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !recSaving && setRecOpen(false)} />
          <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Record Payment</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>Log a manual payment received outside Razorpay</p>
              </div>
              <button onClick={() => !recSaving && setRecOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Project *</label>
                {recProjLd ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p> : (
                  <select value={recProjId} onChange={e => handleRecProj(e.target.value)} className={inputCls}>
                    <option value="">Select a project…</option>
                    {recProjList.map(p => {
                      const c = p.customerFullName ?? p.leadContactName ?? null;
                      return <option key={p.id} value={p.id}>{p.name}{c ? ` — ${c}` : ''}</option>;
                    })}
                  </select>
                )}
              </div>
              {recProjId && (
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Invoice *</label>
                  {recInvLd ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p> : recInvList.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No unpaid invoices for this project.</p>
                  ) : (
                    <select value={recInvId} onChange={e => handleRecInv(e.target.value)} className={inputCls}>
                      <option value="">Select an invoice…</option>
                      {recInvList.map(inv => {
                        const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
                        return <option key={inv.id} value={inv.id}>{inv.invoiceNumber} — {formatRupees(total)}</option>;
                      })}
                    </select>
                  )}
                </div>
              )}
              {recInvId && (
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount received (₹) *</label>
                  <input type="number" min="0.01" step="0.01" value={recAmount}
                    onChange={e => setRecAmount(e.target.value)} className={inputCls} placeholder="e.g. 57330" />
                </div>
              )}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Reference / note *</label>
                <input type="text" value={recNote} onChange={e => setRecNote(e.target.value)}
                  className={inputCls} placeholder="UTR / cheque no. / cash receipt details" />
              </div>
              {recError && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{recError}</p>}
            </div>
            <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <button onClick={() => !recSaving && setRecOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--surface-card)]"
                style={{ color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={submitRecPay} disabled={recSaving || !recInvId}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40">
                {recSaving ? 'Saving…' : <><Check className="h-3.5 w-3.5" strokeWidth={2.25} />Record Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Outstanding"      value={formatRupees(k.outstandingPaise)}      icon={Wallet}     iconBg="#FEF3CD" iconColor="#D97706" sub={`${k.openReceivableCount} to collect`} />
        <StatCard label="Overdue"          value={formatRupees(k.overduePaise)}          icon={AlertCircle} iconBg={k.overduePaise > 0 ? 'var(--danger-soft)' : 'var(--surface-muted)'} iconColor={k.overduePaise > 0 ? 'var(--danger)' : 'var(--text-tertiary)'} />
        <StatCard label="Collected · 30d"  value={formatRupees(k.collected30dPaise)}     icon={TrendingUp} iconBg="#D1FAE5" iconColor="#059669" sub={`${k.collected30dCount} payments`} />
        <StatCard label="Collected · Total" value={formatRupees(k.collectedAllTimePaise)} icon={HandCoins} iconBg="#DBEAFE" iconColor="#2563EB" sub={`${k.collectedAllTimeCount} transactions`} />
      </div>

      {/* Search + action */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input type="text" placeholder="Search project, client…" value={search} onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border bg-[var(--surface-card)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }} />
        </div>
        <button onClick={openRecPay} className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px] shrink-0">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />Record Payment
        </button>
      </div>

      {/* Receivables */}
      {filteredRcv.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Outstanding receivables</p>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Project','Client','Milestone','Amount','Status','Age',''].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredRcv.map(r => {
                    const cfg = RCV_STATUS[r.paymentStatus] ?? RCV_STATUS.pending;
                    return (
                      <tr key={r.id} className="hover:bg-[var(--surface-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3"><Link href={`/projects/${r.projectId}/payments`} className="font-medium hover:underline" style={{ color: 'var(--text-heading)' }}>{r.projectName}</Link></td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.clientName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.label}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(r.amountPaise)}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                        <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>{r.daysSinceCreation}d</td>
                        <td className="px-4 py-3 text-right"><Link href={`/projects/${r.projectId}/payments`} className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent-base)' }}>Manage <ArrowUpRight className="h-3 w-3" /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments received */}
      {filteredPay.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Payments received</p>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date','Project','Invoice','Amount','Status','Source'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredPay.map(p => {
                    const cfg = PAY_STATUS[p.status] ?? PAY_STATUS.pending;
                    return (
                      <tr key={p.id} className="hover:bg-[var(--surface-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(p.reconciledAt ?? p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3">{p.projectId && p.projectName ? <Link href={`/projects/${p.projectId}`} className="font-medium hover:underline" style={{ color: 'var(--text-heading)' }}>{p.projectName}</Link> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                        <td className="px-4 py-3">{p.invoiceNumber ? <Link href={`/invoices/${p.invoiceId}`} className="font-mono text-xs hover:underline" style={{ color: 'var(--text-primary)' }}>{p.invoiceNumber}</Link> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(p.amountPaise)}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.source === 'razorpay' ? <Zap className="h-3 w-3" style={{ color: '#3B82F6' }} /> : <HandCoins className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />}{p.source === 'razorpay' ? 'Razorpay' : 'Manual'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tally Export */}
      {exportErr && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{exportErr}</div>}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
        <button type="button" onClick={() => setTally(!tallyOpen)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#ECFDF5' }}>
              <FileSpreadsheet className="h-4 w-4" style={{ color: '#059669' }} />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Tally Export</p>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Import sales &amp; receipt vouchers into Tally Prime</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform" style={{ color: 'var(--text-tertiary)', transform: tallyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>
        {tallyOpen && (
          <div className="space-y-4 px-5 pb-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex flex-wrap items-end gap-3 pt-4">
              {([{ lbl: 'From', val: tallyFrom, setter: setTFrom }, { lbl: 'To', val: tallyTo, setter: setTTo }] as const).map(({ lbl, val, setter }) => (
                <div key={lbl} className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{lbl}</label>
                  <input type="date" value={val} onChange={e => setter(e.target.value)}
                    className="h-9 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30"
                    style={{ width: '160px', borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-heading)' }} />
                </div>
              ))}
              <div className="flex gap-1.5 pb-px">
                {(['this-month','last-month','fy'] as const).map(p => (
                  <button key={p} type="button" onClick={() => applyPreset(p)}
                    className="rounded-lg border px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
                    {p === 'this-month' ? 'This month' : p === 'last-month' ? 'Last month' : 'FY-to-date'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Sales Vouchers', desc: 'Invoices raised in range', csvKind: 'tally-sales-csv', xmlKind: 'tally-sales-xml' },
                { title: 'Receipt Vouchers', desc: 'Payments captured in range', csvKind: 'tally-receipts-csv', xmlKind: 'tally-receipts-xml' },
              ].map(({ title, desc, csvKind, xmlKind }) => (
                <div key={title} className="flex items-center justify-between gap-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {[['CSV', csvKind], ['XML', xmlKind]].map(([lbl, kind]) => (
                      <button key={lbl} type="button" onClick={() => dlTally(kind as string)} disabled={busyExp === kind}
                        className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-60">
                        {busyExp === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (lbl === 'CSV' ? <FileText className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />)}
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expenses Tab ──────────────────────────────────────────────────────────────

function ExpensesTab() {
  const [rows, setRows]       = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCat]   = useState('');

  // Log Expense modal
  const [logOpen, setLogOpen]         = useState(false);
  const [logProjList, setLogProjList] = useState<ProjOption[]>([]);
  const [logProjLd, setLogProjLd]     = useState(false);
  const [logProjId, setLogProjId]     = useState('');
  const [logCat, setLogCat]           = useState<(typeof EXP_CATEGORIES)[number]>('other');
  const [logVendor, setLogVendor]     = useState('');
  const [logAmount, setLogAmount]     = useState('');
  const [logGstPct, setLogGstPct]     = useState(0);
  const [logDesc, setLogDesc]         = useState('');
  const [logSaving, setLogSaving]     = useState(false);
  const [logError, setLogError]       = useState<string | null>(null);

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/expenses').then(r => r.json())
      .then(b => setRows((b.data ?? []) as ExpenseRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function openLogExp() {
    setLogOpen(true); setLogProjId(''); setLogCat('other'); setLogVendor('');
    setLogAmount(''); setLogGstPct(0); setLogDesc(''); setLogError(null); setLogProjLd(true);
    fetch('/api/v1/projects').then(r => r.json())
      .then(b => setLogProjList(Array.isArray(b.data) ? b.data : (b.data?.rows ?? [])))
      .catch(() => {})
      .finally(() => setLogProjLd(false));
  }

  async function submitLogExp() {
    setLogError(null);
    if (!logProjId) { setLogError('Please select a project'); return; }
    const amtPaise = Math.round(parseFloat(logAmount || '0') * 100);
    if (amtPaise <= 0) { setLogError('Enter a valid amount'); return; }
    const gstAmtPaise = logGstPct > 0 ? Math.round(amtPaise * logGstPct / (100 + logGstPct)) : 0;
    setLogSaving(true);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: logProjId, category: logCat,
          amountPaise: amtPaise, gstPct: logGstPct, gstAmountPaise: gstAmtPaise,
          description: logDesc.trim() || undefined,
          vendorName: logVendor.trim() || undefined,
        }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed');
      setLogOpen(false); fetchExpenses();
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Failed');
    } finally { setLogSaving(false); }
  }

  const filtered = catFilter ? rows.filter(r => r.category === catFilter) : rows;
  const totalPaise = filtered.reduce((s, r) => s + r.amountPaise, 0);

  return (
    <div className="space-y-5">
      {/* Log Expense modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !logSaving && setLogOpen(false)} />
          <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Log Expense</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>Record a project expense or overhead</p>
              </div>
              <button onClick={() => !logSaving && setLogOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Project *</label>
                {logProjLd ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p> : (
                  <select value={logProjId} onChange={e => setLogProjId(e.target.value)} className={inputCls}>
                    <option value="">Select a project…</option>
                    {logProjList.map(p => {
                      const c = p.customerFullName ?? p.leadContactName ?? null;
                      return <option key={p.id} value={p.id}>{p.name}{c ? ` — ${c}` : ''}</option>;
                    })}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Category *</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {EXP_CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setLogCat(c)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold transition-all"
                      style={{
                        borderColor: logCat === c ? 'var(--accent-base)' : 'var(--border-subtle)',
                        background:  logCat === c ? 'var(--accent-soft)' : 'var(--surface-card)',
                        color:       logCat === c ? 'var(--accent-base)' : 'var(--text-secondary)',
                      }}>
                      {EXP_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount incl. GST (₹) *</label>
                  <input type="number" min="0.01" step="0.01" value={logAmount}
                    onChange={e => setLogAmount(e.target.value)} className={inputCls} placeholder="e.g. 5000" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>GST rate</label>
                  <select value={logGstPct} onChange={e => setLogGstPct(Number(e.target.value))} className={inputCls}>
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Vendor / paid to</label>
                <input type="text" value={logVendor} onChange={e => setLogVendor(e.target.value)}
                  className={inputCls} placeholder="Vendor name or payee" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Description</label>
                <input type="text" value={logDesc} onChange={e => setLogDesc(e.target.value)}
                  className={inputCls} placeholder="Brief description of the expense" />
              </div>
              {logError && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{logError}</p>}
            </div>
            <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <button onClick={() => !logSaving && setLogOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--surface-card)]"
                style={{ color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={submitLogExp} disabled={logSaving || !logProjId}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-40">
                {logSaving ? 'Saving…' : <><Check className="h-3.5 w-3.5" strokeWidth={2.25} />Log Expense</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total expenses" value={formatRupees(totalPaise)} icon={Receipt} iconBg="#FEF3CD" iconColor="#D97706" />
          <StatCard label="Entries" value={String(filtered.length)} icon={FileText} iconBg="var(--surface-muted)" iconColor="var(--text-tertiary)" />
        </div>
        <div className="flex items-center gap-3">
          <select value={catFilter} onChange={e => setCat(e.target.value)}
            className="h-9 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-heading)' }}>
            <option value="">All categories</option>
            {EXP_CATEGORIES.map(c => <option key={c} value={c}>{EXP_LABEL[c]}</option>)}
          </select>
          <button onClick={openLogExp} className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px] shrink-0">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />Add Expense
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
          <Receipt className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No expenses yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date','Category','Description','Amount','Receipt'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-[var(--surface-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                        {EXP_LABEL[e.category] ?? e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{e.description ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(e.amountPaise)}</td>
                    <td className="px-4 py-3">
                      {e.receiptUrl
                        ? <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent-base)' }}><Download className="h-3.5 w-3.5" /> View</a>
                        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vendor Payables Tab ───────────────────────────────────────────────────────

function VendorPayablesTab() {
  const [rows, setRows]       = useState<VendorPayable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/finance/vendor-payables').then(r => r.json())
      .then(b => setRows((b.data ?? []) as VendorPayable[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalNetPaise = rows.reduce((s, r) => s + r.netPayablePaise, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total net payable" value={formatRupees(totalNetPaise)} icon={Truck} iconBg="#FEF3CD" iconColor="#D97706" />
        <StatCard label="Vendors" value={String(rows.length)} icon={IndianRupee} iconBg="var(--surface-muted)" iconColor="var(--text-tertiary)" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
          <Truck className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No open purchase orders</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Vendor','POs','Ordered value','Advance paid','Net payable'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide${i >= 2 ? ' text-right' : ''}`} style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.vendorId} className="hover:bg-[var(--surface-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-heading)' }}>
                      <Link href="/vendors" className="hover:underline">{r.vendorName}</Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>{r.poCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>{formatRupees(r.totalOrderedPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: 'var(--text-secondary)' }}>{formatRupees(r.advancePaidPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: r.netPayablePaise > 0 ? '#D97706' : 'var(--text-heading)' }}>
                      {formatRupees(r.netPayablePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared stat card ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string; iconColor: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3.5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: iconBg }}>
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: valueColor ?? 'var(--text-heading)' }}>{value}</p>
        {sub && <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [activeTab, setTab] = useState<Tab>('invoices');

  return (
    <div className="space-y-0">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-8 py-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">Invoices · Payments · Expenses · Vendor payables</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0 overflow-x-auto border-b px-8" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                borderBottomColor: active ? 'var(--accent-base)' : 'transparent',
                color: active ? 'var(--accent-base)' : 'var(--text-secondary)',
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'invoices'        && <InvoicesTab />}
        {activeTab === 'payments'        && <PaymentsTab />}
        {activeTab === 'expenses'        && <ExpensesTab />}
        {activeTab === 'vendor_payables' && <VendorPayablesTab />}
      </div>
    </div>
  );
}
