'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FileText, IndianRupee, MessageCircle, Plus } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { dmy } from '@/components/civil/format';
import { MILESTONE_STATUS_LABEL, STAGE_LABEL, type MoneyMilestone, type ProjectMoney } from '@/components/money/types';
import { MODE_LABEL, waLink, type ProjectPayment } from './util';

/** The fields of a project invoice this box shows. */
export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  paidPaise: number;
}

type Tab = 'schedule' | 'received' | 'invoices';

const STATUS_STYLE: Record<MoneyMilestone['status'], { bg: string; color: string; dot: string }> = {
  paid:      { bg: 'var(--success-soft)',  color: 'var(--success-text)',   dot: 'var(--success)' },
  part_paid: { bg: 'var(--warning-soft)',  color: 'var(--warning-text)',   dot: 'var(--warning)' },
  overdue:   { bg: 'var(--danger-soft)',   color: 'var(--danger-text)',    dot: 'var(--danger)' },
  due:       { bg: 'var(--warning-soft)',  color: 'var(--warning-text)',   dot: 'var(--warning)' },
  upcoming:  { bg: 'var(--surface-muted)', color: 'var(--text-secondary)', dot: 'var(--border-strong)' },
};

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  issued:    { label: 'Issued',    bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
  part_paid: { label: 'Part paid', bg: 'var(--warning-soft)',  color: 'var(--warning-text)' },
  paid:      { label: 'Paid',      bg: 'var(--success-soft)',  color: 'var(--success-text)' },
  void:      { label: 'Void',      bg: 'var(--surface-muted)', color: 'var(--text-tertiary)' },
};

interface Props {
  money: ProjectMoney;
  payments: ProjectPayment[];
  invoices: InvoiceRow[];
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientPhone: string | null;
  onRecord: () => void;
  onCreateInvoice: () => void;
  onPayInvoice: (inv: { id: string; invoiceNumber: string; outstandingPaise: number }) => void;
}

