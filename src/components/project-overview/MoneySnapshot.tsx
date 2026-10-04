'use client';

import Link from 'next/link';
import { ArrowRight, Lock, Wallet } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { ProjectMoney } from '@/components/money/types';

/**
 * One card for the project's money: contract incl. GST, received, outstanding,
 * real cost and (owner only) profit, plus one bar showing how the contract is
 * splitting into received / overdue / due / not yet due.
 */
export function MoneySnapshot({ money, projectId, isOwner, onSetContract }: {
  money: ProjectMoney; projectId: string; isOwner: boolean; onSetContract: () => void;
}) {
  const c = money.contract;
  const b = money.billing;

  if (!c.contractPaise) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No contract value set</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isOwner ? 'Set it to see payments due, costs and profit for this project.' : 'The owner sets the contract value; money tracking starts after that.'}
            </p>
          </div>
        </div>
        {isOwner && (
          <button type="button" onClick={onSetContract} className="btn-primary px-4 py-2 text-sm">Set contract value</button>
        )}
      </div>
    );
  }

  const total = Math.max(1, c.totalWithGstPaise);
  const received = Math.min(b.receivedPaise, total);
  const overdue = Math.min(b.overduePaise, total - received);
  const due = Math.min(Math.max(0, b.duePaise - b.receivedPaise - b.overduePaise), total - received - overdue);
  const later = Math.max(0, total - received - overdue - due);
  const pct = (v: number) => Math.round((v / total) * 100);

  const segments = [
    { key: 'received', label: 'Received', value: received, color: 'var(--accent-base)' },
    { key: 'overdue', label: 'Overdue', value: overdue, color: 'var(--danger)' },
    { key: 'due', label: 'Due', value: due, color: 'var(--warning)' },
  ];

  const profit = money.profit;
  const cols = profit ? 'lg:grid-cols-[1.5fr_repeat(4,1fr)]' : 'lg:grid-cols-[1.5fr_repeat(3,1fr)]';

  return (
    <section className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>Money</p>
        <Link href={`/projects/${projectId}/money`} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: 'var(--accent-base)' }}>
          Full money details<ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-x-5 gap-y-4 ${cols} lg:items-end`}>
        <div className="col-span-2 lg:col-span-1">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Contract incl. GST</p>
          <p className="text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(c.totalWithGstPaise)}</p>
          <p className="text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
            {formatRupees(c.revisedPaise)} + {money.project.gstPct}% GST{c.additionsPaise > 0 ? ` · incl. ${formatRupees(c.additionsPaise)} additions` : ''}
          </p>
        </div>
        <Figure label="Received" value={formatRupees(b.receivedPaise)} sub={`${money.duration.collectedPct ?? 0}% collected`} color="var(--success-text)" />
        <Figure label="Outstanding" value={formatRupees(b.outstandingPaise)}
          sub={b.overduePaise > 0 ? `${formatRupees(b.overduePaise)} overdue` : b.outstandingPaise > 0 ? 'nothing overdue' : 'all due paid'}
          color={b.outstandingPaise > 0 ? 'var(--danger-text)' : 'var(--text-heading)'} subColor={b.overduePaise > 0 ? 'var(--danger-text)' : undefined} />
        <Figure label="Real cost" value={formatRupees(money.costs.totalPaise)}
          sub={money.costs.committedPaise > 0 ? `+ ${formatRupees(money.costs.committedPaise)} open POs` : 'no open POs'} />
        {profit && (
          <Figure label={<span className="inline-flex items-center gap-1">Profit <Lock className="h-3 w-3" /></span>}
            value={formatRupees(profit.profitPaise)}
            sub={profit.marginPct === null ? 'owner only' : `${profit.marginPct}% · owner only`}
            color={profit.profitPaise < 0 ? 'var(--danger-text)' : 'var(--success-text)'} />
        )}
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}
        role="img" aria-label={`Received ${pct(received)}%, overdue ${pct(overdue)}%, due ${pct(due)}%, not due yet ${pct(later)}%`}>
        {segments.map(s => s.value > 0 && <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {segments.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label} {pct(s.value)}%
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: 'var(--border-strong)' }} />Not due yet {pct(later)}%
        </span>
      </div>
    </section>
  );
}

function Figure({ label, value, sub, color, subColor }: {
  label: React.ReactNode; value: string; sub: string; color?: string; subColor?: string;
}) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: color ?? 'var(--text-heading)' }}>{value}</p>
      <p className="text-[11.5px]" style={{ color: subColor ?? 'var(--text-tertiary)' }}>{sub}</p>
    </div>
  );
}
