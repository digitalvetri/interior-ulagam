'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Plus, Search, Check, Calendar, Circle, CircleDot, Eye, CheckCircle2,
  MoreHorizontal, Trash2, Loader2, Edit2, ClipboardList, AlertCircle,
  Folder, User, Users, Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DesignTask, DesignTaskPriority, DesignTaskStatus } from '@/types/design-tasks';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const STATUSES: { value: DesignTaskStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: 'todo',        label: 'To do',       icon: Circle,       color: 'text-[var(--text-tertiary)]' },
  { value: 'in_progress', label: 'In progress', icon: CircleDot,    color: 'text-blue-500'               },
  { value: 'review',      label: 'In review',   icon: Eye,          color: 'text-violet-500'             },
  { value: 'done',        label: 'Done',        icon: CheckCircle2, color: 'text-emerald-500'            },
];

const PRIORITY_CONFIG: Record<DesignTaskPriority, { label: string; bg: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', dot: '#dc2626' },
  high:   { label: 'High',   bg: 'rgba(245,158,11,0.10)',  color: '#d97706', dot: '#d97706' },
  normal: { label: 'Normal', bg: 'rgba(59,130,246,0.10)',  color: '#2563eb', dot: '#2563eb' },
  low:    { label: 'Low',    bg: 'rgba(100,116,139,0.10)', color: '#64748b', dot: '#94a3b8' },
};

const PROGRESS: Record<DesignTaskStatus, number> = {
  todo: 0, in_progress: 40, review: 75, done: 100,
};

