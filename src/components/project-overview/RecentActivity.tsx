'use client';

import { Activity, ClipboardList, IndianRupee, Receipt } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { Expense } from '@/types/accounts';
import { MODE_LABEL, relTime, type ProjectPayment } from './util';

interface SiteLogLite { id: string; logDate: string; transcript: string | null; createdAt: string }

interface Item { key: string; at: string; icon: React.ElementType; color: string; text: string }

/** The last few things that happened on the project — payments, expenses, site logs. */
export function RecentActivity({ payments, expenses, siteLogs, showFinance }: {
  payments: ProjectPayment[]; expenses: Expense[]; siteLogs: SiteLogLite[]; showFinance: boolean;
}) {
  const items: Item[] = [];
  if (showFinance) {
    for (const p of payments) {
      if (p.status === 'pending') continue;
      items.push({
        key: `p-${p.id}`, at: p.receivedAt ?? p.createdAt, icon: IndianRupee, color: 'var(--success-text)',
        text: `${formatRupees(Number(p.amountPaise))} received${p.mode ? ` · ${MODE_LABEL[p.mode] ?? p.mode}` : ''}`,
      });
    }
    for (const e of expenses) {
      if (e.voidedAt) continue;
      items.push({
        key: `e-${e.id}`, at: e.createdAt, icon: Receipt, color: 'var(--warning-text)',
        text: `Expense ${formatRupees(e.amountPaise)}${e.description ? ` · ${e.description}` : e.vendorName ? ` · ${e.vendorName}` : ''}`,
      });
    }
  }
  for (const l of siteLogs) {
    items.push({
      key: `l-${l.id}`, at: l.createdAt, icon: ClipboardList, color: 'var(--accent-base)',
      text: `Site log${l.transcript ? ` · ${l.transcript.slice(0, 60)}${l.transcript.length > 60 ? '…' : ''}` : ''}`,
    });
  }
  const recent = items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  return (
    <section className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>Recent activity</p>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <Activity className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Nothing yet — payments, expenses and site logs appear here.</p>
        </div>
      ) : (
        <ul className="mt-2">
          {recent.map((it, i) => {
            const Icon = it.icon;
            return (
              <li key={it.key} className="flex items-start gap-2.5 py-2 text-[13px]"
                style={{ borderBottom: i < recent.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: it.color }} />
                <span className="min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>{it.text}</span>
                <span className="flex-shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{relTime(it.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
