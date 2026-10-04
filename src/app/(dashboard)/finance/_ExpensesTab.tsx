'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Building2, Plus, Receipt, Search, TrendingDown, X } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { istToday } from '@/lib/dates/ist';
import { responseError, NETWORK_ERROR } from '@/lib/client-feedback';
import {
  filterSpend, spendTotals, spendVendorKey,
  type SpendRow, type SpendSource,
} from '@/lib/finance/spend';

// Accounts → Expenses: every expense, vendor bill and unbilled PO balance,
// on the same basis as each project's Money page.

interface ProjectOption { id: string; name: string }
interface VendorOption { id: string; name: string }
interface PoOption {
  id: string; poNumber: string; projectId: string; vendorId: string | null;
  vendorName: string | null; totalPaise: number;
}
interface SpendResponse {
  rows: SpendRow[];
  options: { projects: ProjectOption[]; vendors: VendorOption[]; purchaseOrders: PoOption[] };
}

const CATEGORIES = ['material', 'labour', 'transport', 'petty_cash', 'other'] as const;
const CAT_LABEL: Record<string, string> = {
  petty_cash: 'Petty Cash', transport: 'Transport', labour: 'Labour', material: 'Material', other: 'Other',
};
const CAT_DOT: Record<string, string> = {
  petty_cash: 'bg-orange-500', transport: 'bg-blue-500', labour: 'bg-emerald-500',
  material: 'bg-violet-500', other: 'bg-slate-400',
};
const SOURCE_LABEL: Record<SpendSource, string> = { expense: 'Expense', vendor_bill: 'Vendor bill', po: 'PO' };
const SOURCE_BADGE: Record<SpendSource, string> = {
  expense: 'bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  vendor_bill: 'bg-[var(--accent-base)]/10 text-[var(--accent-base)]',
  po: 'bg-[var(--warning-soft)] text-[var(--warning)]',
};
const GST_RATES = [0, 5, 12, 18, 28] as const;

const INPUT = 'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5 text-[13px] text-[var(--text-heading)] outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30';
const TH = 'px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap text-[var(--text-tertiary)]';
const TD = 'px-4 py-3.5 align-top';

function fmtDay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function rowHref(r: SpendRow) {
  if (r.source === 'vendor_bill') return `/vendor-bills/${r.id}`;
  if (r.source === 'po') return `/purchase-orders/${r.id}`;
  return `/expenses/${r.id}`;
}

