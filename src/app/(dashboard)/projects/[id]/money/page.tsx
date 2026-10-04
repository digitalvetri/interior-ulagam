'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ChevronRight, Clock, IndianRupee, Lock, MessageCircle, Pencil, Plus, Receipt, TrendingUp, Wallet,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { formatRupees } from '@/lib/utils';
import { useUser } from '@/components/providers/user-provider';
import { dmy } from '@/components/civil/format';
import { RecordPaymentDialog } from '@/components/money/RecordPaymentDialog';
import { ContractEditorDialog } from '@/components/money/ContractEditorDialog';
import {
  MILESTONE_STATUS_LABEL, STAGE_LABEL, type MoneyMilestone, type ProjectMoney,
} from '@/components/money/types';

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<MoneyMilestone['status'], { bg: string; color: string }> = {
  paid:      { bg: 'var(--success-soft)', color: 'var(--success-text)' },
  part_paid: { bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
  overdue:   { bg: 'var(--danger-soft)',  color: 'var(--danger-text)' },
  due:       { bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
  upcoming:  { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

const COST_COLORS = {
  material: 'var(--accent-base)',
  contract: 'var(--accent-gold)',
  staff: 'var(--info)',
  other: 'var(--text-tertiary)',
};

function profitColor(paise: number): string {
  return paise < 0 ? 'var(--danger-text)' : 'var(--success-text)';
}

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function ProjectMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin } = useUser();

  const [money, setMoney] = useState<ProjectMoney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<{ name: string; phone: string | null } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/projects/${id}/money`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not load the project money.');
        return;
      }
      const j = (await res.json()) as { data: ProjectMoney };
      setMoney(j.data);
      setError(null);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Client name + phone for reminders (best effort — skipped if not permitted).
  const customerId = money?.project.customerId ?? null;
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/v1/customers/${customerId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((j: { data?: { fullName?: string; phone?: string | null } } | null) => {
        if (!cancelled && j?.data?.fullName) setClient({ name: j.data.fullName, phone: j.data.phone ?? null });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-6 w-64 rounded" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !money) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Money</h1>
        <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{error ?? 'Not found.'}</p>
        <Link href={`/projects/${id}`} className="btn-secondary inline-flex px-4 py-2 text-sm">Back to project</Link>
      </div>
    );
  }

  const { project, contract, billing, costs, profit, duration, milestones } = money;
  const contractSet = contract.contractPaise !== null && contract.contractPaise > 0;
  const staffPaise = costs.staffLabourPaise ?? 0;
  const costTotalForBar = Math.max(1, costs.materialPaise + costs.contractLabourPaise + staffPaise + costs.otherPaise);
  const collectionBehind = duration.collectedPct !== null && duration.timeUsedPct !== null
    && duration.collectedPct < duration.timeUsedPct - 10;
  const overdueMs = milestones.filter(m => m.status === 'overdue');

  function reminderText(m: MoneyMilestone): string {
    const who = client?.name ? `Dear ${client.name}, ` : '';
    return `${who}a gentle reminder: the "${m.label}" payment of ${formatRupees(m.balancePaise)} for ${project.name} `
      + `${m.status === 'overdue' ? `has been due since ${dmy(m.dueDate)}` : 'is now due'}. Thank you!`;
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Link href="/projects" className="hover:underline">Projects</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/projects/${id}`} className="hover:underline">{project.name}</Link>
            <ChevronRight className="h-3 w-3" />
            <span style={{ color: 'var(--text-secondary)' }}>Money</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{project.name} — Money</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Stage: {STAGE_LABEL[project.stage]}
            {client?.name && <> · Client: {client.name}</>}
            {' · '}GST {project.gstPct === 0 ? 'none' : `${project.gstPct}%`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button type="button" onClick={() => setEditOpen(true)}
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
              <Pencil className="h-4 w-4" />Edit contract &amp; milestones
            </button>
          )}
          <Link href={`/projects/${id}/expenses`} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" />Expense
          </Link>
          <button type="button" onClick={() => setPayOpen(true)}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <IndianRupee className="h-4 w-4" />Record payment
          </button>
        </div>
      </div>

      {!contractSet && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-12 text-center"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <Wallet className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>Set the contract value to start tracking money</p>
          <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter the contract amount without GST and the payment milestones. Costs, profit and what the client owes are worked out from it.
          </p>
          {isAdmin ? (
            <button type="button" onClick={() => setEditOpen(true)} className="btn-primary px-4 py-2 text-sm">
              Set contract &amp; milestones
            </button>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ask the owner to set the contract value.</p>
          )}
        </div>
      )}

      {/* Cards */}
      <div className={`grid grid-cols-2 gap-3 ${profit ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard label="Contract (ex-GST)" icon={Receipt}
          value={formatRupees(contract.revisedPaise)}
          sub={contract.additionsPaise > 0
            ? `${formatRupees(contract.contractPaise ?? 0)} + ${formatRupees(contract.additionsPaise)} additions`
            : `+ GST ${formatRupees(contract.gstPaise)}`} />
        <StatCard label="Real cost so far" icon={Wallet}
          value={formatRupees(costs.totalPaise)}
          sub={costs.committedPaise > 0 ? `+ ${formatRupees(costs.committedPaise)} committed (open POs)` : 'No open purchase orders'} />
        {profit && (
          <StatCard label="Profit so far" icon={TrendingUp} accent
            value={<span style={{ color: profitColor(profit.profitPaise) }}>{formatRupees(profit.profitPaise)}</span>}
            sub={`${profit.marginPct === null ? '—' : `${profit.marginPct}%`} · expected final ${formatRupees(profit.expectedProfitPaise)}${profit.expectedMarginPct !== null ? ` (${profit.expectedMarginPct}%)` : ''}`} />
        )}
        <div className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Outstanding</span>
            <IndianRupee className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <span className="text-2xl font-bold leading-none"
            style={{ color: billing.outstandingPaise > 0 ? 'var(--warning-text)' : 'var(--text-heading)' }}>
            {formatRupees(billing.outstandingPaise)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {billing.overduePaise > 0 && <span style={{ color: 'var(--danger-text)' }}>{formatRupees(billing.overduePaise)} overdue · </span>}
            cash in hand {formatRupees(billing.cashInHandPaise)}
            {billing.advancePaise > 0 && <> · advance {formatRupees(billing.advancePaise)}</>}
          </span>
        </div>
      </div>

      {/* Breakdown + time */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Where the money went</h2>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>ex-GST · cancelled entries excluded</span>
          </div>
          <div className="mt-3 mb-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
            {costs.totalPaise > 0 && <>
              <span style={{ width: `${(costs.materialPaise / costTotalForBar) * 100}%`, background: COST_COLORS.material }} />
              <span style={{ width: `${(costs.contractLabourPaise / costTotalForBar) * 100}%`, background: COST_COLORS.contract }} />
              <span style={{ width: `${(staffPaise / costTotalForBar) * 100}%`, background: COST_COLORS.staff }} />
              <span style={{ width: `${(costs.otherPaise / costTotalForBar) * 100}%`, background: COST_COLORS.other }} />
            </>}
          </div>
          <table className="w-full text-sm">
            <tbody>
              <CostRow color={COST_COLORS.material} label="Material" hint="vendor bills + material expenses" paise={costs.materialPaise} />
              <CostRow color={COST_COLORS.contract} label="Contract labour" hint="carpenters, painters…" paise={costs.contractLabourPaise} />
              {costs.staffLabourPaise !== null && (
                <CostRow color={COST_COLORS.staff} label="Staff labour" hint={`${costs.staffDays ?? 0} logged days`} paise={costs.staffLabourPaise} />
              )}
              <CostRow color={COST_COLORS.other} label="Other" hint="transport, petty cash" paise={costs.otherPaise} />
              <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                <td className="pt-2 font-semibold" style={{ color: 'var(--text-heading)' }}>Total real cost</td>
                <td className="pt-2 text-right font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(costs.totalPaise)}</td>
              </tr>
              <tr>
                <td className="pt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>Committed — POs not yet billed</td>
                <td className="pt-1 text-right text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{formatRupees(costs.committedPaise)}</td>
              </tr>
              {profit && (
                <tr>
                  <td className="pt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>Quoted margin (accepted quote)</td>
                  <td className="pt-1 text-right text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {profit.quotedMarginPct === null ? '—' : `${profit.quotedMarginPct}%`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {costs.staffLabourPaise === null && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <Lock className="h-3 w-3" />Staff salary cost and profit are visible to the owner only.
            </p>
          )}
        </div>

        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Time &amp; progress</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Mini label="Started" value={project.startedAt ? dmy(project.startedAt) : '—'} />
            <Mini label="Planned handover" value={project.expectedEndAt ? dmy(project.expectedEndAt) : '—'} />
            <Mini
              label="Status"
              value={duration.finished && project.handoverAt ? `Handed over ${dmy(project.handoverAt)}`
                : duration.daysLeft === null ? 'No end date'
                : duration.daysLeft < 0 ? `${-duration.daysLeft} days late`
                : `${duration.daysLeft} days left`}
              color={duration.daysLeft !== null && duration.daysLeft < 0 && !duration.finished ? 'var(--danger-text)'
                : duration.daysLeft !== null && duration.daysLeft <= 14 && !duration.finished ? 'var(--warning-text)' : undefined}
            />
          </div>
          <div className="mt-4 space-y-3">
            <Bar label="Time used" pct={duration.timeUsedPct} color="var(--text-tertiary)" />
            <Bar label="Money collected" pct={duration.collectedPct} color="var(--accent-base)" />
            <Bar label={`Stage progress (${STAGE_LABEL[project.stage]})`} pct={duration.stagePct} color="var(--accent-gold)" />
          </div>
          {(collectionBehind || billing.overduePaise > 0) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {collectionBehind && 'Collection is behind time. '}
                {overdueMs.length > 0 && `${overdueMs.length} milestone${overdueMs.length !== 1 ? 's' : ''} overdue — ${formatRupees(billing.overduePaise)}`}
                {overdueMs.length > 0 && ` (oldest ${Math.max(...overdueMs.map(m => m.daysOverdue))} days).`}
              </span>
            </div>
          )}
          {duration.elapsedDays !== null && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <Clock className="h-3 w-3" />
              {duration.elapsedDays} days {duration.finished ? 'taken' : 'so far'}
              {duration.plannedDays !== null && ` of ${duration.plannedDays} planned`}
            </p>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Milestones — what the client owes</h2>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            Due {formatRupees(billing.duePaise)} · received {formatRupees(billing.receivedPaise)} · contract incl. GST {formatRupees(contract.totalWithGstPaise)}
          </span>
        </div>
        {milestones.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No milestones yet.{isAdmin ? ' Use "Edit contract & milestones" to add them.' : ''}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Milestone', '%', 'Amount', `GST ${project.gstPct}%`, 'Total', 'Due', 'Received', 'Status', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-xs font-semibold ${[2, 3, 4, 6].includes(i) ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => {
                  const st = STATUS_STYLE[m.status];
                  const canRemind = !!client?.phone && m.balancePaise > 0 && (m.status === 'due' || m.status === 'overdue' || m.status === 'part_paid') && m.isDue;
                  return (
                    <tr key={m.id} style={{ borderBottom: i < milestones.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-heading)' }}>{m.label}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{m.pctOfTotal}%</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(m.amountPaise)}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{formatRupees(m.gstPaise)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(m.totalPaise)}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {m.dueDate && (m.isDue || m.dueOn) ? dmy(m.dueDate)
                          : m.triggerStage ? <span className="text-xs">when {STAGE_LABEL[m.triggerStage]}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums"
                        style={{ color: m.receivedPaise > 0 ? 'var(--success-text)' : 'var(--text-tertiary)' }}>
                        {m.receivedPaise > 0 ? formatRupees(m.receivedPaise) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
                          {MILESTONE_STATUS_LABEL[m.status]}{m.status === 'overdue' ? ` ${m.daysOverdue}d` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canRemind && client?.phone && (
                          <a href={waLink(client.phone, reminderText(m))} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                            <MessageCircle className="h-3.5 w-3.5" />Remind
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSaved={() => void load()}
        projects={[{ id: project.id, name: project.name }]}
        defaultProjectId={project.id}
        customerId={project.customerId}
        customerName={client?.name}
        customerPhone={client?.phone}
      />
      {isAdmin && (
        <ContractEditorDialog
          open={editOpen}
          money={money}
          onClose={() => setEditOpen(false)}
          onSaved={m => { setMoney(m); setEditOpen(false); }}
        />
      )}
    </div>
  );
}

/* ── Small pieces ────────────────────────────────────────────────────────────── */

function CostRow({ color, label, hint, paise }: { color: string; label: string; hint: string; paise: number }) {
  return (
    <tr>
      <td className="py-1.5">
        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: color }} />
        <span style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</span>
      </td>
      <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(paise)}</td>
    </tr>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: color ?? 'var(--text-heading)' }}>{value}</p>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span className="tabular-nums">{pct === null ? '—' : `${pct}%`}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}
