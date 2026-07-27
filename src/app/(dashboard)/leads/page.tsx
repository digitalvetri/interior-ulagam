'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Phone, MessageCircle, Calendar, MapPin, Home, User, Clock,
  Eye, Users, Filter, ChevronDown,
} from 'lucide-react';
import { Lead, LeadStage, LeadPriority, LeadSource, STAGE_LABELS, PRIORITY_CONFIG } from '@/types/leads';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';

/* ── Types ──────────────────────────────────────────────────────────────────── */
type FilterKey = LeadStage | 'all' | 'follow_up';
type SortKey   = 'latest' | 'followup' | 'budget' | 'name';

/* ── Status chip config ─────────────────────────────────────────────────────── */
const STATUS_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all',                  label: 'All' },
  { key: 'new',                  label: 'New' },
  { key: 'follow_up',            label: 'Follow-up' },
  { key: 'site_visit_scheduled', label: 'Site Visit' },
  { key: 'consultation_done',    label: 'Consultation' },
  { key: 'proposal_sent',        label: 'Quotation' },
  { key: 'won',                  label: 'Won' },
  { key: 'lost',                 label: 'Lost' },
];

/* ── Stage badge style ──────────────────────────────────────────────────────── */
const STAGE_STYLE: Record<LeadStage, { bg: string; color: string }> = {
  new:                  { bg: '#EFF6FF', color: '#1D4ED8' },
  site_visit_scheduled: { bg: '#FEF9C3', color: '#854D0E' },
  consultation_done:    { bg: '#FFF7ED', color: '#C2410C' },
  proposal_sent:        { bg: '#EEF2FF', color: '#4338CA' },
  negotiation:          { bg: '#F5F3FF', color: '#7C3AED' },
  won:                  { bg: '#F0FDF4', color: '#15803D' },
  lost:                 { bg: '#F9FAFB', color: '#4B5563' },
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function followUpState(dateIso?: string): 'overdue' | 'today' | 'upcoming' | null {
  if (!dateIso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fd = new Date(dateIso); fd.setHours(0, 0, 0, 0);
  if (fd < today)  return 'overdue';
  if (fd.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

const FU_STYLE = {
  overdue:  { bg: '#FEF2F2', color: '#DC2626' },
  today:    { bg: '#FFF7ED', color: '#EA580C' },
  upcoming: { bg: '#F0FDF4', color: '#15803D' },
};

/* ── Lead list card ──────────────────────────────────────────────────────────── */
function LeadListCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const stageStyle = STAGE_STYLE[lead.stage];
  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const fuState = followUpState(lead.followUpDate);
  const age = daysSince(lead.lastActivityAt);

  return (
    <div
      className="bg-white rounded-[16px] border border-gray-100 p-5 cursor-pointer group transition-all duration-200 hover:border-violet-200 hover:shadow-md"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      onClick={() => router.push(`/leads/${lead.id}`)}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 select-none"
          style={{ background: 'linear-gradient(135deg, #0E7F6E 0%, #14A08B 100%)' }}
        >
          {lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: name + badges + action icons */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="text-[15px] font-semibold text-gray-900 truncate">
                {lead.contactName}
              </h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                style={{ background: stageStyle.bg, color: stageStyle.color }}
              >
                {STAGE_LABELS[lead.stage]}
              </span>
              {priorityCfg && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0"
                  style={{ background: priorityCfg.bg, color: priorityCfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                  {priorityCfg.label}
                </span>
              )}
            </div>

            {/* Quick action icons — visible on hover */}
            <div
              className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              <a
                href={`tel:${lead.contactPhone}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-blue-50"
                title="Call"
              >
                <Phone className="h-4 w-4 text-blue-600" />
              </a>
              <a
                href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-green-50"
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
              </a>
              <Link
                href={`/leads/${lead.id}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-emerald-50"
                title="View Details"
              >
                <Eye className="h-4 w-4" style={{ color: 'var(--forest)' }} />
              </Link>
            </div>
          </div>

          {/* Row 2: phone, project type, location, budget */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              {lead.contactPhone}
            </span>
            {lead.propertyType && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Home className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.propertyType}
              </span>
            )}
            {lead.projectLocation && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.projectLocation}
              </span>
            )}
            {(lead.projectValuePaise ?? 0) > 0 && (
              <span className="text-sm font-medium" style={{ color: '#8F6F2E' }}>
                ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>

          {/* Row 3: assigned, follow-up, last updated */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {lead.designerName && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.designerName}
              </span>
            )}
            {fuState && lead.followUpDate && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5"
                style={FU_STYLE[fuState]}
              >
                <Calendar className="h-3 w-3 flex-shrink-0" />
                {fuState === 'overdue' ? 'Overdue · ' : fuState === 'today' ? 'Today · ' : ''}
                {fmtDate(lead.followUpDate)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {age === 0 ? 'Today' : `${age}d ago`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [activeChip, setActiveChip] = useState<FilterKey>('all');
  const [sortBy, setSortBy]         = useState<SortKey>('latest');
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');
  const [filterSource, setFilterSource]     = useState<LeadSource | 'all'>('all');

  useEffect(() => {
    fetch('/api/v1/leads')
      .then(r => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLeadCreated = useCallback((lead: Lead) => {
    setLeads(prev => [lead, ...prev]);
  }, []);

  /* Count per chip key */
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach(l => {
      counts[l.stage] = (counts[l.stage] ?? 0) + 1;
      if (l.followUpDate) counts['follow_up'] = (counts['follow_up'] ?? 0) + 1;
    });
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;

    /* Stage / chip filter */
    if (activeChip === 'follow_up') {
      result = result.filter(l => !!l.followUpDate);
    } else if (activeChip !== 'all') {
      result = result.filter(l => l.stage === activeChip);
    }

    /* Priority + source (behind filter button) */
    if (filterPriority !== 'all') result = result.filter(l => l.priority === filterPriority);
    if (filterSource !== 'all')   result = result.filter(l => l.source === filterSource);

    /* Text search */
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.contactName.toLowerCase().includes(q) ||
        l.contactPhone.includes(q) ||
        (l.contactEmail ?? '').toLowerCase().includes(q) ||
        (l.projectLocation ?? '').toLowerCase().includes(q),
      );
    }

    /* Sort */
    if (sortBy === 'followup') {
      result = [...result].sort((a, b) => {
        if (!a.followUpDate) return 1;
        if (!b.followUpDate) return -1;
        return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime();
      });
    } else if (sortBy === 'budget') {
      result = [...result].sort((a, b) => (b.projectValuePaise ?? 0) - (a.projectValuePaise ?? 0));
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.contactName.localeCompare(b.contactName));
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return result;
  }, [leads, activeChip, filterPriority, filterSource, search, sortBy]);

  return (
    <div className="min-h-full" style={{ background: '#F8F9FC' }}>
      <div className="px-6 pt-6 pb-8 max-w-5xl mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {leads.length} total · {filtered.length} shown
            </p>
          </div>
          <NewLeadDialog onSuccess={handleLeadCreated} />
        </div>

        {/* ── Search + sort + filter ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="studio-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, location…"
              className="studio-input w-full text-sm h-[48px] pl-11"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="studio-input h-[48px] text-sm text-gray-700 pl-4 pr-8 cursor-pointer appearance-none"
            >
              <option value="latest">Latest First</option>
              <option value="followup">By Follow-up</option>
              <option value="budget">By Budget</option>
              <option value="name">By Name</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            className="flex items-center gap-2 h-[48px] px-4 rounded-[12px] text-sm font-medium transition-colors"
            style={{
              background: showFilters ? 'var(--mint-mist)' : '#FFFFFF',
              color: showFilters ? 'var(--forest-deep)' : '#374151',
              border: showFilters ? '1.5px solid #B4DCD1' : '1.5px solid #E5E7EB',
            }}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        {/* ── Expanded filter row ─────────────────────────────────────────── */}
        {showFilters && (
          <div className="flex gap-3 flex-wrap p-4 rounded-[12px] bg-white border border-gray-100"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="relative">
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value as LeadPriority | 'all')}
                className="studio-input text-sm h-[40px] pl-3 pr-7 cursor-pointer appearance-none"
              >
                <option value="all">All Priority</option>
                <option value="hot">🔴 Hot</option>
                <option value="warm">🟠 Warm</option>
                <option value="cold">🔵 Cold</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="relative">
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value as LeadSource | 'all')}
                className="studio-input text-sm h-[40px] pl-3 pr-7 cursor-pointer appearance-none"
              >
                <option value="all">All Sources</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
            {(filterPriority !== 'all' || filterSource !== 'all') && (
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 px-3"
                onClick={() => { setFilterPriority('all'); setFilterSource('all'); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Status filter chips ─────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
          {STATUS_CHIPS.map(chip => {
            const count = chipCounts[chip.key] ?? 0;
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveChip(chip.key)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all"
                style={isActive ? {
                  background: 'var(--forest)',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(14,127,110,0.35)',
                } : {
                  background: '#FFFFFF',
                  color: '#374151',
                  border: '1.5px solid #E5E7EB',
                }}
              >
                {chip.label}
                {count > 0 && (
                  <span
                    className="text-[11px] rounded-full px-1.5 py-0.5 font-semibold"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
                      color:      isActive ? '#FFFFFF' : '#6B7280',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Lead list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-[16px] animate-pulse"
                style={{ height: 100, border: '1px solid #F3F4F6' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="bg-white rounded-[16px] flex flex-col items-center justify-center gap-3 py-16"
            style={{ border: '1.5px dashed #E5E7EB' }}
          >
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--mint-mist)' }}
            >
              <Users className="h-6 w-6" style={{ color: 'var(--forest)' }} />
            </div>
            <p className="text-sm font-medium text-gray-600">
              {search || activeChip !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </p>
            {!search && activeChip === 'all' && (
              <p className="text-xs text-gray-400">Add your first lead to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => (
              <LeadListCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
