'use client';

import { useState, useCallback } from 'react';
import {
  Lead,
  LeadStage,
  ACTIVE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
} from '@/types/leads';
import { LeadCard } from './LeadCard';
import { Badge } from '@/components/ui/badge';

interface LeadBoardProps {
  leads: Lead[];
  onStageChange: (leadId: string, newStage: LeadStage) => void;
}

export function LeadBoard({ leads, onStageChange }: LeadBoardProps) {
  // Local optimistic overrides: leadId → stage
  const [optimisticStages, setOptimisticStages] = useState<
    Record<string, LeadStage>
  >({});

  const getStage = useCallback(
    (lead: Lead): LeadStage =>
      optimisticStages[lead.id] ?? lead.stage,
    [optimisticStages],
  );

  const handleStageChange = useCallback(
    async (leadId: string, newStage: LeadStage) => {
      const previousStage = optimisticStages[leadId] ??
        leads.find((l) => l.id === leadId)?.stage;

      // Optimistic update
      setOptimisticStages((prev) => ({ ...prev, [leadId]: newStage }));

      try {
        const res = await fetch(`/api/v1/leads/${leadId}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: newStage }),
        });

        if (!res.ok) {
          throw new Error(`PATCH failed: ${res.status}`);
        }

        // Propagate to parent so it can keep its own copy in sync
        onStageChange(leadId, newStage);
      } catch (err) {
        console.error('Stage update failed, reverting', err);
        // Revert optimistic change
        if (previousStage) {
          setOptimisticStages((prev) => ({
            ...prev,
            [leadId]: previousStage,
          }));
        } else {
          setOptimisticStages((prev) => {
            const next = { ...prev };
            delete next[leadId];
            return next;
          });
        }
      }
    },
    [leads, optimisticStages, onStageChange],
  );

  // Derive effective stage for each lead (optimistic takes priority)
  const effectiveLeads = leads.map((l) => ({
    ...l,
    stage: getStage(l),
  }));

  // Won / Lost summary counts (derived from effective stages)
  const wonCount = effectiveLeads.filter((l) => l.stage === 'won').length;
  const lostCount = effectiveLeads.filter((l) => l.stage === 'lost').length;

  // Leads per active stage
  const leadsByStage = (stage: LeadStage): Lead[] =>
    effectiveLeads.filter((l) => l.stage === stage);

  return (
    <div>
      {/* Won / Lost summary row */}
      <div className="flex gap-3 mb-4 justify-end">
        <span className="flex items-center gap-1.5 text-sm">
          <Badge className={STAGE_COLORS['won']}>{wonCount} Won</Badge>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <Badge className={STAGE_COLORS['lost']}>{lostCount} Lost</Badge>
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map((stage) => {
          const columnLeads = leadsByStage(stage);
          return (
            <div
              key={stage}
              className="min-w-[260px] max-w-[260px] flex-shrink-0"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {STAGE_LABELS[stage]}
                </h3>
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {columnLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="min-h-[60px]">
                {columnLeads.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                    No leads
                  </p>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onStageChange={handleStageChange}
                    />
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
