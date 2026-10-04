'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, Pencil, Plus, IndianRupee, Wallet, FileText, Layers, BookOpen } from 'lucide-react';
import { STAGE_STYLE_MAP } from '@/types/deliverables';
import type { ProjectStage } from '@/types/deliverables';
import type { HealthStatus } from '@/lib/project-money/health';
import { dmy } from '@/components/civil/format';

const HEALTH: Record<HealthStatus, { label: string; color: string; bg: string }> = {
  on_track:        { label: 'On track',        color: 'var(--success-text)', bg: 'var(--success-soft)' },
  needs_attention: { label: 'Needs attention', color: 'var(--warning-text)', bg: 'var(--warning-soft)' },
  at_risk:         { label: 'At risk',         color: 'var(--danger-text)',  bg: 'var(--danger-soft)' },
  unknown:         { label: 'Set contract',    color: 'var(--text-secondary)', bg: 'var(--surface-muted)' },
};

const RING: Record<HealthStatus, string> = {
  on_track: 'var(--success)', needs_attention: 'var(--warning)', at_risk: 'var(--danger)', unknown: 'var(--border-strong)',
};

interface Props {
  name: string;
  stage: ProjectStage;
  health: { score: number | null; status: HealthStatus };
  clientName: string | null;
  customerId: string | null;
  siteAddress: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  /** From the money engine when available; otherwise worked out from the dates. */
  daysLeft: number | null;
  finished: boolean;
  showFinance: boolean;
  canChangeStage: boolean;
  moneyHref: string;
  onEdit: () => void;
  onExpense: () => void;
  onRecordPayment: () => void;
  onCreateInvoice: () => void;
  onChangeStage: () => void;
}

/** Health ring, name, the facts that matter, and the actions — one main one, the rest in ⋯. */
export function ProjectHeader(p: Props) {
  const h = HEALTH[p.health.status];
  const pct = p.health.score ?? 0;
  const stage = STAGE_STYLE_MAP[p.stage];

  const timing = p.finished ? 'Handed over'
    : p.daysLeft === null ? null
    : p.daysLeft < 0 ? `${-p.daysLeft} days late`
    : p.daysLeft === 0 ? 'Handover today'
    : `${p.daysLeft} days left`;
  const timingColor = p.finished ? 'var(--success-text)' : p.daysLeft !== null && p.daysLeft < 0 ? 'var(--danger-text)'
    : p.daysLeft !== null && p.daysLeft <= 14 ? 'var(--warning-text)' : 'var(--text-secondary)';

  const facts: React.ReactNode[] = [];
  if (p.clientName) {
    facts.push(p.customerId
      ? <Link key="c" href={`/customers/${p.customerId}`} className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>{p.clientName}</Link>
      : <span key="c">{p.clientName}</span>);
  }
  if (p.siteAddress) facts.push(<span key="s">{p.siteAddress}</span>);
  if (p.startedAt || p.expectedEndAt) {
    facts.push(<span key="d" className="tabular-nums">{p.startedAt ? dmy(p.startedAt) : '—'} → {p.expectedEndAt ? dmy(p.expectedEndAt) : '—'}</span>);
  }
  if (timing) facts.push(<span key="t" className="font-semibold" style={{ color: timingColor }}>{timing}</span>);

  return (
    <div>
    <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
      style={{ color: 'var(--text-secondary)' }}>
      <ArrowLeft className="h-3 w-3" />All projects
    </Link>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${RING[p.health.status]} 0 ${pct}%, var(--surface-muted) ${pct}% 100%)` }}
          title={p.health.score === null ? 'Health appears once a contract value is set' : `Project health ${p.health.score}/100`}
        >
          <div className="flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full" style={{ background: 'var(--surface-card)' }}>
            <span className="text-lg font-extrabold leading-none tabular-nums" style={{ color: p.health.score === null ? 'var(--text-tertiary)' : h.color }}>
              {p.health.score ?? '—'}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>health</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-heading)' }}>{p.name}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: h.bg, color: h.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />{h.label}
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: stage.bg, color: stage.fg }}>
              {stage.label}
            </span>
          </div>
          {facts.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {facts.map((f, i) => <span key={i} className="inline-flex items-center gap-2">{i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>·</span>}{f}</span>)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={p.onEdit} title="Edit project" aria-label="Edit project"
          className="btn-secondary inline-flex h-10 w-10 items-center justify-center rounded-xl">
          <Pencil className="h-4 w-4" />
        </button>
        {p.showFinance && (
          <button type="button" onClick={p.onExpense} className="btn-secondary inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm">
            <Plus className="h-4 w-4" />Expense
          </button>
        )}
        {p.showFinance && (
          <button type="button" onClick={p.onRecordPayment} className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm">
            <IndianRupee className="h-4 w-4" />Record payment
          </button>
        )}
        <MoreMenu {...p} />
      </div>
    </div>
    </div>
  );
}

function MoreMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-muted)]';
  const close = (fn?: () => void) => () => { setOpen(false); fn?.(); };
  const anything = p.showFinance || p.canChangeStage;
  if (!anything) return null;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions"
        className="btn-secondary inline-flex h-10 w-10 items-center justify-center rounded-xl">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-56 rounded-xl border p-1.5 shadow-lg"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}>
          {p.showFinance && (
            <Link role="menuitem" href={p.moneyHref} className={item} onClick={close()}>
              <Wallet className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />Open money page
            </Link>
          )}
          {p.showFinance && (
            <button role="menuitem" type="button" className={item} onClick={close(p.onCreateInvoice)}>
              <FileText className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />Create invoice
            </button>
          )}
          {p.canChangeStage && (
            <button role="menuitem" type="button" className={item} onClick={close(p.onChangeStage)}>
              <Layers className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />Change stage
            </button>
          )}
          {p.showFinance && p.customerId && (
            <Link role="menuitem" href={`/customers/${p.customerId}`} className={item} onClick={close()}>
              <BookOpen className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />Client ledger
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
