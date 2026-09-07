'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Ruler, Plus, Search, Calendar, MapPin, CheckCircle2,
  Clock, XCircle, Loader2, AlertTriangle, Camera,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface SiteVisit {
  id: string;
  leadId: string;
  scheduledAt: string;
  completedAt: string | null;
  status: VisitStatus;
  locationJson: { address?: string } | null;
  photos: string[];
  notes: string | null;
}

interface Lead {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  city: string | null;
}

interface ScheduleForm {
  leadId: string;
  scheduledAt: string;
  address: string;
  notes: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

type StatusStyle = { bg: string; fg: string; border: string; Icon: React.ElementType };

const STATUS_STYLES: Record<VisitStatus, StatusStyle> = {
  scheduled:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)',   border: 'rgba(37,99,235,0.22)',   Icon: Clock        },
  in_progress: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)', border: 'rgba(194,65,12,0.22)',  Icon: Ruler        },
  completed:   { bg: 'var(--success-soft)',      fg: 'var(--success-text)',  border: 'rgba(15,157,110,0.24)', Icon: CheckCircle2 },
  cancelled:   { bg: '#FEE2E2',                 fg: '#B91C1C',              border: '#FCA5A5',               Icon: XCircle      },
};

const STATUS_ORDER: VisitStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getAddress(loc: SiteVisit['locationJson']) {
  return loc?.address?.trim() || '—';
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span className="tnum text-[11px]" style={{ opacity: 0.8 }}>{count}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteVisitsPage() {
  const [visits,  setVisits]  = useState<SiteVisit[]>([]);
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<VisitStatus | 'all'>('all');

  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [form,        setForm]        = useState<ScheduleForm>({ leadId: '', scheduledAt: '', address: '', notes: '' });
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, lRes] = await Promise.all([
        fetch('/api/v1/site-visits').then(r => r.json()),
        fetch('/api/v1/leads').then(r => r.json()),
      ]);
      setVisits(Array.isArray(vRes.data) ? (vRes.data as SiteVisit[]) : []);
      setLeads(Array.isArray(lRes.data)  ? (lRes.data  as Lead[])      : []);
    } catch {
      setError('Failed to load — please retry');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadData(); }, [loadData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const leadMap = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach(l => m.set(l.id, l));
    return m;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter(v => {
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (!q) return true;
      const lead = leadMap.get(v.leadId);
      const addr = getAddress(v.locationJson);
      return (
        (lead?.contactName ?? '').toLowerCase().includes(q) ||
        addr.toLowerCase().includes(q) ||
        (v.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [visits, filterStatus, search, leadMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visits.length };
    STATUS_ORDER.forEach(s => { c[s] = visits.filter(v => v.status === s).length; });
    return c;
  }, [visits]);

  async function handleSchedule() {
    if (!form.leadId)        { setSubmitError('Select a lead.'); return; }
    if (!form.scheduledAt)   { setSubmitError('Choose a date and time.'); return; }
    if (!form.address.trim()) { setSubmitError('Enter an address.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/v1/site-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: form.leadId,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          address: form.address.trim(),
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setSubmitError(typeof b.error === 'string' ? b.error : 'Failed to schedule');
        return;
      }
      const { data } = (await res.json()) as { data: SiteVisit };
      setVisits(prev => [data, ...prev]);
      setDialogOpen(false);
      setForm({ leadId: '', scheduledAt: '', address: '', notes: '' });
    } catch {
      setSubmitError('Network error — try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Site Visits</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${visits.length} ${visits.length === 1 ? 'visit' : 'visits'} scheduled`}
          </p>
        </div>
        <button
          onClick={() => { setSubmitError(null); setDialogOpen(true); }}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Schedule visit
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lead, address…"
            className="studio-input w-full h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label="All" count={counts.all} />
          {STATUS_ORDER.map(s => counts[s] > 0 ? (
            <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} label={STATUS_LABELS[s]} count={counts[s]} />
          ) : null)}
        </div>
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            <button onClick={() => void loadData()} className="text-xs underline" style={{ color: 'var(--accent-base)' }}>Retry</button>
          </div>
        )}
        {!loading && !error && visits.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
              <Ruler className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No site visits yet</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Schedule your first visit using the button above.</p>
          </div>
        )}
        {!loading && !error && visits.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No visits match your filters</p>
            <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className="text-[12px] underline" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {['Date & Time', 'Lead', 'Status', 'Address', 'Photos', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const { date, time } = fmtDateTime(v.scheduledAt);
                  const lead = leadMap.get(v.leadId);
                  const s    = STATUS_STYLES[v.status] ?? STATUS_STYLES.scheduled;
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold tnum" style={{ color: 'var(--text-heading)' }}>{date}</p>
                        <p className="text-[11px] tnum mt-0.5" style={{ color: 'var(--text-secondary)' }}>{time}</p>
                      </td>
                      <td className="px-4 py-3">
                        {lead ? (
                          <Link href={`/leads/${v.leadId}`} className="font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                            {lead.contactName || 'Unknown'}
                          </Link>
                        ) : (
                          <Link href={`/leads/${v.leadId}`} className="text-[12px] font-mono hover:underline" style={{ color: 'var(--text-secondary)' }}>
                            View lead →
                          </Link>
                        )}
                        {lead?.contactPhone && (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border"
                          style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
                          <s.Icon className="h-3 w-3" />
                          {STATUS_LABELS[v.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                          <span className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>{getAddress(v.locationJson)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {v.photos.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            <Camera className="h-3.5 w-3.5" />
                            {v.photos.length}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                          {v.notes || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule visit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule site visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Lead *</label>
              <select
                value={form.leadId}
                onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))}
                className="studio-input h-9 w-full"
              >
                <option value="">Choose a lead…</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.contactName || l.id.slice(0, 8)}{l.city ? ` — ${l.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Date &amp; Time *</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="studio-input h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Address *</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Site address"
                className="studio-input h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Notes <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="What to check, access instructions…"
                rows={2}
                className="studio-input w-full py-2 resize-none"
              />
            </div>
            {submitError && <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{submitError}</p>}
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSchedule}
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />
              {submitting ? 'Scheduling…' : 'Schedule visit'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