function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function getDueDaysInfo(dueDate: string, status: DesignTaskStatus): { label: string; color: string } | null {
  if (status === 'done') return null;
  const target = new Date(dueDate + 'T00:00:00');
  const today = startOfToday();
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, color: 'var(--danger, #dc2626)' };
  if (days === 0) return { label: 'Due today', color: 'var(--warning, #d97706)' };
  if (days <= 3) return { label: `${days}d left`, color: 'var(--warning, #d97706)' };
  return { label: `${days}d left`, color: 'var(--text-secondary)' };
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function DesignTasksPage() {
  const [rows, setRows]             = useState<DesignTask[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState<DesignTaskStatus | 'all'>('all');
  const [priorityFilter, setPriority] = useState<DesignTaskPriority | 'all'>('all');
  const [designerFilter, setDesigner] = useState<string>('all');
  const [dialogOpen, setDialog]     = useState(false);
  const [editTask, setEditTask]     = useState<DesignTask | null>(null);
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const [employees, setEmployees]   = useState<{ id: string; fullName: string }[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [today] = useState(startOfToday);

  /* ── Data ── */
  const refetch = useCallback(() => {
    fetch('/api/v1/design-tasks')
      .then((r) => r.json())
      .then(({ data }: { data: DesignTask[] | null }) => { setRows(data ?? []); setLoading(false); })
      .catch(() => { setLoadError('Could not load tasks. Please refresh.'); setLoading(false); });
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then(({ data }: { data: { id: string; fullName: string }[] | null }) => setEmployees(data ?? []))
      .catch(() => {});
  }, []);

  /* ── Outside click closes menu ── */
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    if (openMenu) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenu]);

  /* ── Derived state ── */
  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e.fullName])),
    [employees],
  );

  const taskDesigners = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const r of rows) {
      for (const id of r.designerIds ?? []) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push({ id, name: employeeMap.get(id) ?? id });
        }
      }
    }
    return result;
  }, [rows, employeeMap]);

  const counts = useMemo(() => {
    const c = { all: rows.length, todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0 };
    for (const r of rows) {
      c[r.status]++;
      if (r.status !== 'done' && r.dueDate && new Date(r.dueDate + 'T00:00:00') < today) c.overdue++;
    }
    return c;
  }, [rows, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      if (designerFilter !== 'all' && !(r.designerIds ?? []).includes(designerFilter)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.projectName ?? '').toLowerCase().includes(q) ||
        (r.customerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, priorityFilter, designerFilter]);

  /* ── Actions ── */
  async function cycleStatus(task: DesignTask) {
    const order: DesignTaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    setRows((prev) => prev.map((r) => r.id === task.id ? { ...r, status: next } : r));
    try {
      const res = await fetch(`/api/v1/design-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('update failed');
      const { data } = await res.json();
      // Preserve joined fields the PATCH response doesn't return
      setRows((prev) => prev.map((r) => r.id === task.id
        ? { ...data, projectName: task.projectName, customerName: task.customerName, designerIds: task.designerIds }
        : r,
      ));
    } catch {
      setRows((prev) => prev.map((r) => r.id === task.id ? task : r));
    }
  }

  async function remove(task: DesignTask) {
    setOpenMenu(null);
    if (!confirm(`Delete "${task.title}"?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== task.id));
    const res = await fetch(`/api/v1/design-tasks/${task.id}`, { method: 'DELETE' });
    if (!res.ok) setRows((prev) => [task, ...prev]);
  }

  function clearFilters() {
    setSearch(''); setStatus('all'); setPriority('all'); setDesigner('all');
  }

  const hasFilters = search.trim().length > 0 || statusFilter !== 'all' || priorityFilter !== 'all' || designerFilter !== 'all';

  /* ── Render ── */
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--surface-page, #f8f9fb)' }}>

      {/* ══ Header ══════════════════════════════════════════════════════════ */}
      <header className="px-6 pt-6 pb-4" style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Design Tasks</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : `${filtered.length} of ${rows.length} tasks`}
            </p>
          </div>
          <Button size="sm" onClick={() => setDialog(true)} className="btn-primary gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl">
            <Plus className="h-4 w-4" /> New task
          </Button>
        </div>

        {/* Summary stats */}
        {!loading && rows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatPill icon={<ClipboardList className="h-4 w-4" />} label="Total"       value={counts.all}         color="var(--violet-primary, #7c5cfc)" />
            <StatPill icon={<Circle        className="h-4 w-4" />} label="To Do"        value={counts.todo}        color="#94a3b8" />
            <StatPill icon={<CircleDot     className="h-4 w-4" />} label="In Progress"  value={counts.in_progress} color="#3b82f6" />
            <StatPill icon={<CheckCircle2  className="h-4 w-4" />} label="Completed"    value={counts.done}        color="var(--success, #10b981)" />
            <StatPill icon={<AlertCircle   className="h-4 w-4" />} label="Overdue"      value={counts.overdue}     color="var(--danger, #dc2626)" />
          </div>
        )}
      </header>

      {/* ══ Filter bar ══════════════════════════════════════════════════════ */}
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-3"
        style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search task, project, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl py-2.5 text-sm outline-none transition-[border-color]"
            style={{
              paddingLeft: '2.5rem', paddingRight: '0.75rem',
              background: 'var(--surface-muted)',
              border: '1.5px solid transparent',
              color: 'var(--text-heading)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--violet-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)' }}>
          {(['all', 'todo', 'in_progress', 'review', 'done'] as const).map((s) => {
            const label = s === 'all' ? 'All' : STATUSES.find((x) => x.value === s)!.label;
            const count = s === 'all' ? counts.all : counts[s as DesignTaskStatus];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ color: active ? 'var(--violet-primary)' : 'var(--text-secondary)' }}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'var(--surface-card, #fff)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                  />
                )}
                <span className="relative">{label}</span>
                <span
                  className="relative rounded-full px-1.5 py-0.5 text-[10px] font-bold"
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

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriority(e.target.value as DesignTaskPriority | 'all')}
          className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          style={{
            background: 'var(--surface-muted)',
            border: '1.5px solid transparent',
            color: priorityFilter === 'all' ? 'var(--text-secondary)' : PRIORITY_CONFIG[priorityFilter as DesignTaskPriority].color,
          }}
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        {/* Designer filter — only if tasks have designer data */}
        {taskDesigners.length > 0 && (
          <select
            value={designerFilter}
            onChange={(e) => setDesigner(e.target.value)}
            className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold outline-none"
            style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--text-secondary)' }}
          >
            <option value="all">All designers</option>
            {taskDesigners.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ══ Task list ════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-auto p-6">
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--violet-primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={hasFilters} onCreate={() => setDialog(true)} onClear={clearFilters} />
        ) : (
          <ul className="mx-auto w-[95%] space-y-2.5">
            {filtered.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                employeeMap={employeeMap}
                isMenuOpen={openMenu === t.id}
                menuRef={openMenu === t.id ? menuRef : undefined}
                onCycleStatus={() => cycleStatus(t)}
                onEdit={() => setEditTask(t)}
                onDelete={() => remove(t)}
                onOpenMenu={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                onCloseMenu={() => setOpenMenu(null)}
              />
            ))}
          </ul>
        )}
      </div>

      <NewTaskDialog
        open={dialogOpen}
        onOpenChange={setDialog}
        onCreated={() => refetch()}
      />

      {editTask && (
        <EditTaskDialog
          task={editTask}
          onOpenChange={(o) => { if (!o) setEditTask(null); }}
          onUpdated={(updated) => {
            setRows((prev) => prev.map((r) => r.id === updated.id
              ? { ...updated, projectName: r.projectName, customerName: r.customerName, designerIds: r.designerIds }
              : r,
            ));
            setEditTask(null);
          }}
        />
      )}
    </div>
  );
}

