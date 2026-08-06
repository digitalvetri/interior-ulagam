'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Plus, Search, Check, Flag, Calendar, Circle, CircleDot, Eye, CheckCircle2,
  MoreHorizontal, Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { DesignTask, DesignTaskPriority, DesignTaskStatus } from '@/types/design-tasks';

const STATUSES: { value: DesignTaskStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: 'todo',        label: 'To do',       icon: Circle,        color: 'text-[var(--text-tertiary)]'  },
  { value: 'in_progress', label: 'In progress', icon: CircleDot,     color: 'text-blue-500'   },
  { value: 'review',      label: 'In review',   icon: Eye,           color: 'text-violet-500' },
  { value: 'done',        label: 'Done',        icon: CheckCircle2,  color: 'text-emerald-500' },
];

const PRIORITY_STYLES: Record<DesignTaskPriority, string> = {
  low:    'bg-[var(--surface-muted)] text-[var(--text-secondary)] ',
  normal: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  high:   'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function DesignTasksPage() {
  const [rows, setRows]         = useState<DesignTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStat] = useState<DesignTaskStatus | 'all'>('all');
  const [dialogOpen, setDialog] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/v1/design-tasks')
      .then((r) => r.json())
      .then(({ data }: { data: DesignTask[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => { setLoadError('Could not load tasks. Please refresh.'); setLoading(false); });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    if (openMenu) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenu]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<DesignTaskStatus | 'all', number> = { all: rows.length, todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  async function cycleStatus(task: DesignTask) {
    const order: DesignTaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    // Optimistic update
    setRows((prev) => prev.map((r) => r.id === task.id ? { ...r, status: next } : r));
    try {
      const res = await fetch(`/api/v1/design-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('update failed');
      const body = await res.json();
      setRows((prev) => prev.map((r) => r.id === task.id ? body.data : r));
    } catch {
      // Rollback to original status
      setRows((prev) => prev.map((r) => r.id === task.id ? task : r));
    }
  }

  async function remove(task: DesignTask) {
    setOpenMenu(null);
    if (!confirm(`Delete "${task.title}"?`)) return;
    // Optimistic remove
    setRows((prev) => prev.filter((r) => r.id !== task.id));
    const res = await fetch(`/api/v1/design-tasks/${task.id}`, { method: 'DELETE' });
    if (!res.ok) {
      // Rollback
      setRows((prev) => [task, ...prev]);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4 ">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>Design Tasks</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${filtered.length} of ${rows.length}`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialog(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> New task
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-3 ">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="studio-search-icon" />
          <Input
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-[48px]"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 text-xs ">
          {(['all', 'todo', 'in_progress', 'review', 'done'] as const).map((s) => {
            const label = s === 'all' ? 'All' : STATUSES.find((x) => x.value === s)!.label;
            return (
              <button
                key={s}
                onClick={() => setStat(s)}
                className={
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium ' +
                  (statusFilter === s
                    ? 'bg-[var(--surface-card)] text-white '
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
                }
              >
                {label}
                <span className="rounded-full bg-[var(--surface-muted)] px-1.5 text-[10px] font-semibold text-[var(--text-secondary)] ">
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loadError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Loading tasks…</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={search.trim().length > 0 || statusFilter !== 'all'} onCreate={() => setDialog(true)} />
        ) : (
          <ul className="mx-auto max-w-4xl space-y-2">
            {filtered.map((t) => {
              const status = STATUSES.find((s) => s.value === t.status)!;
              const StatusIcon = status.icon;
              const overdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < startOfToday();
              return (
                <li
                  key={t.id}
                  className="group relative flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-sm transition-shadow hover:shadow-md "
                >
                  <button
                    onClick={() => cycleStatus(t)}
                    aria-label={`Cycle status (currently ${status.label})`}
                    title="Click to advance status"
                    className={'flex-shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-muted)] ' + status.color}
                  >
                    <StatusIcon className="h-5 w-5" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        'truncate text-sm font-medium ' +
                        (t.status === 'done' ? 'text-[var(--text-tertiary)] line-through' : '')
                      }
                      style={{ color: t.status === 'done' ? undefined : 'var(--text-heading)' }}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{t.description}</p>
                    )}
                  </div>

                  <span className={'hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ' + PRIORITY_STYLES[t.priority]}>
                    <Flag className="h-3 w-3" /> {t.priority}
                  </span>

                  {t.dueDate && (
                    <span
                      className={
                        'hidden items-center gap-1 text-xs tabular-nums sm:inline-flex ' +
                        (overdue ? 'text-red-600 font-medium' : 'text-[var(--text-secondary)]')
                      }
                      title={overdue ? 'Overdue' : 'Due'}
                    >
                      <Calendar className="h-3 w-3" />
                      {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}

                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                      className="rounded p-1 text-[var(--text-tertiary)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] group-hover:opacity-100 "
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenu === t.id && (
                      <div
                        ref={menuRef}
                        role="menu"
                        className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1 text-left text-xs shadow-lg "
                      >
                        <button
                          onClick={() => { setOpenMenu(null); void cycleStatus(t); }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--surface-muted)] "
                        >
                          <Check className="h-3.5 w-3.5" /> Advance status
                        </button>
                        <button
                          onClick={() => remove(t)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewTaskDialog
        open={dialogOpen}
        onOpenChange={setDialog}
        onCreated={(t) => setRows((prev) => [t, ...prev])}
      />
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function EmptyState({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  if (hasQuery) {
    return (
      <div className="p-16 text-center text-sm text-[var(--text-secondary)]">
        No tasks match your filters.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(124,92,252,0.1)', color: 'var(--accent-base)' }}>
        <Plus className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
        No design tasks yet
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Add tasks like &quot;Send 3D render revision to client X&quot; or &quot;Approve moodboard for project Y&quot;.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-1.5">
        <Plus className="h-4 w-4" /> Add first task
      </Button>
    </div>
  );
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

function NewTaskDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (t: DesignTask) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle]       = useState('');
  const [description, setDesc]  = useState('');
  const [priority, setPri]      = useState<DesignTaskPriority>('normal');
  const [status, setStat]       = useState<DesignTaskStatus>('todo');
  const [dueDate, setDue]       = useState('');
  const [projectId, setProject] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

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
      onCreated(body.data as DesignTask);
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
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
