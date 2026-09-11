'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, MoreHorizontal } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
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

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}
    >
      {initials}
    </div>
  );
}

function makeColumns(onMenu: (row: CustomerRow) => void): Column<CustomerRow>[] {
  return [
    {
      key: 'fullName',
      header: 'Client',
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={row.fullName} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate max-w-[220px]" style={{ color: 'var(--text-heading)' }}>
              {row.fullName}
            </p>
            {(row.company || row.email) && (
              <p className="text-[11px] truncate max-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
                {row.company ?? row.email}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Mobile',
      render: (row) => (
        <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {row.phone}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {row.city ?? '—'}
        </span>
      ),
    },
    {
      key: 'projectCount',
      header: 'Projects',
      align: 'right',
      render: (row) => (
        <span className="text-sm tabular-nums" style={{ color: row.projectCount > 0 ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
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
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
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
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ),
    },
  ];
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

  const columns = useMemo(
    () => makeColumns((row) => router.push(`/customers/${row.id}`)),
    [router],
  );

  const isEmpty = !loading && !fetchError && customers.length === 0;

  return (
    <div className="space-y-6 p-6 lg:p-8">

      {/* Page header */}
      <div className="flex items-end justify-between gap-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, city…"
            className="studio-input w-full h-9"
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
        <div className="premium-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-sm font-medium text-red-600">{fetchError}</p>
          <button onClick={() => void loadCustomers()} className="text-xs font-medium underline-offset-4 hover:underline" style={{ color: 'var(--accent-base)' }}>
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
        <DataTable<CustomerRow>
          columns={columns}
          rows={filteredCustomers}
          getRowKey={(r) => r.id}
          loading={loading}
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
          emptyState={
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