function rupeesToPaise(v: string): number | null {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// ─── New expense ──────────────────────────────────────────────────────────────

function NewExpenseModal({ options, onClose, onSaved }: {
  options: SpendResponse['options']; onClose: () => void; onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [poId, setPoId]           = useState('');
  const [vendorId, setVendorId]   = useState('');
  const [payee, setPayee]         = useState('');
  const [category, setCategory]   = useState<string>('material');
  const [base, setBase]           = useState('');
  const [gstPct, setGstPct]       = useState(0);
  const [description, setDesc]    = useState('');
  const [paidNow, setPaidNow]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const projectPos = options.purchaseOrders.filter(po => po.projectId === projectId);
  const po = projectPos.find(p => p.id === poId);
  const basePaise = rupeesToPaise(base);
  const gstPaise = basePaise ? Math.round((basePaise * gstPct) / 100) : 0;

  function pickProject(id: string) {
    setProjectId(id);
    setPoId('');
  }
  function pickPo(id: string) {
    setPoId(id);
    const picked = options.purchaseOrders.find(p => p.id === id);
    if (picked) {
      if (picked.vendorId) setVendorId(picked.vendorId);
      setCategory('material');
    }
  }

  async function save() {
    if (!projectId) { setError('Pick the project this expense belongs to.'); return; }
    if (!basePaise) { setError('Enter the amount.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          poId: poId || undefined,
          vendorId: vendorId || undefined,
          vendorName: !vendorId && payee.trim() ? payee.trim() : undefined,
          category,
          amountPaise: basePaise + gstPaise,
          gstPct,
          gstAmountPaise: gstPaise,
          description: description.trim() || undefined,
          paidAt: paidNow ? new Date().toISOString() : undefined,
        }),
      });
      if (!res.ok) { setError(await responseError(res, 'Could not save the expense.')); return; }
      onSaved();
      onClose();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="text-base font-bold text-[var(--text-heading)]">New expense</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">Project *</span>
            <select value={projectId} onChange={e => pickProject(e.target.value)} className={INPUT}>
              <option value="">Select project…</option>
              {options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Against purchase order <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
            </span>
            <select value={poId} onChange={e => pickPo(e.target.value)} className={INPUT} disabled={!projectId}>
              <option value="">{projectId ? (projectPos.length ? 'No PO' : 'No open POs on this project') : 'Pick a project first'}</option>
              {projectPos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.poNumber}{p.vendorName ? ` · ${p.vendorName}` : ''} · {formatRupees(p.totalPaise)}
                </option>
              ))}
            </select>
            {po && (
              <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">
                Saved as a vendor bill on {po.poNumber} — it reduces what is still committed on the PO.
              </span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">Vendor</span>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={INPUT}
                disabled={!!po?.vendorId}>
                <option value="">Not a listed vendor</option>
                {options.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            {!vendorId && (
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">Paid to</span>
                <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. auto driver, staff" className={INPUT} />
              </label>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">Category</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c
                      ? 'border-[var(--accent-base)] bg-[var(--accent-base)]/10 text-[var(--text-heading)]'
                      : 'border-transparent bg-[var(--surface-muted)] text-[var(--text-secondary)]'}`}>
                  <span className={`h-2 w-2 rounded-full ${CAT_DOT[c]}`} />{CAT_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">Amount excl. GST (₹) *</span>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={base}
                onChange={e => setBase(e.target.value)} placeholder="0.00" className={INPUT} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">GST</span>
              <select value={gstPct} onChange={e => setGstPct(Number(e.target.value))} className={INPUT}>
                {GST_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'No GST' : `${r}%`}</option>)}
              </select>
            </label>
          </div>
          {basePaise ? (
            <p className="text-[12px] text-[var(--text-secondary)]">
              Total <span className="font-semibold text-[var(--text-heading)]">{formatRupees(basePaise + gstPaise)}</span>
              {gstPaise > 0 && <> (incl. {formatRupees(gstPaise)} GST)</>}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Description <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
            </span>
            <input value={description} onChange={e => setDesc(e.target.value)} placeholder="What was it for?" className={INPUT} />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={paidNow} onChange={e => setPaidNow(e.target.checked)} />
            Already paid
          </label>

          {error && <p className="text-sm font-medium text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !projectId || !basePaise}
            className="btn-primary flex-1 py-2.5 text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

function Card({ label, value, sub, icon: Icon, danger }: {
  label: string; value: string; sub?: string; icon: React.ElementType; danger?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      {danger && <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--danger)]" />}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
          <Icon className={`h-4 w-4 ${danger ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'}`} />
        </div>
      </div>
      <p className={`truncate text-2xl font-bold tabular-nums ${danger ? 'text-[var(--danger)]' : 'text-[var(--text-heading)]'}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-tertiary)]">{sub}</p>}
    </div>
  );
}

function PayBadge({ r }: { r: SpendRow }) {
  if (r.source === 'po') {
    return (
      <span className="text-[12px] text-[var(--text-tertiary)]">
        Committed{r.paidPaise > 0 && <><br />{formatRupees(r.paidPaise)} advance</>}
      </span>
    );
  }
  const cls = r.payStatus === 'paid' ? 'text-[var(--success)]' : r.payStatus === 'partial' ? 'text-[var(--warning)]' : 'text-[var(--danger)]';
  const label = r.payStatus === 'paid' ? 'Paid' : r.payStatus === 'partial' ? 'Part paid' : 'Unpaid';
  return (
    <span className={`text-[12px] font-semibold ${cls}`}>
      {label}
      {r.payStatus === 'partial' && <span className="block font-normal text-[var(--text-tertiary)]">{formatRupees(r.amountPaise - r.paidPaise)} due</span>}
    </span>
  );
}

async function fetchSpend(): Promise<{ data: SpendResponse } | { error: string }> {
  try {
    const res = await fetch('/api/v1/finance/spend');
    if (!res.ok) return { error: await responseError(res, 'Could not load expenses.') };
    const body = await res.json() as { data: SpendResponse };
    return { data: body.data };
  } catch {
    return { error: NETWORK_ERROR };
  }
}

export function ExpensesTab() {
  const router = useRouter();
  const [data, setData]       = useState<SpendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [search, setSearch]     = useState('');
  const [projectId, setProject] = useState('');
  const [vendor, setVendor]     = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource]     = useState<SpendSource | ''>('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');

  const apply = useCallback((r: { data: SpendResponse } | { error: string }) => {
    if ('data' in r) { setData(r.data); setError(null); } else setError(r.error);
    setLoading(false);
  }, []);
  const load = useCallback(() => { void fetchSpend().then(apply); }, [apply]);

  useEffect(() => { void fetchSpend().then(apply); }, [apply]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const vendorOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const k = spendVendorKey(r);
      if (k && r.vendorName) m.set(k, r.vendorName);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => filterSpend(rows, {
    projectId: projectId || null, vendor: vendor || null, category: category || null,
    source: source || null, from: from || null, to: to || null, search,
  }), [rows, projectId, vendor, category, source, from, to, search]);
  const totals = useMemo(() => spendTotals(filtered, istToday()), [filtered]);
  const anyFilter = !!(search || projectId || vendor || category || source || from || to);

  function clearFilters() {
    setSearch(''); setProject(''); setVendor(''); setCategory(''); setSource(''); setFrom(''); setTo('');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-secondary)]">
          <span className="font-semibold tabular-nums">{totals.bookedCount}</span> entries
          {' · '}<span className="font-semibold tabular-nums">{formatRupees(totals.totalPaise)}</span> booked
          {totals.committedPaise > 0 && (
            <> · <span className="font-semibold tabular-nums">{formatRupees(totals.committedPaise)}</span> on POs not billed yet</>
          )}
        </p>
        <button type="button" onClick={() => setShowNew(true)} disabled={!data}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--text-heading)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-app)] disabled:opacity-60">
          <Plus className="h-3.5 w-3.5" />New expense
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Total spend" value={formatRupees(totals.totalPaise)} icon={TrendingDown} danger
          sub={`incl. GST · ${formatRupees(totals.totalNetPaise)} excl. GST`} />
        <Card label="This month" value={formatRupees(totals.thisMonthPaise)} icon={Receipt}
          sub={totals.unpaidPaise > 0 ? `${formatRupees(totals.unpaidPaise)} unpaid overall` : undefined} />
        <Card label="Top category" value={totals.topCategory ? CAT_LABEL[totals.topCategory.category] ?? totals.topCategory.category : '—'}
          sub={totals.topCategory ? formatRupees(totals.topCategory.amountPaise) : undefined} icon={BarChart3} />
        <Card label="Vendors" value={String(totals.vendorCount)} sub="paid or ordered from" icon={Building2} />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search description, vendor, project or number…" className={`${INPUT} pl-9`} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select value={projectId} onChange={e => setProject(e.target.value)} className={INPUT} aria-label="Project">
            <option value="">All projects</option>
            {(data?.options.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={vendor} onChange={e => setVendor(e.target.value)} className={INPUT} aria-label="Vendor">
            <option value="">All vendors</option>
            {vendorOptions.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className={INPUT} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <select value={source} onChange={e => setSource(e.target.value as SpendSource | '')} className={INPUT} aria-label="Source">
            <option value="">All sources</option>
            <option value="expense">Expenses</option>
            <option value="vendor_bill">Vendor bills</option>
            <option value="po">POs not billed</option>
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={INPUT} aria-label="From date" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={INPUT} aria-label="To date" />
        </div>
        {anyFilter && (
          <button type="button" onClick={clearFilters} className="text-[12px] font-semibold text-[var(--accent-base)]">
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}
            </div>
          ) : error ? (
            <p className="rounded-xl border border-[var(--border-subtle)] p-4 text-sm text-[var(--danger)]">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Receipt className="h-7 w-7 text-[var(--text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {rows.length ? 'Nothing matches these filters' : 'No spend recorded yet'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Expenses logged on a project, vendor bills and purchase orders show up here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                    <th className={`${TH} text-left`}>Date</th>
                    <th className={`${TH} text-left`}>Description</th>
                    <th className={`${TH} text-left`}>Project</th>
                    <th className={`${TH} text-left`}>Vendor</th>
                    <th className={`${TH} text-left`}>Category</th>
                    <th className={`${TH} text-left`}>Source</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={`${TH} text-right`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.key} onClick={() => router.push(rowHref(r))}
                      className="cursor-pointer border-b border-[var(--border-subtle)] bg-[var(--surface-card)] last:border-b-0 hover:bg-[var(--surface-muted)]">
                      <td className={`${TD} whitespace-nowrap text-[var(--text-secondary)]`}>{fmtDay(r.date)}</td>
                      <td className={`${TD} max-w-[240px]`}>
                        <span className="line-clamp-1 font-medium text-[var(--text-heading)]">{r.description}</span>
                        {r.ref && <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{r.ref}</span>}
                      </td>
                      <td className={TD} onClick={e => e.stopPropagation()}>
                        <Link href={`/projects/${r.projectId}`} className="font-medium text-[var(--accent-base)] hover:underline">
                          {r.projectName ?? 'Project'}
                        </Link>
                      </td>
                      <td className={`${TD} text-[var(--text-secondary)]`}>{r.vendorName ?? '—'}</td>
                      <td className={TD}>
                        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${CAT_DOT[r.category] ?? 'bg-slate-400'}`} />
                          {CAT_LABEL[r.category] ?? r.category}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE[r.source]}`}>
                          {SOURCE_LABEL[r.source]}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <p className={`font-bold tabular-nums ${r.booked ? 'text-[var(--text-heading)]' : 'text-[var(--text-tertiary)]'}`}>
                          {formatRupees(r.amountPaise)}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-[11px] text-[var(--text-tertiary)]">
                          {r.source === 'po' ? 'not billed · excl. GST' : r.gstPaise > 0 ? `incl. ${formatRupees(r.gstPaise)} GST` : 'no GST'}
                        </p>
                      </td>
                      <td className={`${TD} text-right`}><PayBadge r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totals.byCategory.length > 0 && (
          <div className="w-full shrink-0 lg:w-52">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <p className="mb-4 text-[13px] font-bold text-[var(--text-heading)]">By category</p>
              <div className="space-y-4">
                {totals.byCategory.map(c => {
                  const pct = totals.totalPaise > 0 ? Math.round((c.amountPaise / totals.totalPaise) * 100) : 0;
                  return (
                    <div key={c.category}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-[var(--text-heading)]">{CAT_LABEL[c.category] ?? c.category}</p>
                        <p className="text-[13px] font-bold tabular-nums text-[var(--text-heading)]">{formatRupees(c.amountPaise)}</p>
                      </div>
                      <progress value={pct} max={100} aria-label={`${pct}% of total`}
                        className="h-1 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[var(--accent-base)] [&::-webkit-progress-bar]:bg-[var(--surface-muted)] [&::-webkit-progress-value]:bg-[var(--accent-base)]" />
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{pct}% of booked</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
                Booked spend excl. GST is what each project&apos;s Money page counts as cost (before staff time).
              </p>
            </div>
          </div>
        )}
      </div>

      {showNew && data && (
        <NewExpenseModal options={data.options} onClose={() => setShowNew(false)} onSaved={() => { void load(); }} />
      )}
    </div>
  );
}
