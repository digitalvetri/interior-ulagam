'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Grid3x3, List, Mail, Phone, MapPin, Briefcase, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeeAvatar } from '@/components/employees/Avatar';
import { NewEmployeeDialog } from '@/components/employees/NewEmployeeDialog';
import type { Employee, EmploymentType } from '@/types/employees';

type ViewMode = 'grid' | 'list';

const TYPE_LABEL: Record<EmploymentType, string> = {
  full_time:  'Full-time',
  part_time:  'Part-time',
  contract:   'Contract',
  intern:     'Intern',
  consultant: 'Consultant',
};

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  on_leave: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  inactive: 'bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-1 ring-inset ring-slate-200 dark:ring-slate-700',
};

export default function EmployeesPage() {
  const [rows, setRows]         = useState<Employee[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<ViewMode>('grid');
  const [search, setSearch]     = useState('');
  const [dept, setDept]         = useState<string>('all');
  const [dialogOpen, setDialog] = useState(false);

  useEffect(() => {
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then(({ data }: { data: Employee[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.department && set.add(r.department));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== 'all' && r.department !== dept) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q) ||
        (r.jobTitle ?? '').toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, dept]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header strip */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4 ">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>People</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} employees`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialog(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add employee
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-3 ">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="studio-search-icon" />
          <Input
            placeholder="Search name, email, job title, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-[48px]"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 text-xs ">
          <button
            onClick={() => setDept('all')}
            className={
              'rounded px-2.5 py-1 font-medium ' +
              (dept === 'all'
                ? 'bg-[var(--accent-base)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
            }
          >
            All
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={
                'rounded px-2.5 py-1 font-medium ' +
                (dept === d
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
              }
            >
              {d}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 ">
          <button
            onClick={() => setView('grid')}
            className={
              'rounded px-2 py-1 ' +
              (view === 'grid'
                ? 'bg-[var(--surface-card)] text-white '
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
            }
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={
              'rounded px-2 py-1 ' +
              (view === 'list'
                ? 'bg-[var(--surface-card)] text-white '
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
            }
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Loading employees…</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={search.trim().length > 0 || dept !== 'all'} onAdd={() => setDialog(true)} />
        ) : view === 'grid' ? (
          <GridView rows={filtered} />
        ) : (
          <ListView rows={filtered} />
        )}
      </div>

      <NewEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialog}
        onCreated={(row) => setRows((prev) => [row, ...prev])}
      />
    </div>
  );
}

// ─── Grid view ────────────────────────────────────────────────────────────────

function GridView({ rows }: { rows: Employee[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/employees/${r.id}`}
          className="group flex flex-col items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md "
        >
          <EmployeeAvatar name={r.fullName} photoUrl={r.photoUrl} size={72} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
              {r.fullName}
            </h3>
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
              {r.jobTitle ?? '—'}
            </p>
            {r.department && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Briefcase className="h-2.5 w-2.5" /> {r.department}
              </span>
            )}
          </div>
          <div className="mt-1 flex w-full items-center justify-around border-t border-[var(--border-subtle)] pt-3 text-[var(--text-tertiary)] ">
            {r.email && (
              <span title={r.email} className="rounded p-1 transition-colors group-hover:text-emerald-600">
                <Mail className="h-4 w-4" />
              </span>
            )}
            {r.phone && (
              <span title={r.phone} className="rounded p-1 transition-colors group-hover:text-emerald-600">
                <Phone className="h-4 w-4" />
              </span>
            )}
            {r.location && (
              <span title={r.location} className="rounded p-1 transition-colors group-hover:text-emerald-600">
                <MapPin className="h-4 w-4" />
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ rows }: { rows: Employee[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] ">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-secondary)] ">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Name</th>
            <th className="px-3 py-3 text-left font-semibold">Job title</th>
            <th className="px-3 py-3 text-left font-semibold">Department</th>
            <th className="px-3 py-3 text-left font-semibold">Type</th>
            <th className="px-3 py-3 text-left font-semibold">Email</th>
            <th className="px-3 py-3 text-left font-semibold">Phone</th>
            <th className="px-3 py-3 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-muted)]">
              <td className="px-4 py-2.5">
                <Link href={`/employees/${r.id}`} className="flex items-center gap-3 font-medium hover:text-emerald-600" style={{ color: 'var(--text-heading)' }}>
                  <EmployeeAvatar name={r.fullName} photoUrl={r.photoUrl} size={32} />
                  {r.fullName}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] ">{r.jobTitle ?? '—'}</td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] ">{r.department ?? '—'}</td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] ">{r.employmentType ? TYPE_LABEL[r.employmentType] : '—'}</td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] ">
                {r.email ? <a href={`mailto:${r.email}`} className="hover:text-emerald-600">{r.email}</a> : '—'}
              </td>
              <td className="px-3 py-2.5 text-[var(--text-secondary)] tabular-nums ">{r.phone ?? '—'}</td>
              <td className="px-3 py-2.5">
                <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ' + (STATUS_STYLES[r.status] ?? STATUS_STYLES.active)}>
                  {r.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
            </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasQuery, onAdd }: { hasQuery: boolean; onAdd: () => void }) {
  if (hasQuery) {
    return (
      <div className="p-16 text-center text-sm text-[var(--text-secondary)]">
        No employees match your filters.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Plus className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
        No employees yet
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Add your team — designers, supervisors, accountants — to manage roles and access.
      </p>
      <Button onClick={onAdd} className="mt-5 gap-1.5">
        <Plus className="h-4 w-4" /> Add first employee
      </Button>
    </div>
  );
}
