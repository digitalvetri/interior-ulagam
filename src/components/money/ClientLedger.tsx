'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Download, FileSpreadsheet, IndianRupee, MessageCircle, Plus, Receipt, Wallet,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { StatCard } from '@/components/ui/StatCard';
import { formatRupees } from '@/lib/utils';
import { Field } from '@/components/civil/StatusActionDialog';
import { apiError, dmy, inputToPaise, todayIso } from '@/components/civil/format';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import type { CustomerLedger, LedgerKind } from './types';

const KIND_STYLE: Record<LedgerKind, { label: string; bg: string; color: string }> = {
  due: { label: 'Due', bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
  payment: { label: 'Paid', bg: 'var(--success-soft)', color: 'var(--success-text)' },
  discount: { label: 'Discount', bg: '#E0F2FE', color: '#0369A1' },
  write_off: { label: 'Write-off', bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  refund: { label: 'Refund', bg: 'var(--danger-soft)', color: 'var(--danger-text)' },
};

/** A negative balance means the client has paid ahead. */
function Balance({ paise, bold }: { paise: number; bold?: boolean }) {
  const ahead = paise < 0;
  return (
    <span className={`tabular-nums ${bold ? 'font-bold' : 'font-semibold'}`}
      style={{ color: ahead ? 'var(--success-text)' : paise > 0 ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
      {ahead ? `${formatRupees(-paise)} Cr` : formatRupees(paise)}
    </span>
  );
}

/**
 * The client's running account across all their projects: milestones falling
 * due, payments received, discounts/refunds/write-offs, with a running balance.
 */
export function ClientLedger({ customerId, isOwner, onChanged }: {
  customerId: string; isOwner: boolean;
  /** Called after a payment or adjustment, so the page can refresh its own totals. */
  onChanged?: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<CustomerLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/ledger${projectId ? `?projectId=${projectId}` : ''}`);
      if (!res.ok) { setError(await apiError(res, 'Could not load the ledger.')); return; }
      setError(null);
      setData(((await res.json()) as { data: CustomerLedger }).data);
    } finally { setLoading(false); }
  }, [customerId, projectId]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function openReceipt(paymentId: string) {
    setReceiptBusy(paymentId);
    try {
      const res = await fetch(`/api/v1/payments/${paymentId}/receipt`, { method: 'POST' });
      if (!res.ok) { setError(await apiError(res, 'Could not make the receipt.')); return; }
      const j = (await res.json()) as { data: { pdfUrl: string } };
      window.open(j.data.pdfUrl, '_blank', 'noopener');
    } finally { setReceiptBusy(null); }
  }

  const t = data?.totals;
  const exportBase = `/api/v1/customers/${customerId}/ledger/export?${projectId ? `projectId=${projectId}&` : ''}format=`;
  const digits = (data?.customer.phone ?? '').replace(/\D/g, '').slice(-10);
  const waText = data && t
    ? [
        `Dear ${data.customer.fullName},`,
        `Your account with Konst Design${projectId ? ` (${data.projects.find(p => p.id === projectId)?.name ?? ''})` : ''}:`,
        `Due so far: ${formatRupees(t.duePaise)}`,
        `Received: ${formatRupees(t.receivedPaise)}`,
        t.advancePaise > 0 ? `Advance with us: ${formatRupees(t.advancePaise)}` : `Balance due: ${formatRupees(t.outstandingPaise)}`,
        'Thank you.',
      ].join('\n')
    : '';
  const owedTotal = data?.entries.reduce((s, e) => s + e.owedPaise, 0) ?? 0;
  const paidTotal = data?.entries.reduce((s, e) => s + e.paidPaise, 0) ?? 0;

  return (
    <div className="space-y-4 p-4 sm:p-5" style={{ background: 'var(--surface-card)' }}>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contract (incl. GST)" icon={Receipt}
          value={!t ? '…' : formatRupees(t.contractWithGstPaise)}
          sub={data ? `${data.projects.length} project${data.projects.length !== 1 ? 's' : ''}` : undefined} />
        <StatCard label="Due so far" icon={Wallet} value={!t ? '…' : formatRupees(t.duePaise)} />
        <StatCard label="Received" icon={IndianRupee}
          value={!t ? '…' : <span style={{ color: 'var(--success-text)' }}>{formatRupees(t.receivedPaise)}</span>}
          sub={t && t.adjustmentsPaise !== 0 ? `Adjustments ${formatRupees(t.adjustmentsPaise)}` : undefined} />
        {t && t.advancePaise > 0 ? (
          <StatCard label="Advance with us" icon={Wallet} accent value={formatRupees(t.advancePaise)} sub="Client has paid ahead" />
        ) : (
          <StatCard label="Outstanding" icon={AlertTriangle} accent
            value={!t ? '…' : formatRupees(t.outstandingPaise)}
            sub={t && t.overduePaise > 0 ? `${formatRupees(t.overduePaise)} overdue` : 'Nothing overdue'} />
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="studio-input h-9 text-sm">
          <option value="">All projects</option>
          {(data?.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="flex-1" />
        {digits.length === 10 && data && (
          <a href={`https://wa.me/91${digits}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            <MessageCircle className="h-4 w-4" />WhatsApp statement
          </a>
        )}
        <a href={`${exportBase}pdf`} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
          <Download className="h-4 w-4" />PDF
        </a>
        <a href={`${exportBase}xlsx`} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
          <FileSpreadsheet className="h-4 w-4" />Excel
        </a>
        {isOwner && (
          <button type="button" onClick={() => setAdjOpen(true)} disabled={!data}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />Adjustment
          </button>
        )}
        <button type="button" onClick={() => setPayOpen(true)} disabled={!data}
          className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
          <IndianRupee className="h-4 w-4" />Record payment
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Ledger */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
        {loading && !data ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-3.5 w-20 rounded" /><div className="skeleton h-3.5 flex-1 rounded" /><div className="skeleton h-3.5 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : !data || data.projects.length === 0 ? (
          <Empty title="No projects for this client yet" text="Milestones and payments appear here once a project is set up." />
        ) : data.entries.length === 0 ? (
          <Empty title="Nothing due or paid yet" text="Set the contract and milestones on the project's Money tab, or record a payment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Particulars', 'Project', 'Owed', 'Paid', 'Balance', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-semibold tracking-wide ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e, i) => {
                  const k = KIND_STYLE[e.kind];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{dmy(e.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: k.bg, color: k.color }}>{k.label}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{e.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.projectName ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>
                        {e.owedPaise ? formatRupees(e.owedPaise) : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--success-text)' }}>
                        {e.paidPaise ? formatRupees(e.paidPaise) : ''}
                      </td>
                      <td className="px-4 py-3 text-right"><Balance paise={e.balancePaise} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {e.paymentId && (
                          <button type="button" onClick={() => void openReceipt(e.paymentId!)} disabled={receiptBusy === e.paymentId}
                            className="text-xs font-medium disabled:opacity-50" style={{ color: 'var(--accent-base)' }}>
                            {receiptBusy === e.paymentId ? '…' : 'Receipt ↓'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                    Closing balance{t && t.advancePaise > 0 ? ' — advance with us' : t && t.outstandingPaise > 0 ? ` — ${data.customer.fullName} owes` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(owedTotal)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--success-text)' }}>{formatRupees(paidTotal)}</td>
                  <td className="px-4 py-3 text-right"><Balance paise={owedTotal - paidTotal} bold /></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {data && (
        <RecordPaymentDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onSaved={() => { setPayOpen(false); void load(); onChanged?.(); }}
          projects={data.projects}
          defaultProjectId={projectId || undefined}
          customerId={customerId}
          customerName={data.customer.fullName}
          customerPhone={data.customer.phone}
        />
      )}
      {data && isOwner && (
        <AdjustmentDialog open={adjOpen} customerId={customerId} projects={data.projects} defaultProjectId={projectId}
          onClose={() => setAdjOpen(false)} onSaved={() => { setAdjOpen(false); void load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <Wallet className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
      <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</p>
      <p className="max-w-sm text-xs" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

/* ── Adjustment ─────────────────────────────────────────────────────────────── */

const ADJ_KINDS = [
  { key: 'discount', label: 'Discount', hint: 'Reduces what the client owes' },
  { key: 'refund', label: 'Refund', hint: 'Money paid back to the client — increases the balance' },
  { key: 'write_off', label: 'Write-off', hint: 'Amount you will not collect' },
] as const;

function AdjustmentDialog({ open, customerId, projects, defaultProjectId, onClose, onSaved }: {
  open: boolean; customerId: string; projects: { id: string; name: string }[]; defaultProjectId: string;
  onClose(): void; onSaved(): void;
}) {
  const [kind, setKind] = useState<(typeof ADJ_KINDS)[number]['key']>('discount');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [projectId, setProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setKind('discount'); setAmount(''); setDate(todayIso()); setReason(''); setError(null);
    setProjectId(defaultProjectId || (projects.length === 1 ? projects[0].id : ''));
  }
  if (!open && wasOpen) setWasOpen(false);

  async function save() {
    const amountPaise = inputToPaise(amount);
    if (amountPaise <= 0) { setError('Enter the amount.'); return; }
    if (reason.trim().length < 3) { setError('Give a reason — it stays in the ledger.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/adjustments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, amountPaise, adjDate: date, reason: reason.trim(), projectId: projectId || null }),
      });
      if (!res.ok) { setError(await apiError(res, 'Could not save the adjustment.')); return; }
      onSaved();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add adjustment</DialogTitle></DialogHeader>
        <form className="space-y-4 py-1" onSubmit={e => { e.preventDefault(); void save(); }}>
          <div className="grid grid-cols-3 gap-2">
            {ADJ_KINDS.map(k => {
              const on = kind === k.key;
              return (
                <button key={k.key} type="button" onClick={() => setKind(k.key)}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold transition-colors"
                  style={on
                    ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                    : { background: 'var(--surface-card)', color: 'var(--text-heading)', borderColor: 'var(--border-strong)' }}>
                  {k.label}
                </button>
              );
            })}
          </div>
          <p className="-mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{ADJ_KINDS.find(k => k.key === kind)?.hint}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" required>
              <input autoFocus value={amount} inputMode="decimal" placeholder="0" onChange={e => setAmount(e.target.value)}
                className="studio-input h-9 w-full text-right text-sm tabular-nums" />
            </Field>
            <Field label="Date" required>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="studio-input h-9 w-full text-sm" />
            </Field>
          </div>
          {projects.length > 0 && (
            <Field label="Project">
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="studio-input h-9 w-full text-sm">
                <option value="">Whole account</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Reason" required>
            <textarea value={reason} rows={2} onChange={e => setReason(e.target.value)} placeholder="e.g. Goodwill for delay"
              className="studio-input w-full resize-none text-sm" />
          </Field>
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save adjustment'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
