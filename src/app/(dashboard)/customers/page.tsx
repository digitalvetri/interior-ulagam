'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, MoreHorizontal } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { NewCustomerDialog } from '@/components/customers/NewCustomerDialog';
import type { Customer, CustomerStage } from '@/types/customers';

// ─── Enriched row type ────────────────────────────────────────────────────────

interface CustomerRow extends Customer {
  projectCount: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

type ClientStatus = 'Active' | 'Past' | 'Prospect';

function getStatus(stage: CustomerStage): ClientStatus {
  if (stage === 'client')      return 'Active';
  if (stage === 'past_client') return 'Past';
  return 'Prospect';
}

const STATUS_STYLE: Record<ClientStatus, { dot: string; text: string; bg: string }> = {
  Active:   { dot: '#10B981', text: '#065F46', bg: '#ECFDF5' },
  Past:     { dot: '#9CA3AF', text: '#374151', bg: '#F9FAFB' },
  Prospect: { dot: '#F59E0B', text: '#92400E', bg: '#FFFBEB' },
};

// ─── Columns ──────────────────────────────────────────────────────────────────

function makeColumns(onMenu: (row: CustomerRow) => void): Column<CustomerRow>[] {
  return [
    {
      key: 'fullName',
      header: 'Client',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate max-w-[200px]" style={{ color: 'var(--text-heading)' }}>
            {row.fullName}
          </p>
          {row.company && (
            <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
              {row.company}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Mobile',
      render: (row) => (
        <span className="text-[13px] tnum" style={{ color: 'var(--text-secondary)' }}>
          {row.phone}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => (
        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {row.city ?? '—'}
        </span>
      ),
    },
    {
      key: 'projectCount',
      header: 'Projects',
      align: 'right',
      render: (row) => (
        <span className="text-[13px] tnum" style={{ color: row.projectCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {row.projectCount > 0 ? row.projectCount : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s  = getStatus(row.stage);
        const st = STATUS_STYLE[s];
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: st.bg, color: st.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
            {s}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); onMenu(row); }}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ),
    },
  ];
}

// ─── Status filter type ───────────────────────────────────────────────────────

type StatusFilter = 'All' | ClientStatus;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers]   = useState<CustomerRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [dialogOpen, setDialogOpen]     = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadCustomers(); }, [loadCustomers]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const columns = useMemo(
    () => makeColumns((row) => router.push(`/customers/${row.id}`)),
    [router],
  );

  const isEmpty = !loading && !fetchError && customers.length === 0;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Clients</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${customers.length} ${customers.length === 1 ? 'client' : 'clients'} in directory`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add client
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, city…"
            className="studio-input w-full h-9"
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
        <div className="premium-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{fetchError}</p>
          <button onClick={() => void loadCustomers()} className="text-[12px] font-medium underline-offset-4 hover:underline" style={{ color: 'var(--accent-base)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="premium-card flex flex-col items-center justify-center gap-3 p-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
            <Users className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No clients yet</p>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Add your first client to start building your directory.</p>
          <button type="button" onClick={() => setDialogOpen(true)} className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Add client
          </button>
        </div>
      )}

      {/* Table */}
      {!fetchError && !isEmpty && (
        <DataTable<CustomerRow>
          columns={columns}
          rows={filteredCustomers}
          getRowKey={(r) => r.id}
          loading={loading}
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No clients match your search</p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('All'); }}
                className="text-[12px] font-medium"
                style={{ color: 'var(--accent-base)' }}
              >
                Clear filters
              </button>
            </div>
          }
        />
      )}

      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => { void loadCustomers(); }}
      />
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
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
      <span className="tnum text-[11px] font-medium" style={{ color: active ? 'var(--accent-base)' : 'var(--text-secondary)', opacity: active ? 1 : 0.7 }}>
        {count}
      </span>
    </button>
  );
}