/* ── TaskCard ───────────────────────────────────────────────────────────────── */

interface TaskCardProps {
  task: DesignTask;
  employeeMap: Map<string, string>;
  isMenuOpen: boolean;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  onCycleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
}

function TaskCard({ task, employeeMap, isMenuOpen, menuRef, onCycleStatus, onEdit, onDelete, onOpenMenu, onCloseMenu }: TaskCardProps) {
  const status = STATUSES.find((s) => s.value === task.status)!;
  const StatusIcon = status.icon;
  const progress = PROGRESS[task.status];
  const priority = PRIORITY_CONFIG[task.priority];
  const daysInfo = task.dueDate ? getDueDaysInfo(task.dueDate, task.status) : null;
  const designerNames = (task.designerIds ?? []).map((id) => employeeMap.get(id) ?? null).filter(Boolean) as string[];

  const progressColor =
    progress === 100 ? 'var(--success, #10b981)' :
    progress >= 75   ? 'var(--violet-primary, #7c5cfc)' :
    progress > 0     ? '#3b82f6' :
    'var(--border-subtle)';

  return (
    <li className="group relative rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card,#fff)] p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">

        {/* Status button — click to cycle */}
        <button
          onClick={onCycleStatus}
          title={`Status: ${status.label} (click to advance)`}
          className={`mt-0.5 flex-shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-muted)] ${status.color}`}
        >
          <StatusIcon className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">

          {/* Row 1: Title + Priority + Due + Actions */}
          <div className="flex items-start justify-between gap-3">
            <p
              className={`text-sm font-semibold leading-snug ${task.status === 'done' ? 'text-[var(--text-tertiary)] line-through' : ''}`}
              style={{ color: task.status === 'done' ? undefined : 'var(--text-heading)' }}
            >
              {task.title}
            </p>

            <div className="flex flex-shrink-0 items-center gap-2">
              {/* Priority badge */}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: priority.bg, color: priority.color }}
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: priority.dot }} />
                {priority.label}
              </span>

              {/* Due date + days label */}
              {task.dueDate && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: daysInfo?.color ?? 'var(--text-secondary)' }}
                >
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  {daysInfo && <span className="text-[10px]">· {daysInfo.label}</span>}
                </span>
              )}

              {/* Edit icon (visible on hover) */}
              <button
                onClick={onEdit}
                title="Edit task"
                className="rounded p-1 opacity-0 transition-all hover:bg-[var(--surface-muted)] group-hover:opacity-100"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>

              {/* Three-dot menu */}
              <div className="relative">
                <button
                  onClick={onOpenMenu}
                  className="rounded p-1 opacity-0 transition-all hover:bg-[var(--surface-muted)] group-hover:opacity-100"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    role="menu"
                    className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card,#fff)] py-1 text-left text-xs shadow-xl"
                  >
                    <button
                      onClick={() => { onCloseMenu(); onCycleStatus(); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 font-medium transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ color: 'var(--text-heading)' }}
                    >
                      <Flag className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                      Advance status
                    </button>
                    <button
                      onClick={() => { onCloseMenu(); onEdit(); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 font-medium transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ color: 'var(--text-heading)' }}
                    >
                      <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                      Edit task
                    </button>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                    <button
                      onClick={onDelete}
                      className="flex w-full items-center gap-2.5 px-3 py-2 font-medium transition-colors hover:bg-red-50"
                      style={{ color: 'var(--danger, #dc2626)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Project / Customer / Designer */}
          {(task.projectName || task.customerName || designerNames.length > 0) && (
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {task.projectName && (
                <span className="flex items-center gap-1">
                  <Folder className="h-3 w-3 flex-shrink-0" />
                  {task.projectName}
                </span>
              )}
              {task.customerName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 flex-shrink-0" />
                  {task.customerName}
                </span>
              )}
              {designerNames.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 flex-shrink-0" />
                  {designerNames.join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Row 3: Progress bar */}
          <div className="mt-3 flex items-center gap-2.5">
            <div
              className="flex-1 h-1.5 overflow-hidden rounded-full"
              style={{ background: 'var(--surface-muted)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${progress}%`, background: progressColor }}
              />
            </div>
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: 'var(--text-secondary)', minWidth: '2.2rem' }}
            >
              {progress}%
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {status.label}
            </span>
          </div>

        </div>
      </div>
    </li>
  );
}

/* ── StatPill ───────────────────────────────────────────────────────────────── */

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: 'var(--surface-card, #fff)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none tabular-nums" style={{ color: 'var(--text-heading)' }}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────────────────── */

function EmptyState({ hasQuery, onCreate, onClear }: { hasQuery: boolean; onCreate: () => void; onClear: () => void }) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <Search className="h-7 w-7" style={{ color: 'var(--text-secondary)' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No tasks match your filters</p>
        <button
          onClick={onClear}
          className="mt-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ background: 'var(--violet-primary)', color: '#fff' }}
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-16 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'rgba(124,92,252,0.1)', color: 'var(--violet-primary)' }}
      >
        <Plus className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>No design tasks yet</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Add tasks like &quot;Send 3D render revision&quot; or &quot;Approve moodboard for Project Y&quot;.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-1.5">
        <Plus className="h-4 w-4" /> Add first task
      </Button>
    </div>
  );
}

