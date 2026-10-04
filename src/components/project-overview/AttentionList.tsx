'use client';

import Link from 'next/link';
import { AlarmClock, TrendingDown, Hammer, CalendarX, ReceiptText, FileSignature, MessageCircle } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { AttentionItem, AttentionKind } from '@/lib/project-money/health';
import type { ProjectMoney } from '@/components/money/types';
import { waLink } from './util';

interface Props {
  items: AttentionItem[];
  money: ProjectMoney | null;
  projectName: string;
  projectId: string;
  customerId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  isOwner: boolean;
  canChangeStage: boolean;
  timeUsedPct: number | null;
  stagePct: number;
  daysLeft: number | null;
  onSetContract: () => void;
  onChangeStage: () => void;
}

const ICON: Record<AttentionKind, React.ElementType> = {
  overdue: AlarmClock, collection_behind: TrendingDown, work_behind: Hammer,
  late: CalendarX, unbilled_pos: ReceiptText, no_contract: FileSignature,
};

const TONE = {
  danger:  { bg: 'var(--danger-soft)',  border: 'color-mix(in srgb, var(--danger) 25%, transparent)',  title: 'var(--danger-text)' },
  warning: { bg: 'var(--warning-soft)', border: 'color-mix(in srgb, var(--warning) 30%, transparent)', title: 'var(--warning-text)' },
  neutral: { bg: 'var(--surface-card)', border: 'var(--border-subtle)', title: 'var(--text-heading)' },
};

/** Up to three things worth doing today, each ending in one action. Hidden when nothing needs doing. */
export function AttentionList(p: Props) {
  if (!p.items.length) return null;

  const worst = p.money?.milestones.filter(m => m.status === 'overdue').sort((a, b) => b.daysOverdue - a.daysOverdue)[0] ?? null;
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85';
  const primary = { background: 'var(--accent-base)', color: '#fff' };
  const secondary = { background: 'var(--surface-card)', color: 'var(--text-heading)', border: '1px solid var(--border-strong)' };
  const moneyHref = `/projects/${p.projectId}/money`;

  function render(item: AttentionItem): { title: string; detail: string; action: React.ReactNode } {
    const m = p.money;
    switch (item.kind) {
      case 'overdue': {
        const amount = m?.billing.overduePaise ?? 0;
        const text = `Hello ${p.clientName ?? ''}, a gentle reminder from Konst Design: ${worst?.label ?? 'a payment'} for ${p.projectName} — ${formatRupees(worst?.balancePaise ?? amount)} is pending. Thank you!`;
        return {
          title: `${formatRupees(amount)} overdue${worst ? ` ${worst.daysOverdue} days` : ''}`,
          detail: worst ? `${worst.label} milestone` : 'Milestones past their due date',
          action: p.clientPhone
            ? <a href={waLink(p.clientPhone, text)} target="_blank" rel="noopener noreferrer" className={btn} style={primary}><MessageCircle className="h-3.5 w-3.5" />Send WhatsApp reminder</a>
            : <Link href={moneyHref} className={btn} style={primary}>Open money page</Link>,
        };
      }
      case 'collection_behind':
        return {
          title: 'Collection behind time',
          detail: `${p.timeUsedPct ?? 0}% of time used, ${m?.duration.collectedPct ?? 0}% collected`,
          action: <Link href={p.customerId ? `/customers/${p.customerId}` : moneyHref} className={btn} style={secondary}>Open client ledger</Link>,
        };
      case 'work_behind':
        return {
          title: 'Work behind time',
          detail: `${p.timeUsedPct ?? 0}% of time used, stage at ${p.stagePct}%`,
          action: p.canChangeStage ? <button type="button" onClick={p.onChangeStage} className={btn} style={secondary}>Change stage</button> : null,
        };
      case 'late':
        return {
          title: `${Math.abs(p.daysLeft ?? 0)} days past handover`,
          detail: 'The planned handover date has passed',
          action: p.isOwner
            ? <button type="button" onClick={p.onSetContract} className={btn} style={secondary}>Update handover date</button>
            : <Link href={moneyHref} className={btn} style={secondary}>Open money page</Link>,
        };
      case 'unbilled_pos':
        return {
          title: `Open POs not billed · ${formatRupees(m?.costs.committedPaise ?? 0)}`,
          detail: 'Ask vendors for bills to know the real cost',
          action: <Link href="/purchase-orders" className={btn} style={secondary}>View POs</Link>,
        };
      case 'no_contract':
        return {
          title: 'No contract value yet',
          detail: 'Set it to track payments, costs and profit',
          action: p.isOwner
            ? <button type="button" onClick={p.onSetContract} className={btn} style={primary}>Set contract value</button>
            : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ask the owner to set it</span>,
        };
    }
  }

  const shown = p.items.slice(0, 3);
  return (
    <section>
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
        Needs attention · {p.items.length}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {shown.map(item => {
          const t = TONE[item.tone];
          const Icon = ICON[item.kind];
          const r = render(item);
          return (
            <div key={item.kind} className="flex gap-3 rounded-2xl border p-4" style={{ background: t.bg, borderColor: t.border }}>
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: t.title }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: t.title }}>{r.title}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.detail}</p>
                {r.action && <div className="mt-3">{r.action}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
