'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, MoreHorizontal, Mail, Phone, Building2, MapPin,
  Trash2, Loader2, Users, UserCheck, Briefcase, Clock,
  Eye, UserCog, ArrowRightLeft, CheckCircle2, X,
} from 'lucide-react';
import { NewCustomerDialog } from '@/components/customers/NewCustomerDialog';
import { GlowOrb } from '@/components/customers/GlowOrb';
import { CustomerQuickPane } from '@/components/customers/CustomerQuickPane';
import type { Customer, CustomerStage } from '@/types/customers';

interface TeamMember { id: string; fullName: string; role: string; }

/* ── Constants ─────────────────────────────────────────────────────────────── */

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead:        'Lead',
  opportunity: 'Opportunity',
  client:      'Client',
  past_client: 'Past client',
};

const STAGE_STYLE: Record<CustomerStage, { bg: string; color: string; dot: string }> = {
  lead:        { bg: 'rgba(100,116,139,0.10)', color: '#475569', dot: '#94a3b8' },
  opportunity: { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', dot: '#f59e0b' },
  client:      { bg: 'rgba(16,185,129,0.12)',  color: '#065f46', dot: '#10b981' },
  past_client: { bg: 'rgba(148,163,184,0.12)', color: '#64748b', dot: '#cbd5e1' },
};

const STAGE_TABS: { value: CustomerStage | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'lead',        label: 'Leads' },
  { value: 'opportunity', label: 'Opportunities' },
  { value: 'client',      label: 'Clients' },
  { value: 'past_client', label: 'Past clients' },
];

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function CustomersPage() {
  const [rows, setRows]         = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [stageFilter, setStage] = useState<CustomerStage | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Bulk modals
  const [assignOwnerOpen, setAssignOwnerOpen]   = useState(false);
  const [changeStageOpen, setChangeStageOpen]   = useState(false);
  const [bulkWorking, setBulkWorking]           = useState(false);
  const [bulkToast, setBulkToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [teamMembers, setTeamMembers]           = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading]           = useState(false);

  /* ── Outside-click closes the row menu ── */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    if (openMenu) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenu]);

  /* ── Data load ── */
  useEffect(() => {
    fetch('/api/v1/customers')
      .then((r) => r.json())
      .then(({ data }: { data: Customer[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ── Toast auto-dismiss ── */
  useEffect(() => {
    if (!bulkToast) return;
    const t = setTimeout(() => setBulkToast(null), 3000);
    return () => clearTimeout(t);
  }, [bulkToast]);

  /* ── Team loader (lazy — only when assign-owner modal opens) ── */
  async function loadTeam() {
    if (teamMembers.length) return;
    setTeamLoading(true);
    try {
      const res = await fetch('/api/v1/employees');
      const { data } = await res.json();
      setTeamMembers(data ?? []);
    } catch { /* silent */ } finally {
      setTeamLoading(false);
    }
  }

  /* ── Bulk assign owner ── */
  async function doAssignOwner(member: TeamMember) {
    const ids = Array.from(selected);
    setAssignOwnerOpen(false);
    setBulkWorking(true);
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/v1/customers/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ownerId: member.id }),
        }),
      ));
      setRows((prev) => prev.map((r) => selected.has(r.id) ? { ...r, ownerId: member.id } : r));
      setSelected(new Set());
      setBulkToast({ msg: `Assigned ${member.fullName} to ${ids.length} customer${ids.length > 1 ? 's' : ''}`, ok: true });
    } catch {
      setBulkToast({ msg: 'Some updates failed. Please try again.', ok: false });
    } finally {
      setBulkWorking(false);
    }
  }

  /* ── Bulk change stage ── */
  async function doChangeStage(stage: CustomerStage) {
    const ids = Array.from(selected);
    setChangeStageOpen(false);
    setBulkWorking(true);
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/v1/customers/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stage }),
        }),
      ));
      setRows((prev) => prev.map((r) => selected.has(r.id) ? { ...r, stage } : r));
      setSelected(new Set());
      setBulkToast({ msg: `Moved ${ids.length} customer${ids.length > 1 ? 's' : ''} to ${STAGE_LABEL[stage]}`, ok: true });
    } catch {
      setBulkToast({ msg: 'Some updates failed. Please try again.', ok: false });
    } finally {
      setBulkWorking(false);
    }
  }

  /* ── Delete helpers ── */
  function deleteOne(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    setDeleteError(null);
    setConfirmDelete({ ids: [id], label: target.fullName });
    setOpenMenu(null);
  }
  function deleteSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setDeleteError(null);
    setConfirmDelete({ ids, label: `${ids.length} customer${ids.length > 1 ? 's' : ''}` });
  }
  async function doConfirmedDelete() {
    if (!confirmDelete) return;
    const { ids } = confirmDelete;
    setDeleting(true);
    setDeleteError(null);
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
      if (failed.length) {
        setDeleteError(`${failed.length} deletion${failed.length > 1 ? 's' : ''} failed. Please try again.`);
      } else {
        setConfirmDelete(null);
      }
    } catch {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  // Stable page-load timestamp for staleness calculation — passed down to rows
  const [nowMs] = useState(Date.now);

  // Quick-pane: resolve the full Customer object from rows so the pane renders instantly
  const selectedCustomer = useMemo(
    () => (selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null),
    [rows, selectedId],
  );

  /* ── Filtered rows ── */
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

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:       rows.length,
    clients:     rows.filter((r) => r.stage === 'client').length,
    leads:       rows.filter((r) => r.stage === 'lead').length,
    past:        rows.filter((r) => r.stage === 'past_client').length,
  }), [rows]);

  /* ── Selection ── */
  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someChecked = filtered.some((r) => selected.has(r.id)) && !allChecked;
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  /* ── Render ── */
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--surface-page, #f8f9fb)' }}>

      {/* ══ Page header ══════════════════════════════════════════════════════ */}
      <div className="px-6 pt-6 pb-4" style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle, #e8eaf0)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading, #1a1d23)' }}>
              Customers
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary, #6b7280)' }}>
              {loading ? 'Loading…' : `${rows.length.toLocaleString()} total contacts`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setDialog(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Create customer
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && rows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} color="#7c5cfc" />
            <StatPill icon={<UserCheck className="h-4 w-4" />} label="Active clients" value={stats.clients} color="#10b981" />
            <StatPill icon={<Briefcase className="h-4 w-4" />} label="Leads" value={stats.leads} color="#f59e0b" />
            <StatPill icon={<Clock className="h-4 w-4" />} label="Past clients" value={stats.past} color="#94a3b8" />
          </div>
        )}
      </div>

      {/* ══ Toolbar ══════════════════════════════════════════════════════════ */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3" style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle, #e8eaf0)' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-secondary, #9ca3af)' }} />
          <input
            type="text"
            placeholder="Search name, phone, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border py-2.5 text-sm outline-none transition-shadow"
            style={{
              paddingLeft: '2.5rem',
              paddingRight: '0.75rem',
              background: 'var(--surface-muted, #f3f4f6)',
              border: '1.5px solid transparent',
              color: 'var(--text-heading)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--violet-primary, #7c5cfc)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-gray-200"
            >
              <Plus className="h-3.5 w-3.5 rotate-45" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Stage filter tabs */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted, #f3f4f6)' }}>
          {STAGE_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? rows.length
              : rows.filter((r) => r.stage === tab.value).length;
            const active = stageFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStage(tab.value)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={active ? {
                  background: 'var(--surface-card, #fff)',
                  color: 'var(--violet-primary, #7c5cfc)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                } : {
                  color: 'var(--text-secondary, #6b7280)',
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: active ? 'rgba(124,92,252,0.12)' : 'rgba(0,0,0,0.06)',
                    color: active ? 'var(--violet-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Bulk action bar ══════════════════════════════════════════════════ */}
      {selected.size > 0 && (
        <div
          className="flex items-center justify-between px-6 py-2.5 text-sm"
          style={{ background: 'rgba(124,92,252,0.08)', borderBottom: '1px solid rgba(124,92,252,0.2)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--violet-primary)' }}>
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAssignOwnerOpen(true); loadTeam(); }}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-violet-100 disabled:opacity-50"
              style={{ color: 'var(--violet-primary)', background: 'rgba(124,92,252,0.08)' }}
            >
              {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
              Assign owner
            </button>
            <button
              onClick={() => setChangeStageOpen(true)}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-violet-100 disabled:opacity-50"
              style={{ color: 'var(--violet-primary)', background: 'rgba(124,92,252,0.08)' }}
            >
              {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
              Change stage
            </button>
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-100 disabled:opacity-50"
              style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)' }}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
              aria-label="Clear selection"
            >
              <Plus className="h-3.5 w-3.5 rotate-45" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      )}

      {/* ══ Table + Quick pane (split layout) ════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* List column */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--violet-primary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading customers…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={search.trim().length > 0 || stageFilter !== 'all'} onCreate={() => setDialog(true)} onClear={() => { setSearch(''); setStage('all'); }} />
          ) : (
            <table className="w-full border-separate select-none" style={{ borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: 'var(--surface-card, #fff)' }}>
                  <th className="sticky top-0 z-10 w-12 px-5 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--violet-primary, #7c5cfc)' }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Name</span>
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)', display: selectedId ? 'none' : undefined }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Company</span>
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Contact</span>
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Stage</span>
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)', display: selectedId ? 'none' : undefined }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>City</span>
                  </th>
                  <th className="sticky top-0 z-10 px-3 py-3 text-left" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)', display: selectedId ? 'none' : undefined }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Added</span>
                  </th>
                  <th className="sticky top-0 z-10 w-24 px-3 py-3 text-right" style={{ background: 'var(--surface-card, #fff)', borderBottom: '2px solid var(--border-subtle, #e8eaf0)' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const checked = selected.has(r.id);
                  const isMenuOpen = openMenu === r.id;
                  const stageSt = STAGE_STYLE[r.stage];
                  return (
                    <CustomerRow
                      key={r.id}
                      r={r}
                      checked={checked}
                      isMenuOpen={isMenuOpen}
                      stageSt={stageSt}
                      isLast={i === filtered.length - 1}
                      nowMs={nowMs}
                      menuRef={isMenuOpen ? menuRef : undefined}
                      animIndex={i}
                      compact={selectedId !== null}
                      isSelected={selectedId === r.id}
                      onToggle={() => toggleOne(r.id)}
                      onOpenMenu={() => setOpenMenu(isMenuOpen ? null : r.id)}
                      onCloseMenu={() => setOpenMenu(null)}
                      onDelete={() => deleteOne(r.id)}
                      onSelect={() => setSelectedId(r.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick-view pane slides in from the right */}
        <AnimatePresence>
          {selectedCustomer && (
            <CustomerQuickPane
              customer={selectedCustomer}
              onClose={() => setSelectedId(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialog}
        onCreated={(c) => setRows((prev) => [c, ...prev])}
      />

      {/* ══ Bulk toast ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {bulkToast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl"
            style={{
              background: bulkToast.ok ? '#065f46' : '#991b1b',
              color: '#fff',
              minWidth: 260,
            }}
          >
            {bulkToast.ok
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              : <X className="h-4 w-4 flex-shrink-0" />}
            {bulkToast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Assign owner modal ═══════════════════════════════════════════════ */}
      {assignOwnerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignOwnerOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
                Assign owner
              </h3>
              <button onClick={() => setAssignOwnerOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Pick a team member to own {selected.size} selected customer{selected.size > 1 ? 's' : ''}.
            </p>
            {teamLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--violet-primary)' }} />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No team members found.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {teamMembers.map((m) => {
                  let hash = 0;
                  for (let i = 0; i < m.fullName.length; i++) hash = (hash * 31 + m.fullName.charCodeAt(i)) & 0xffffffff;
                  const hue = Math.abs(hash) % 360;
                  return (
                    <button
                      key={m.id}
                      onClick={() => doAssignOwner(m)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                    >
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: `hsl(${hue},55%,45%)` }}
                      >
                        {m.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{m.fullName}</p>
                        <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{m.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Change stage modal ═══════════════════════════════════════════════ */}
      {changeStageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setChangeStageOpen(false); }}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
                Change stage
              </h3>
              <button onClick={() => setChangeStageOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Move {selected.size} customer{selected.size > 1 ? 's' : ''} to:
            </p>
            <div className="space-y-2">
              {STAGE_TABS.filter((t) => t.value !== 'all').map((tab) => {
                const st = STAGE_STYLE[tab.value as CustomerStage];
                return (
                  <button
                    key={tab.value}
                    onClick={() => doChangeStage(tab.value as CustomerStage)}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:shadow-sm"
                    style={{ background: st.bg, border: `1.5px solid ${st.dot}40` }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
                    <span className="text-sm font-semibold" style={{ color: st.color }}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete confirmation dialog ═══════════════════════════════════════ */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) { setConfirmDelete(null); setDeleteError(null); } }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
              Delete {confirmDelete.label}?
            </h3>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone. All data associated with {confirmDelete.ids.length === 1 ? 'this customer' : 'these customers'} will be permanently removed.
            </p>
            {deleteError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { setConfirmDelete(null); setDeleteError(null); }}
                disabled={deleting}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doConfirmedDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CustomerRow — extracted to isolate hover state ──────────────────────── */

interface RowProps {
  r: Customer;
  checked: boolean;
  isMenuOpen: boolean;
  stageSt: { bg: string; color: string; dot: string };
  isLast: boolean;
  nowMs: number;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  animIndex: number;
  compact: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

function CustomerRow({ r, checked, isMenuOpen, stageSt, isLast, nowMs, menuRef, animIndex, compact, isSelected, onToggle, onOpenMenu, onCloseMenu, onDelete, onSelect }: RowProps) {
  const [hovered, setHovered] = useState(false);

  const daysSince = r.lastContactedAt
    ? Math.floor((nowMs - new Date(r.lastContactedAt).getTime()) / 86400000)
    : null;
  const dotColor = daysSince === null ? null : daysSince > 21 ? '#ef4444' : daysSince > 7 ? '#f59e0b' : null;

  const cellBorder = isLast ? 'none' : '1px solid var(--border-subtle, #e8eaf0)';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(animIndex * 0.025, 0.4), duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        const interactive = (e.target as HTMLElement).closest(
          'a, button, input, select, textarea, [contenteditable]',
        );
        if (!interactive) e.preventDefault();
      }}
      onClick={(e) => {
        const interactive = (e.target as HTMLElement).closest(
          'a, button, input, select, textarea, [contenteditable]',
        );
        if (!interactive) onSelect();
      }}
      style={{
        background: isSelected
          ? 'rgba(124,92,252,0.08)'
          : checked
          ? 'rgba(124,92,252,0.10)'
          : hovered
          ? 'rgba(124,92,252,0.04)'
          : 'var(--surface-card, #fff)',
        boxShadow: isSelected
          ? 'inset 3px 0 0 var(--violet-primary, #7c5cfc)'
          : checked
          ? 'inset 3px 0 0 var(--violet-primary, #7c5cfc)'
          : 'inset 3px 0 0 transparent',
        cursor: 'default',
        transition: 'background 0.12s, box-shadow 0.12s',
      }}
    >
      {/* Checkbox */}
      <td className="w-12 px-5 py-3.5" style={{ borderBottom: cellBorder }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded cursor-pointer"
          style={{ accentColor: 'var(--violet-primary, #7c5cfc)' }}
          aria-label={`Select ${r.fullName}`}
        />
      </td>

      {/* Name */}
      <td className="px-3 py-3.5" style={{ borderBottom: cellBorder }}>
        <Link
          href={`/customers/${r.id}`}
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar name={r.fullName} dotColor={dotColor} daysSince={daysSince} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold transition-colors" style={{ color: hovered ? 'var(--violet-primary)' : 'var(--text-heading)' }}>
              {r.fullName}
            </p>
            {r.tags?.length > 0 && (
              <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {r.tags.slice(0, 2).join(' · ')}
              </p>
            )}
          </div>
        </Link>
      </td>

      {/* Company — hidden in compact mode */}
      <td className="px-3 py-3.5" style={{ borderBottom: cellBorder, display: compact ? 'none' : undefined }}>
        {r.company ? (
          <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            <span className="max-w-[160px] truncate">{r.company}</span>
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--border-subtle)' }}>—</span>
        )}
      </td>

      {/* Contact */}
      <td className="px-3 py-3.5" style={{ borderBottom: cellBorder }}>
        <div className="flex flex-col gap-0.5">
          <a
            href={`tel:${r.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs font-medium tabular-nums transition-colors hover:text-blue-600 select-text"
            style={{ color: 'var(--text-heading)' }}
          >
            <Phone className="h-3 w-3 flex-shrink-0 text-blue-500" />
            {r.phone}
          </a>
          {r.email && (
            <a
              href={`mailto:${r.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex max-w-[200px] items-center gap-1.5 truncate text-xs transition-colors hover:text-violet-600 select-text"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Mail className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
              {r.email}
            </a>
          )}
        </div>
      </td>

      {/* Stage badge */}
      <td className="px-3 py-3.5" style={{ borderBottom: cellBorder }}>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: stageSt.bg, color: stageSt.color }}
        >
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: stageSt.dot }} />
          {STAGE_LABEL[r.stage]}
        </span>
      </td>

      {/* City — hidden in compact mode */}
      <td className="px-3 py-3.5" style={{ borderBottom: cellBorder, display: compact ? 'none' : undefined }}>
        {r.city ? (
          <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            {r.city}
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--border-subtle)' }}>—</span>
        )}
      </td>

      {/* Created date — hidden in compact mode */}
      <td
        className="px-3 py-3.5 text-sm tabular-nums"
        style={{ borderBottom: cellBorder, color: 'var(--text-secondary)', display: compact ? 'none' : undefined }}
      >
        {new Date(r.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </td>

      {/* Actions */}
      <td className="relative px-3 py-3.5 text-right" style={{ borderBottom: cellBorder }}>
        <div className="flex items-center justify-end gap-1">
          {/* Quick-view button — opens the slide-in pane */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
            style={{
              opacity: hovered || isMenuOpen ? 1 : 0,
              background: isSelected ? 'rgba(124,92,252,0.12)' : 'var(--surface-muted, #f3f4f6)',
              color: isSelected ? 'var(--violet-primary)' : 'var(--text-heading)',
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>

          {/* More menu trigger */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
              style={{
                opacity: hovered || isMenuOpen ? 1 : 0,
                background: isMenuOpen ? 'var(--surface-muted)' : 'transparent',
                color: 'var(--text-secondary)',
              }}
              aria-label="Row actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isMenuOpen && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl py-1 text-left text-sm shadow-xl"
                style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
              >
                <Link
                  href={`/customers/${r.id}`}
                  onClick={(e) => { e.stopPropagation(); onCloseMenu(); }}
                  className="flex items-center gap-2.5 px-3 py-2 font-medium transition-colors hover:bg-gray-50"
                  style={{ color: 'var(--text-heading)' }}
                >
                  <Eye className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  View & edit
                </Link>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 font-medium transition-colors hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete customer
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

function Avatar({ name, dotColor, daysSince }: { name: string; dotColor: string | null; daysSince: number | null }) {
  const initials = name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]!.toUpperCase()).join('');
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;

  return (
    <span className="relative flex-shrink-0" aria-hidden="true">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
      >
        {initials || '?'}
      </span>
      {dotColor && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ background: dotColor }}
          title={daysSince !== null ? `Last contacted ${daysSince}d ago` : undefined}
        />
      )}
    </span>
  );
}

/* ── StatPill ───────────────────────────────────────────────────────────── */

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      {/* Animated Three.js orb — decorative background glow */}
      <div
        className="pointer-events-none absolute -right-5 -top-5 opacity-[0.22]"
        aria-hidden="true"
      >
        <GlowOrb color={color} size={80} />
      </div>

      <span
        className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </span>
      <div className="relative">
        <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-heading)' }}>{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────────────── */

function EmptyState({ hasQuery, onCreate, onClear }: { hasQuery: boolean; onCreate: () => void; onClear: () => void }) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <Search className="h-7 w-7" style={{ color: 'var(--text-secondary)' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No customers match your filters</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try adjusting your search or filter criteria</p>
        <button
          onClick={onClear}
          className="mt-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ background: 'var(--violet-primary)', color: '#fff' }}
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,92,252,0.08)' }}>
        <Users className="h-8 w-8" style={{ color: 'var(--violet-primary)' }} />
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No customers yet</p>
      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Add your first customer to start tracking contacts, jobs and revenue.
      </p>
      <button
        onClick={onCreate}
        className="mt-2 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-90"
        style={{ background: 'var(--violet-primary)', color: '#fff' }}
      >
        <Plus className="h-4 w-4" />
        Create customer
      </button>
    </div>
  );
}
