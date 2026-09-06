'use client';
import { useState, useEffect, use } from 'react';
import { CheckCircle2, Circle, Plus, Clock, Link2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState }  from '@/components/ui/EmptyState';

interface Task {
  id: string;
  title: string;
  assignedTo: string | null;
  assigneeName: string | null;
  relatedType: 'lead' | 'project' | 'quote' | 'invoice' | null;
  relatedId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface UserOption { id: string; fullName: string; }

function relatedHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  const map: Record<string, string> = {
    lead:    '/leads',
    project: '/projects',
    quote:   '/quotes',
    invoice: '/finance',
  };
  return map[type] ? `${map[type]}/${id}` : null;
}

function dueBadge(dueAt: string | null, completedAt: string | null) {
  if (completedAt || !dueAt) return null;
  const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, bg: 'var(--danger-soft)', color: 'var(--danger)' };
  if (diff === 0) return { label: 'Due today',                  bg: 'var(--warning-soft)', color: 'var(--warning-text)' };
  if (diff <= 3)  return { label: `Due in ${diff}d`,            bg: 'var(--warning-soft)', color: 'var(--warning-text)' };
  return null;
}

function TaskRow({
  task, onToggle, onDelete,
}: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const badge  = dueBadge(task.dueAt, task.completedAt);
  const href   = relatedHref(task.relatedType, task.relatedId);
  const done   = !!task.completedAt;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor: 'var(--surface-card)',
        opacity: done ? 0.6 : 1,
      }}
    >
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0"
        title={done ? 'Mark incomplete' : 'Mark complete'}
      >
        {done
          ? <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success-text)' }} />
          : <Circle       className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
        }
      </button>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug"
          style={{
            color: 'var(--text-heading)',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.assigneeName && (
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              → {task.assigneeName}
            </span>
          )}
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
          )}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-[11px] hover:underline"
              style={{ color: 'var(--accent-base)' }}
            >
              <Link2 className="h-3 w-3" />
              {task.relatedType}
            </Link>
          )}
          {task.notes && (
            <span className="text-[11px] italic truncate max-w-[200px]" style={{ color: 'var(--text-tertiary)' }}>
              {task.notes}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="flex-shrink-0 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
        style={{ color: 'var(--danger)' }}
        title="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function CreateTaskDialog({
  users, onClose, onCreated,
}: { users: UserOption[]; onClose: () => void; onCreated: (t: Task) => void }) {
  const [title,      setTitle]      = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueAt,      setDueAt]      = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          assignedTo: assignedTo || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) { onCreated(json.data); onClose(); }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-heading)' }}>New Task</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Title *
            </label>
            <input
              className="input-field w-full"
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Assign to
              </label>
              <select className="input-field w-full" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Due date
              </label>
              <input
                type="date"
                className="input-field w-full"
                value={dueAt} onChange={e => setDueAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Notes
            </label>
            <textarea
              className="input-field w-full"
              rows={2}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional context..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="btn-primary px-4 py-2 text-sm rounded-lg">
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tab,       setTab]       = useState<'mine' | 'all'>('mine');
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [userList,  setUserList]  = useState<UserOption[]>([]);
  const [myId,      setMyId]      = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [showDone,  setShowDone]  = useState(false);
  const [creating,  setCreating]  = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [me, ts, us] = await Promise.all([
        fetch('/api/v1/me').then(r => r.json()),
        fetch('/api/v1/tasks?limit=200').then(r => r.json()),
        fetch('/api/v1/employees').then(r => r.json()),
      ]);
      if (me?.data?.id) setMyId(me.data.id);
      if (Array.isArray(ts?.data)) setTasks(ts.data);
      if (Array.isArray(us?.data)) setUserList(us.data.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName })));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggleDone(task: Task) {
    const newVal = task.completedAt ? null : new Date().toISOString();
    const res = await fetch(`/api/v1/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: newVal }),
    });
    if (res.ok) {
      const json = await res.json();
      setTasks(prev => prev.map(t => t.id === task.id ? json.data : t));
    }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/v1/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== id));
  }

  const displayed = tasks.filter(t => {
    if (tab === 'mine' && myId && t.assignedTo !== myId) return false;
    if (!showDone && t.completedAt) return false;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.completedAt && (tab === 'all' || t.assignedTo === myId)).length;

  return (
    <div className="space-y-4 p-4 lg:p-6 animate-fade-in">
      <PageHeader
        title="Tasks"
        subtitle="Track follow-ups, actions, and to-dos across all records"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
            <Plus className="h-4 w-4" /> New Task
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--surface-muted)', width: 'fit-content' }}>
        {(['mine', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === t ? 'var(--surface-card)' : 'transparent',
              color:            tab === t ? 'var(--text-heading)' : 'var(--text-secondary)',
              boxShadow:        tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'mine' ? 'My Work' : 'All Tasks'}
            {t === 'mine' && pendingCount > 0 && (
              <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Show completed toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDone(v => !v)}
          className="text-xs font-medium flex items-center gap-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {showDone ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Clock}
          label={tab === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}
          description={tab === 'mine' ? 'Tasks assigned to you will appear here.' : 'Create a task to track any action item.'}
          actionLabel="Create Task"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="space-y-2">
          {displayed.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleDone(t)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateTaskDialog
          users={userList}
          onClose={() => setCreating(false)}
          onCreated={task => setTasks(prev => [task, ...prev])}
        />
      )}
    </div>
  );
}
