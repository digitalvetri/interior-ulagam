'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Filter, ChevronDown, MoreHorizontal, Mail, Phone, Building2, MapPin,
  Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewCustomerDialog } from '@/components/customers/NewCustomerDialog';
import type { Customer, CustomerStage } from '@/types/customers';

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  client: 'Client',
  past_client: 'Past client',
};

const STAGE_CLASSES: Record<CustomerStage, string> = {
  lead:        'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  opportunity: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  client:      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  past_client: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
};

export default function CustomersPage() {
  const [rows, setRows]         = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [stageFilter, setStage] = useState<CustomerStage | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    if (openMenu) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenu]);

  async function deleteOne(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (!confirm(`Delete ${target.fullName}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => {
        const next = new Set(prev); next.delete(id); return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setOpenMenu(null);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} customer${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/v1/customers/${id}`, { method: 'DELETE' })),
      );
      const failed = results
        .map((r, i) => (r.status === 'fulfilled' && (r.value as Response).ok ? null : ids[i]))
        .filter(Boolean) as string[];
      const deletedIds = new Set(ids.filter((id) => !failed.includes(id)));
      setRows((prev) => prev.filter((r) => !deletedIds.has(r.id)));
      setSelected(new Set());
      if (failed.length) alert(`${failed.length} deletion${failed.length > 1 ? 's' : ''} failed.`);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    fetch('/api/v1/customers')
      .then((r) => r.json())
      .then(({ data }: { data: Customer[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.company ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, stageFilter]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ─── Top bar ────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Customers</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {loading ? 'Loading…' : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} customers`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            Actions <ChevronDown className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setDialog(true)} className="gap-1.5 bg-orange-600 text-white hover:bg-orange-700">
            <Plus className="h-4 w-4" /> Create customer
          </Button>
        </div>
      </header>

      {/* ─── Filter row ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, phone, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
          {(['all', 'lead', 'opportunity', 'client', 'past_client'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={
                'rounded px-2.5 py-1 font-medium transition-colors ' +
                (stageFilter === s
                  ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {s === 'all' ? 'All' : STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" /> More filters
        </Button>
      </div>

      {/* ─── Bulk-action bar (only when rows selected) ──────────── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled>Assign owner</Button>
            <Button variant="ghost" size="sm" disabled>Change stage</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteSelected}
              disabled={deleting}
              className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* ─── Table ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading customers…</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={search.trim().length > 0} onCreate={() => setDialog(true)} />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold">Name</th>
                <th className="px-3 py-3 text-left font-semibold">Company</th>
                <th className="px-3 py-3 text-left font-semibold">Email</th>
                <th className="px-3 py-3 text-left font-semibold">Phone</th>
                <th className="px-3 py-3 text-left font-semibold">Stage</th>
                <th className="px-3 py-3 text-left font-semibold">City</th>
                <th className="px-3 py-3 text-left font-semibold">Created</th>
                <th className="w-12 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const checked = selected.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={
                      'border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900 ' +
                      (checked ? 'bg-orange-50/40 dark:bg-orange-950/20' : '')
                    }
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        aria-label={`Select ${r.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/customers/${r.id}`}
                        className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-orange-600 dark:text-slate-50 dark:hover:text-orange-400"
                      >
                        <Avatar name={r.fullName} />
                        <span>{r.fullName}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {r.company ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {r.company}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {r.email ? (
                        <a
                          href={`mailto:${r.email}`}
                          className="inline-flex items-center gap-1.5 hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate max-w-[220px]">{r.email}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1.5 tabular-nums hover:text-orange-600 dark:hover:text-orange-400"
                      >
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' +
                        STAGE_CLASSES[r.stage]
                      }>
                        {STAGE_LABEL[r.stage]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {r.city ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {r.city}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 tabular-nums">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="relative px-3 py-2.5 text-right">
                      <button
                        onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        aria-label="Row actions"
                        aria-haspopup="menu"
                        aria-expanded={openMenu === r.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === r.id && (
                        <div
                          ref={menuRef}
                          role="menu"
                          className="absolute right-4 top-9 z-20 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
                        >
                          <Link
                            href={`/customers/${r.id}`}
                            className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            View & edit
                          </Link>
                          <button
                            onClick={() => deleteOne(r.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialog}
        onCreated={(c) => setRows((prev) => [c, ...prev])}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  // Deterministic hue from name so each avatar keeps a stable colour
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

function EmptyState({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  if (hasQuery) {
    return (
      <div className="p-16 text-center">
        <p className="text-sm text-slate-500">No customers match your search.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
        <Plus className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
        No customers yet
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Add your first customer to start tracking contacts, jobs and revenue.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-1.5 bg-orange-600 text-white hover:bg-orange-700">
        <Plus className="h-4 w-4" /> Create customer
      </Button>
    </div>
  );
}
