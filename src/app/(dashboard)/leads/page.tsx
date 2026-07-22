'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lead, LeadStage } from '@/types/leads';
import { LeadBoard } from '@/components/leads/LeadBoard';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/leads')
      .then((r) => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleLeadCreated = useCallback((newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  }, []);

  const handleStageChange = useCallback(
    (leadId: string, newStage: LeadStage) => {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)),
      );
    },
    [],
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 text-sm">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'} total
          </p>
        </div>
        <NewLeadDialog onSuccess={handleLeadCreated} />
      </div>
      <LeadBoard leads={leads} onStageChange={handleStageChange} />
    </div>
  );
}
