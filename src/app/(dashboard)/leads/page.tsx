'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { Lead, LeadStage, LeadPriority, LeadSource } from '@/types/leads';
import { LeadBoard } from '@/components/leads/LeadBoard';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';

export default function LeadsPage() {
  const [leads, setLeads]                   = useState<Lead[]>([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [search, setSearch]                 = useState('');
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');
  const [filterSource, setFilterSource]     = useState<LeadSource | 'all'>('all');
  const [sortBy, setSortBy]                 = useState<'latest' | 'followup' | 'budget'>('latest');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/leads');
        if (!res.ok) {
          setLoadError(`Failed to load leads (${res.status})`);
          return;
        }
        const { data } = (await res.json()) as { data: Lead[] | null };
        setLeads(data ?? []);
      } catch {
        setLoadError('Network error — please try again');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const handleLeadCreated = useCallback((newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  }, []);

  const handleStageChange = useCallback((leadId: string, newStage: LeadStage) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.contactName.toLowerCase().includes(q) ||
          l.contactPhone.includes(q) ||
          (l.contactEmail ?? '').toLowerCase().includes(q),
      );
    }
    if (filterPriority !== 'all') result = result.filter((l) => l.priority === filterPriority);
    if (filterSource !== 'all') result = result.filter((l) => l.source === filterSource);

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

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="display display-md">Lead pipeline</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
            <span className="num" style={{ color: 'var(--ink)' }}>{leads.length}</span> total ·{' '}
            <span className="num" style={{ color: 'var(--ink)' }}>{filteredLeads.length}</span> shown
          </p>
        </div>
        <NewLeadDialog onSuccess={handleLeadCreated} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="studio-input-group flex-1 min-w-[220px] max-w-sm">
          <Search className="studio-input-icon h-4 w-4" strokeWidth={1.75} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="studio-input studio-input--icon w-full text-sm"
            style={{ padding: '0.5rem 0.875rem 0.5rem 2.5rem' }}
          />
        </div>

        <FilterSelect
          icon={Filter}
          value={filterPriority}
          onChange={(v) => setFilterPriority(v as LeadPriority | 'all')}
          options={[
            { value: 'all', label: 'All priority' },
            { value: 'hot', label: 'Hot' },
            { value: 'warm', label: 'Warm' },
            { value: 'cold', label: 'Cold' },
          ]}
        />

        <FilterSelect
          value={filterSource}
          onChange={(v) => setFilterSource(v as LeadSource | 'all')}
          options={[
            { value: 'all', label: 'All sources' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'instagram', label: 'Instagram' },
            { value: 'referral', label: 'Referral' },
            { value: 'website', label: 'Website' },
            { value: 'walk_in', label: 'Walk-in' },
            { value: 'other', label: 'Other' },
          ]}
        />

        <FilterSelect
          icon={ArrowUpDown}
          value={sortBy}
          onChange={(v) => setSortBy(v as 'latest' | 'followup' | 'budget')}
          options={[
            { value: 'latest', label: 'Latest first' },
            { value: 'followup', label: 'By follow-up' },
            { value: 'budget', label: 'By budget' },
          ]}
        />
      </div>

      {/* Load error */}
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border p-4 text-sm"
          style={{ background: 'var(--neg-tint)', borderColor: 'transparent', color: 'var(--neg)' }}
        >
          {loadError}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Loading pipeline…
          </p>
        </div>
      ) : (
        <LeadBoard leads={filteredLeads} onStageChange={handleStageChange} />
      )}
    </div>
  );
}

/* ── Filter select — matches design system, replaces raw <select> ─────── */
function FilterSelect({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon?: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label
      className="inline-flex items-center gap-2 px-3 h-9 rounded-lg cursor-pointer"
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line-strong)',
      }}
    >
      {Icon && (
        <Icon
          className="h-3.5 w-3.5 flex-shrink-0"
          style={{ color: 'var(--ink-3)' }}
          strokeWidth={1.75}
        />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-none outline-none text-sm cursor-pointer pr-1"
        style={{ color: 'var(--ink)' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--panel)', color: 'var(--ink)' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