export function PaymentsBox(p: Props) {
  const [tab, setTab] = useState<Tab>('schedule');
  const settled = p.payments.filter(x => x.status !== 'pending');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'received', label: `Received${settled.length ? ` · ${settled.length}` : ''}` },
    { key: 'invoices', label: `Invoices${p.invoices.length ? ` · ${p.invoices.length}` : ''}` },
  ];

  return (
    <section className="rounded-2xl border" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Payments</h2>
        <div role="tablist" className="flex gap-1 rounded-xl p-1 text-xs font-semibold" style={{ background: 'var(--surface-muted)' }}>
          {tabs.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className="rounded-lg px-3 py-1.5 transition-colors"
              style={tab === t.key
                ? { background: 'var(--surface-card)', color: 'var(--text-heading)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                : { color: 'var(--text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-4 pt-2">
        {tab === 'schedule' && <Schedule {...p} />}
        {tab === 'received' && <Received payments={settled} onRecord={p.onRecord} />}
        {tab === 'invoices' && <Invoices {...p} />}
      </div>
    </section>
  );
}

/* ── Schedule: milestones as a timeline ─────────────────────────────────────── */

function Schedule(p: Props) {
  const ms = p.money.milestones;
  if (!ms.length) {
    return (
      <Empty icon={IndianRupee} text="No payment milestones yet"
        sub={p.money.contract.contractPaise ? 'Add milestones in the money page to know what the client owes when.' : 'Set the contract value and milestones first.'}
        action={<Link href={`/projects/${p.projectId}/money`} className="text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>Open money page →</Link>} />
    );
  }
  return (
    <ol className="relative mt-1 pl-6">
      <span aria-hidden className="absolute bottom-3 left-[9px] top-3 w-0.5" style={{ background: 'var(--border-subtle)' }} />
      {ms.map((m, i) => {
        const st = STATUS_STYLE[m.status];
        const unpaidDue = m.isDue && m.balancePaise > 0;
        const dueText = m.status === 'paid'
          ? `${m.dueDate ? dmy(m.dueDate) : ''} · fully paid`
          : m.receivedPaise > 0
            ? `${m.dueDate ? `due ${dmy(m.dueDate)} · ` : ''}${formatRupees(m.receivedPaise)} received, ${formatRupees(m.balancePaise)} left`
            : m.dueOn ? `${m.isDue ? 'due' : 'falls due'} ${dmy(m.dueOn)}`
            : m.triggerStage ? (m.isDue && m.dueDate ? `due since ${dmy(m.dueDate)}` : `falls due at ${STAGE_LABEL[m.triggerStage].toLowerCase()}`)
            : m.dueDate ? `due ${dmy(m.dueDate)}` : '';
        const reminder = `Hello ${p.clientName ?? ''}, a gentle reminder from Konst Design: ${m.label} for ${p.projectName} — ${formatRupees(m.balancePaise)} is pending. Thank you!`;
        return (
          <li key={m.id} className="relative py-3" style={{ borderBottom: i < ms.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span aria-hidden className="absolute -left-[21px] top-[18px] h-3.5 w-3.5 rounded-full"
              style={{ background: st.dot, boxShadow: '0 0 0 3px var(--surface-card)' }} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{m.label}</span>
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.pctOfTotal}%</span>
                </p>
                <p className="text-xs" style={{ color: m.status === 'overdue' ? 'var(--danger-text)' : 'var(--text-tertiary)' }}>{dueText}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(m.totalPaise)}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>
                  {m.status === 'overdue' ? `Overdue ${m.daysOverdue}d` : MILESTONE_STATUS_LABEL[m.status]}
                </span>
                {unpaidDue && p.clientPhone && (
                  <a href={waLink(p.clientPhone, reminder)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                    style={{ borderColor: 'var(--border-strong)', color: 'var(--text-heading)' }}>
                    <MessageCircle className="h-3 w-3" />Remind
                  </a>
                )}
                {unpaidDue && (
                  <button type="button" onClick={p.onRecord}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ background: 'var(--accent-base)' }}>
                    <IndianRupee className="h-3 w-3" />Record
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Received: every payment, with its receipt ─────────────────────────────── */

function Received({ payments, onRecord }: { payments: ProjectPayment[]; onRecord: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function receipt(id: string) {
    setBusy(id); setError(null);
    try {
      const res = await fetch(`/api/v1/payments/${id}/receipt`, { method: 'POST' });
      const j = (await res.json()) as { data?: { pdfUrl?: string }; error?: string };
      if (!res.ok || !j.data?.pdfUrl) { setError(j.error ?? 'Could not make the receipt.'); return; }
      window.open(j.data.pdfUrl, '_blank', 'noopener');
    } catch { setError('Network error.'); }
    finally { setBusy(null); }
  }

  if (!payments.length) {
    return <Empty icon={IndianRupee} text="No payments received yet"
      action={<button type="button" onClick={onRecord} className="text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>Record a payment →</button>} />;
  }
  return (
    <div className="mt-1">
      {error && <p className="mb-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>{error}</p>}
      <ul>
        {payments.map((x, i) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--success-text)' }}>{formatRupees(Number(x.amountPaise))}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {dmy(x.receivedAt ?? x.createdAt)} · {MODE_LABEL[x.mode ?? ''] ?? 'Payment'}{x.reference ? ` · ${x.reference}` : ''}{x.receiptNumber ? ` · ${x.receiptNumber}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => void receipt(x.id)} disabled={busy === x.id}
              className="inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-50" style={{ color: 'var(--accent-base)' }}>
              <Download className="h-3.5 w-3.5" />{busy === x.id ? 'Making…' : 'Receipt'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Invoices ───────────────────────────────────────────────────────────────── */

function Invoices(p: Props) {
  if (!p.invoices.length) {
    return <Empty icon={FileText} text="No invoices yet"
      action={<button type="button" onClick={p.onCreateInvoice} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--accent-base)' }}><Plus className="h-3.5 w-3.5" />Create invoice</button>} />;
  }
  return (
    <div className="mt-1">
      <ul>
        {p.invoices.map((inv, i) => {
          const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
          const outstanding = Math.max(0, total - (inv.paidPaise ?? 0));
          const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft;
          return (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              style={{ borderBottom: i < p.invoices.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div>
                <Link href={`/invoices/${inv.id}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>{inv.invoiceNumber}</Link>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{dmy(inv.invoiceDate)} · paid {formatRupees(inv.paidPaise ?? 0)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(total)}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {inv.status !== 'void' && outstanding > 0 && (
                  <button type="button" onClick={() => p.onPayInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber, outstandingPaise: outstanding })}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                    <IndianRupee className="h-3 w-3" />Pay
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between text-xs">
        <button type="button" onClick={p.onCreateInvoice} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--accent-base)' }}>
          <Plus className="h-3.5 w-3.5" />New invoice
        </button>
        <Link href={`/invoices?projectId=${p.projectId}`} className="font-semibold" style={{ color: 'var(--text-secondary)' }}>All invoices →</Link>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text, sub, action }: { icon: React.ElementType; text: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <Icon className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{text}</p>
      {sub && <p className="max-w-xs text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      {action}
    </div>
  );
}
