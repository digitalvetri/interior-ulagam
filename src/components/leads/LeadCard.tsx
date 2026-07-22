'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lead, LeadStage, STAGE_LABELS, STAGE_COLORS, STAGE_ORDER } from '@/types/leads';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onStageChange: (leadId: string, newStage: LeadStage) => void;
}

function getDaysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  other: 'Other',
};

export function LeadCard({ lead, onStageChange }: LeadCardProps) {
  const daysSince = getDaysSince(lead.lastActivityAt);
  const stageIndex = STAGE_ORDER.indexOf(lead.stage);
  const prevStage = stageIndex > 0 ? STAGE_ORDER[stageIndex - 1] : null;
  const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null;

  return (
    <Card className="mb-3 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-sm text-gray-900 leading-tight">{lead.contactName}</p>
          {daysSince > 5 && (
            <Badge className="bg-red-100 text-red-700 text-xs shrink-0">Stale</Badge>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-2">{lead.contactPhone}</p>

        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="outline" className="text-xs">
            {SOURCE_LABELS[lead.source] ?? lead.source}
          </Badge>
        </div>

        {lead.budgetBand && (
          <p className="text-xs text-gray-600 mb-2">Budget: {lead.budgetBand}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {daysSince === 0 ? 'Active today' : `${daysSince}d ago`}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[lead.stage]}`}>
            {STAGE_LABELS[lead.stage]}
          </span>
        </div>

        <div className="flex gap-1 mt-3">
          <Button
            variant="outline" size="sm" className="flex-1 text-xs h-7"
            disabled={prevStage === null}
            onClick={() => prevStage && onStageChange(lead.id, prevStage)}
          >
            <ChevronLeft className="h-3 w-3 mr-0.5" />
            {prevStage ? STAGE_LABELS[prevStage] : '—'}
          </Button>
          <Button
            variant="outline" size="sm" className="flex-1 text-xs h-7"
            disabled={nextStage === null}
            onClick={() => nextStage && onStageChange(lead.id, nextStage)}
          >
            {nextStage ? STAGE_LABELS[nextStage] : '—'}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
