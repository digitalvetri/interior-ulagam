'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Filter, SortAsc } from 'lucide-react';
import { Lead, LeadStage, LeadPriority, LeadSource } from '@/types/leads';
import { LeadBoard } from '@/components/leads/LeadBoard';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';

export default function LeadsPage() {
  const [leads, setLeads]                   = useState<Lead[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');
  const [filterSource, setFilterSource]     = useState<LeadSource | 'all'>('all');
  const [sortBy, setSortBy]                 = useState<'latest' | 'followup' | 'budget'>('latest');

  useEffect(() => {
    fetch('/api/v1/leads')
      .then(r => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLeadCreated = useCallback((newLead: Lead) => {
    setLeads(prev => [newLead, ...prev]);
  }, []);

  const handleStageChange = useCallback((leadId: string, newStage: LeadStage) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.contactName.toLowerCase().includes(q) ||
        l.contactPhone.includes(q) ||
        (l.contactEmail ?? '').toLowerCase().includes(q),
      );
    }
    if (filterPriority !== 'all') result = result.filter(l => l.priority === filterPriority);
    if (filterSource   !== 'all') result = result.filter(l => l.source   === filterSource);

    if (sortBy === 'followup') {
      result = [...result].sort((a, b) => {
        if (!a.followUpDate) return 1;
        if (!b.followUpDate) return -1;
        return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime();
      });
    } else if (sortBy === 'budget') {
      result = [...result].sort((a, b) => (b.projectValuePaise ?? 0) - (a.projectValuePaise ?? 0));
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return result;
  }, [leads, search, filterPriority, filterSource, sortBy]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-sm" style={{ color: '#6B6B6B' }}>Loading pipeline…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Lead Pipeline</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>
            {leads.length} total · {filteredLeads.length} shown
          </p>
        </div>
        <NewLeadDialog onSuccess={handleLeadCreated} />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8927F' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="studio-input w-full pl-9 text-sm py-2"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 flex-shrink-0" style={{ color: '#6F4E37' }} />
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as LeadPriority | 'all')}
            className="studio-input text-sm py-2 cursor-pointer"
          >
            <option value="all">All Priority</option>
            <option value="hot">🔴 Hot</option>
            <option value="warm">🟠 Warm</option>
            <option value="cold">🔵 Cold</option>
          </select>
        </div>

        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value as LeadSource | 'all')}
          className="studio-input text-sm py-2 cursor-pointer"
        >
          <option value="all">All Sources</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Referral</option>
          <option value="website">Website</option>
          <option value="walk_in">Walk-in</option>
          <option value="other">Other</option>
        </select>

        <div className="flex items-center gap-1.5">
          <SortAsc className="h-4 w-4 flex-shrink-0" style={{ color: '#6F4E37' }} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'latest' | 'followup' | 'budget')}
            className="studio-input text-sm py-2 cursor-pointer"
          >
            <option value="latest">Latest First</option>
            <option value="followup">By Follow-up Date</option>
            <option value="budget">By Budget</option>
          </select>
        </div>
      </div>

      <LeadBoard leads={filteredLeads} onStageChange={handleStageChange} />
    </div>
  );
}
