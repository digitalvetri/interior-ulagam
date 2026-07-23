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

const COLUMN_STYLE: Record<LeadStage, { header: string; border: string; bg: string }> = {
  new:                  { header: '#1E40AF', border: '#BFDBFE', bg: '#EFF6FF' },
  site_visit_scheduled: { header: '#92400E', border: '#FCD34D', bg: '#FFFBEB' },
  consultation_done:    { header: '#9A3412', border: '#FDBA74', bg: '#FFF7ED' },
  proposal_sent:        { header: '#3730A3', border: '#A5B4FC', bg: '#EEF2FF' },
  negotiation:          { header: '#6B21A8', border: '#D8B4FE', bg: '#F5F3FF' },
  won:                  { header: '#14532D', border: '#86EFAC', bg: '#F0FDF4' },
  lost:                 { header: '#374151', border: '#D1D5DB', bg: '#F9FAFB' },
};

/* ── KPI chip ─────────────────────────────────────────────────────────────── */
function KpiChip({
  label, value, sub, gold, icon: Icon,
}: {
  label: string; value: string; sub?: string; gold?: boolean; icon: React.ElementType;
}) {
  return (
    <div className="premium-card px-4 py-3 flex-shrink-0 min-w-[130px]">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: gold ? 'rgba(212,175,106,0.12)' : 'rgba(36,33,30,0.10)' }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: gold ? '#8F6F2E' : '#24211E' }} />
        </div>
        <p className="text-[10px] font-medium" style={{ color: '#6B6459' }}>{label}</p>
      </div>
      <p className="text-xl font-bold" style={{ color: gold ? '#8F6F2E' : '#1C1916' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: '#A79E8E' }}>{sub}</p>}
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
    () => leads.map(l => ({ ...l, stage: getStage(l) })),
    [leads, getStage],
  );

  const handleStageChange = useCallback(
    async (leadId: string, newStage: LeadStage) => {
      const prev = optimisticStages[leadId] ?? leads.find(l => l.id === leadId)?.stage;
      setOptimisticStages(s => ({ ...s, [leadId]: newStage }));
      try {
        const res = await fetch(`/api/v1/leads/${leadId}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: newStage }),
        });
        if (!res.ok) throw new Error('patch failed');
        onStageChange(leadId, newStage);
      } catch {
        if (prev) setOptimisticStages(s => ({ ...s, [leadId]: prev }));
        else setOptimisticStages(s => { const n = { ...s }; delete n[leadId]; return n; });
      }
    },
    [leads, optimisticStages, onStageChange],
  );

  /* ── KPI computations ──────────────────────────────────────────────────── */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalLeads     = effectiveLeads.length;
  const activeLeads    = effectiveLeads.filter(l => ACTIVE_STAGES.includes(l.stage)).length;
  const siteVisits     = effectiveLeads.filter(l => l.stage === 'site_visit_scheduled').length;
  const proposalsSent  = effectiveLeads.filter(l => l.stage === 'proposal_sent' || l.stage === 'negotiation').length;
  const wonLeads       = effectiveLeads.filter(l => l.stage === 'won').length;
  const convRate       = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const revPotPaise    = effectiveLeads
    .filter(l => ACTIVE_STAGES.includes(l.stage))
    .reduce((s, l) => s + (l.projectValuePaise ?? 0), 0);
  const todayFollowUps = effectiveLeads.filter(l => {
    if (!l.followUpDate) return false;
    const fd = new Date(l.followUpDate);
    fd.setHours(0, 0, 0, 0);
    return fd.getTime() === today.getTime();
  }).length;

  function fmtPaise(paise: number): string {
    if (paise >= 10_000_000) return `₹${(paise / 10_000_000).toFixed(1)}Cr`;
    if (paise >= 100_000)    return `₹${(paise / 100_000).toFixed(1)}L`;
    if (paise === 0)         return '₹0';
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  const leadsByStage = (stage: LeadStage) => effectiveLeads.filter(l => l.stage === stage);

  const ALL_COLUMNS: LeadStage[] = [...ACTIVE_STAGES, 'won', 'lost'];

  return (
    <div>
      {/* ── KPI Summary Bar ───────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-3 mb-6 snap-x">
        <KpiChip label="Total Leads"       value={String(totalLeads)}     icon={Users}       />
        <KpiChip label="Active Leads"      value={String(activeLeads)}    icon={TrendingUp}  />
        <KpiChip label="Site Visits"       value={String(siteVisits)}     icon={Home}        />
        <KpiChip label="Proposals Sent"    value={String(proposalsSent)}  icon={FileText}    />
        <KpiChip label="Won"               value={String(wonLeads)}       icon={Trophy}      gold />
        <KpiChip label="Conversion"        value={`${convRate}%`}         icon={TrendingUp}  gold />
        <KpiChip label="Revenue Potential" value={fmtPaise(revPotPaise)}  icon={IndianRupee} gold />
        <KpiChip label="Today's Follow-ups" value={String(todayFollowUps)} icon={Calendar}   />
      </div>

      {/* ── Kanban Board ──────────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {ALL_COLUMNS.map(stage => {
          const columnLeads = leadsByStage(stage);
          const cs = COLUMN_STYLE[stage];

          return (
            <div key={stage} className="flex-shrink-0 w-[272px]">
              {/* Column header */}
              <div
                className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                style={{ background: cs.bg, border: `1px solid ${cs.border}` }}
              >
                <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cs.header }}>
                  {STAGE_LABELS[stage]}
                </h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: cs.border, color: cs.header }}
                >
                  {columnLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="min-h-[120px]">
                {columnLeads.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-10 rounded-xl border-2 border-dashed"
                    style={{ borderColor: '#F0EEE9' }}
                  >
                    <p className="text-xs" style={{ color: '#E2DED5' }}>No leads here</p>
                  </div>
                ) : (
                  columnLeads.map(lead => (
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
