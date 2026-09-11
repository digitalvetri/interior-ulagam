'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, MoreHorizontal, ExternalLink } from 'lucide-react';
import { NewCustomerDialog } from '@/components/customers/NewCustomerDialog';
import type { Customer, CustomerStage } from '@/types/customers';

interface CustomerRow extends Customer {
  projectCount: number;
}

type ClientStatus = 'Active' | 'Past' | 'Prospect';
type StatusFilter = 'All' | ClientStatus;

function getStatus(stage: CustomerStage): ClientStatus {
  if (stage === 'client')      return 'Active';
  if (stage === 'past_client') return 'Past';
  return 'Prospect';
}

const STATUS_STYLE: Record<ClientStatus, { dot: string; text: string; bg: string }> = {
  Active:   { dot: '#10B981', text: '#065F46', bg: '#ECFDF5' },
  Past:     { dot: '#9CA3AF', text: '#374151', bg: '#F3F4F6' },
  Prospect: { dot: '#F59E0B', text: '#92400E', bg: '#FFFBEB' },
};

// Initials avatar
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}
    >
      {initials}
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers]   = useState<CustomerRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const res  = await fetch('/api/v1/customers');
      const json = await res.json() as { data: CustomerRow[] };
      setCustomers(json.data ?? []);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (statusFilter !== 'All' && getStatus(c.stage) !== statusFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  const statusCounts = useMemo<Record<StatusFilter, number>>(() => ({
    All:      customers.length,
    Active:   customers.filter(c => getStatus(c.stage) === 'Active').length,
    Past:     customers.filter(c => getStatus(c.stage) === 'Past').length,
    Prospect: customers.filter(c => getStatus(c.stage) === 'Prospect').length,
  }), [customers]);

  const isEmpty = !loading && !fetchError && customers.length === 0;

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--surface-muted)' }}>
      <div className="px-6 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>
              {loading ? '…' : `${customers.length} ${customers.length === 1 ? 'client' : 'clients'}`}
              {statusFilter !== 'All' && ` · ${statusFilter}`}
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
              Client 360
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent-base, #0D7F6E)', color: '#fff' }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Client
          </button>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, mobile, email, city…"
              className="studio-input w-full h-10"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['All', 'Active', 'Past', 'Prospect'] as StatusFilter[]).map(s => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                label={s}
                count={statusCounts[s]}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {fetchError && (
          <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm font-medium text-red-600">{fetchError}</p>
            <button onClick={() => void loadCustomers()} className="mt-2 text-xs font-medium underline-offset-4 hover:underline" style={{ color: 'var(--accent-base)' }}>
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl flex flex-col items-center justify-center gap-3 p-16 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
              <Users className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No clients yet</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Add your first client to start building your directory.</p>
            </div>
            <button type="button" onClick={() => setDialogOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--accent-base, #0D7F6E)', color: '#fff' }}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Client
            </button>
          </div>
        )}

        {/* Table */}
        {!fetchError && !isEmpty && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            {/* Table header */}
            <div
              className="grid text-[11px] font-bold uppercase tracking-widest px-5 py-3"
              style={{
                gridTemplateColumns: '1fr 160px 140px 90px 110px 40px',
                color: 'var(--text-tertiary)',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--surface-muted)',
              }}
            >
              <span>Client</span>
              <span>Mobile</span>
              <span>City</span>
              <span className="text-right">Projects</span>
              <span>Status</span>
              <span />
            </div>

            {/* Rows */}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading…
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No clients match your search</p>
                <button
                  onClick={() => { setSearch(''); setStatusFilter('All'); }}
                  className="text-xs font-medium"
                  style={{ color: 'var(--accent-base)' }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {filteredCustomers.map(row => {
                  const s  = getStatus(row.stage);
                  const st = STATUS_STYLE[s];
                  return (
                    <li
                      key={row.id}
                      onClick={() => router.push(`/customers/${row.id}`)}
                      className="grid items-center px-5 py-3.5 cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ gridTemplateColumns: '1fr 160px 140px 90px 110px 40px' }}
                    >
                      {/* Name + avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={row.fullName} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                            {row.fullName}
                          </p>
                          {row.company && (
                            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.company}</p>
                          )}
                          {row.email && !row.company && (
                            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Phone */}
                      <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {row.phone}
                      </span>

                      {/* City */}
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {row.city ?? '—'}
                      </span>

                      {/* Projects */}
                      <span className="text-sm tabular-nums text-right pr-4" style={{ color: row.projectCount > 0 ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                        {row.projectCount > 0 ? row.projectCount : '—'}
                      </span>

                      {/* Status badge */}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold w-fit"
                        style={{ background: st.bg, color: st.text }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
                        {s}
                      </span>

                      {/* Action */}
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/customers/${row.id}`); }}
                        className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

      </div>

      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => { void loadCustomers(); }}
      />
    </div>
  );
}

function FilterChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent-base)', borderColor: 'var(--accent-base)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span
        className="text-[11px] font-bold"
        style={{ color: active ? 'var(--accent-base)' : 'var(--text-tertiary)' }}
      >
        {count}
      </span>
    </button>
  );
}