/* ── NewTaskDialog ──────────────────────────────────────────────────────────── */

function NewTaskDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [priority, setPri]          = useState<DesignTaskPriority>('normal');
  const [status, setStat]           = useState<DesignTaskStatus>('todo');
  const [dueDate, setDue]           = useState('');
  const [projectId, setProject]     = useState('');
  const [projects, setProjects]     = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then((res) => setProjects(res.data ?? []))
      .catch(() => {});
  }, [open]);

  function reset() {
    setTitle(''); setDesc(''); setPri('normal'); setStat('todo');
    setDue(''); setProject(''); setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/design-tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority, status,
          dueDate: dueDate || undefined,
          projectId: projectId || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New design task</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dt-title">Title *</Label>
            <Input id="dt-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dt-desc">Description</Label>
            <Textarea id="dt-desc" rows={3} value={description} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStat(v as DesignTaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPri(v as DesignTaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-due">Due date</Label>
              <Input id="dt-due" type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProject}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || '(untitled)'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── EditTaskDialog ─────────────────────────────────────────────────────────── */

function EditTaskDialog({
  task, onOpenChange, onUpdated,
}: {
  task: DesignTask;
  onOpenChange: (open: boolean) => void;
  onUpdated: (t: DesignTask) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [title, setTitle]           = useState(task.title);
  const [description, setDesc]      = useState(task.description ?? '');
  const [priority, setPri]          = useState<DesignTaskPriority>(task.priority);
  const [status, setStat]           = useState<DesignTaskStatus>(task.status);
  const [dueDate, setDue]           = useState(task.dueDate ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/design-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority, status,
          dueDate: dueDate || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      onUpdated(body.data as DesignTask);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title *</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" rows={3} value={description} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStat(v as DesignTaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPri(v as DesignTaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due">Due date</Label>
              <Input id="edit-due" type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
