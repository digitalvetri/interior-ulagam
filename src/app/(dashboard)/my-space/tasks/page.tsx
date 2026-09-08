'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Circle, Plus, Loader2, AlertCircle, ClipboardList, X } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Task {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  relatedType: string | null;
  relatedId: string | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= 7)  return `Due in ${diff}d`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(dueAt) < today;
}

const RELATED_COLORS: Record<string, string> = {
  lead:    '#7c3aed',
  project: '#0891b2',
  quote:   '#d97706',
  invoice: '#16a34a',
};

/* ── New task form ──────────────────────────────────────────────────────── */
function NewTaskForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Task title is required.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error); return; }
      setTitle(''); setDueAt(''); setNotes(''); setOpen(false);
      onSuccess();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
        style={{ background: 'var(--accent-base)' }}>
        <Plus size={16} /> Add Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor: 'var(--accent-base)40', background: 'var(--accent-base)04' }}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">New Task</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title..."
        className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
        style={{ borderColor: 'var(--border)' }}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Due Date</label>
          <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm bg-white focus:outline-none"
            style={{ borderColor: 'var(--border)' }} />
        </div>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Optional notes..."
        rows={2}
        className="w-full px-3 py-2 rounded-xl border text-sm bg-white focus:outline-none resize-none"
        style={{ borderColor: 'var(--border)' }} />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle size={13} /> {error}</div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--accent-base)' }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Save
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50"
          style={{ borderColor: 'var(--border)' }}>Cancel</button>
      </div>
    </form>
  );
}

/* ── Task row ───────────────────────────────────────────────────────────── */
function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string, done: boolean) => void }) {
  const [toggling, setToggling] = useState(false);
  const done = !!task.completedAt;
  const due  = fmtDue(task.dueAt);
  const overdue = !done && isOverdue(task.dueAt);

  async function handleToggle() {
    setToggling(true);
    try {
      await fetch(`/api/v1/me/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !done }),
      });
      onToggle(task.id, !done);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${done ? 'opacity-50' : 'hover:bg-gray-50'}`}
      style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
      >
        {toggling
          ? <Loader2 size={20} className="animate-spin" />
          : done
            ? <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
            : <Circle size={20} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-gray-400' : ''}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {due && (
            <span className="text-[11px] font-medium" style={{ color: overdue ? '#dc2626' : '#6b7280' }}>
              {due}
            </span>
          )}
          {task.relatedType && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize"
              style={{
                background: (RELATED_COLORS[task.relatedType] ?? '#6b7280') + '18',
                color: RELATED_COLORS[task.relatedType] ?? '#6b7280',
              }}>
              {task.relatedType}
            </span>
          )}
        </div>
        {task.notes && !done && (
          <p className="text-[12px] text-gray-400 mt-1 line-clamp-2">{task.notes}</p>
        )}
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]  = useState<'pending' | 'completed' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/me/tasks?status=${filter}`);
      const json = await res.json();
      setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function handleToggle(id: string, done: boolean) {
    if (filter === 'pending' && done) {
      setTasks(prev => prev.filter(t => t.id !== id));
    } else if (filter === 'completed' && !done) {
      setTasks(prev => prev.filter(t => t.id !== id));
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completedAt: done ? new Date().toISOString() : null } : t));
    }
  }

  const overdueTasks = tasks.filter(t => !t.completedAt && isOverdue(t.dueAt));
  const todayTasks   = tasks.filter(t => !t.completedAt && !isOverdue(t.dueAt) && t.dueAt?.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const upcomingTasks= tasks.filter(t => !t.completedAt && !isOverdue(t.dueAt) && t.dueAt?.slice(0, 10) !== new Date().toISOString().slice(0, 10));
  const noDueTasks   = tasks.filter(t => !t.completedAt && !t.dueAt);
  const doneTasks    = tasks.filter(t => !!t.completedAt);

  function Section({ title, items, color }: { title: string; items: Task[]; color?: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2"
          style={{ color: color ?? undefined }}>
          {title} · {items.length}
        </p>
        <div className="space-y-2">
          {items.map(t => (
            <TaskRow key={t.id} task={t} onToggle={handleToggle} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-[14px] text-gray-500 mt-1">Tasks assigned to you across all projects</p>
        </div>
        <NewTaskForm onSuccess={load} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(['pending', 'all', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
            style={filter === f
              ? { background: 'white', color: 'var(--accent-base)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
              : { color: '#6b7280' }}>
            {f === 'all' ? 'All Tasks' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-600">
            {filter === 'completed' ? 'No completed tasks yet' : 'No tasks assigned to you'}
          </p>
          <p className="text-[13px] text-gray-400 mt-1">
            {filter === 'pending' ? 'Great! You are all caught up.' : ''}
          </p>
        </div>
      ) : filter === 'pending' ? (
        <div className="space-y-6">
          <Section title="Overdue" items={overdueTasks} color="#dc2626" />
          <Section title="Due Today" items={todayTasks} color="#d97706" />
          <Section title="Upcoming" items={upcomingTasks} />
          <Section title="No Due Date" items={noDueTasks} />
        </div>
      ) : (
        <div className="space-y-6">
          {filter === 'all' && (
            <>
              <Section title="Overdue" items={overdueTasks} color="#dc2626" />
              <Section title="Due Today" items={todayTasks} color="#d97706" />
              <Section title="Upcoming" items={upcomingTasks} />
              <Section title="No Due Date" items={noDueTasks} />
            </>
          )}
          <Section title="Completed" items={doneTasks} />
        </div>
      )}
    </main>
  );
}
