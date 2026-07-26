'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp, Users, Home, FileText, Trophy, IndianRupee, Calendar,
} from 'lucide-react';
import { Lead, LeadStage, ACTIVE_STAGES, STAGE_LABELS } from '@/types/leads';
import { LeadCard } from './LeadCard';

interface LeadBoardProps {
  leads: Lead[];
  onStageChange: (leadId: string, newStage: LeadStage) => void;
}

// Column tint per stage — a hairline background wash + a matching chip color
// on the header pill. Kept subtle so the CARDS carry the visual weight.
const COLUMN_STYLE: Record<
  LeadStage,
  { chipClass: string; wash: string }
> = {
  new:                  { chipClass: 'chip',       wash: 'transparent' },
  site_visit_scheduled: { chipClass: 'chip chip--warn', wash: 'var(--warn-tint)' },
  consultation_done:    { chipClass: 'chip chip--warn', wash: 'var(--warn-tint)' },
  proposal_sent:        { chipClass: 'chip chip--acc',  wash: 'var(--acc-tint)' },
  negotiation:          { chipClass: 'chip chip--acc',  wash: 'var(--acc-tint)' },
  won:                  { chipClass: 'chip chip--pos',  wash: 'var(--pos-tint)' },
  lost:                 { chipClass: 'chip',       wash: 'transparent' },
};

/* ── KPI chip ─────────────────────────────────────────────────────────────── */
function KpiChip({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="card p-4 flex-shrink-0 min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="stat-badge"
          style={{ width: 26, height: 26 }}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <p className="eyebrow" style={{ letterSpacing: '0.06em', fontSize: '0.625rem' }}>
          {label}
        </p>
      </div>
      <p
        className="text-[1.375rem] font-semibold num"
        style={{
          color: accent ? 'var(--acc)' : 'var(--ink)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Board ─────────────────────────────────────────────────────────────────── */
export function LeadBoard({ leads, onStageChange }: LeadBoardProps) {
  const [optimisticStages, setOptimisticStages] = useState<Record<string, LeadStage>>({});

  const getStage = useCallback(
    (lead: Lead): LeadStage => optimisticStages[lead.id] ?? lead.stage,
    [optimisticStages],
  );

  const effectiveLeads = useMemo(
    () => leads.map((l) => ({ ...l, stage: getStage(l) })),
    [leads, getStage],
  );

  const handleStageChange = useCallback(
    async (leadId: string, newStage: LeadStage) => {
      const prev = optimisticStages[leadId] ?? leads.find((l) => l.id === leadId)?.stage;
      setOptimisticStages((s) => ({ ...s, [leadId]: newStage }));
      try {
        const res = await fetch(`/api/v1/leads/${leadId}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: newStage }),
        });
        if (!res.ok) throw new Error('patch failed');
        onStageChange(leadId, newStage);
      } catch {
        if (prev) setOptimisticStages((s) => ({ ...s, [leadId]: prev }));
        else
          setOptimisticStages((s) => {
            const n = { ...s };
            delete n[leadId];
            return n;
          });
      }
    },
    [leads, optimisticStages, onStageChange],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalLeads = effectiveLeads.length;
  const activeLeads = effectiveLeads.filter((l) => ACTIVE_STAGES.includes(l.stage)).length;
  const siteVisits = effectiveLeads.filter((l) => l.stage === 'site_visit_scheduled').length;
  const proposalsSent = effectiveLeads.filter(
    (l) => l.stage === 'proposal_sent' || l.stage === 'negotiation',
  ).length;
  const wonLeads = effectiveLeads.filter((l) => l.stage === 'won').length;
  const convRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const revPotPaise = effectiveLeads
    .filter((l) => ACTIVE_STAGES.includes(l.stage))
    .reduce((s, l) => s + (l.projectValuePaise ?? 0), 0);
  const todayFollowUps = effectiveLeads.filter((l) => {
    if (!l.followUpDate) return false;
    const fd = new Date(l.followUpDate);
    fd.setHours(0, 0, 0, 0);
    return fd.getTime() === today.getTime();
  }).length;

  function fmtPaise(paise: number): string {
    if (paise >= 10_000_000) return `₹${(paise / 10_000_000).toFixed(1)}Cr`;
    if (paise >= 100_000) return `₹${(paise / 100_000).toFixed(1)}L`;
    if (paise === 0) return '₹0';
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  const leadsByStage = (stage: LeadStage) => effectiveLeads.filter((l) => l.stage === stage);
  const ALL_COLUMNS: LeadStage[] = [...ACTIVE_STAGES, 'won', 'lost'];

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <KpiChip label="Total"       value={String(totalLeads)}     icon={Users}       />
        <KpiChip label="Active"      value={String(activeLeads)}    icon={TrendingUp}  />
        <KpiChip label="Site visits" value={String(siteVisits)}     icon={Home}        />
        <KpiChip label="Proposals"   value={String(proposalsSent)}  icon={FileText}    />
        <KpiChip label="Won"         value={String(wonLeads)}       accent icon={Trophy}      />
        <KpiChip label="Conversion"  value={`${convRate}%`}         accent icon={TrendingUp}  />
        <KpiChip label="Revenue pot." value={fmtPaise(revPotPaise)} accent icon={IndianRupee} />
        <KpiChip label="Today's follow-ups" value={String(todayFollowUps)} icon={Calendar} />
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {ALL_COLUMNS.map((stage) => {
          const columnLeads = leadsByStage(stage);
          const cs = COLUMN_STYLE[stage];

          return (
            <div key={stage} className="flex-shrink-0 w-[280px]">
              {/* Column header — stage name chip + count */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={cs.chipClass}>{STAGE_LABELS[stage]}</span>
                <span
                  className="text-[11px] font-semibold num"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {columnLeads.length}
                </span>
              </div>

              {/* Column body — subtle wash so columns are visually distinct */}
              <div
                className="rounded-lg p-2 min-h-[140px]"
                style={{
                  background: cs.wash === 'transparent' ? 'var(--bg-2)' : cs.wash,
                  border: '1px solid var(--line)',
                }}
              >
                {columnLeads.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-10 rounded-md border border-dashed"
                    style={{ borderColor: 'var(--line-strong)' }}
                  >
                    <p className="text-xs" style={{ color: 'var(--ink-5)' }}>
                      No leads here
                    </p>
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onStageChange={handleStageChange} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
