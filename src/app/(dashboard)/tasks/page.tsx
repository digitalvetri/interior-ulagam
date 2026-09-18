'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Plus, Clock, Trash2, Loader2, AlertTriangle, Link2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState }  from '@/components/ui/EmptyState';

interface Task {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  assigneeName: string | null;
  createdBy: string | null;
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
    lead: '/leads', project: '/projects', quote: '/quotes', invoice: '/finance',
  };
  return map[type] ? `${map[type]}/${id}` : null;
}

function TaskCard({
  task, myId, isLoading, onStart, onDone, onUndo, onDelete,
}: {
  task: Task; myId: string | null; isLoading: boolean;
  onStart: () => void; onDone: () => void; onUndo: () => void; onDelete: () => void;
}) {
  const now        = new Date();
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const dueDate    = task.dueAt ? new Date(task.dueAt) : null;
  const done       = task.status === 'done';
  const inProgress = task.status === 'in_progress';
  const overdue    = !!(dueDate && dueDate < now && !done);
  const dueToday   = !!(dueDate && !overdue && dueDate <= todayEnd && !done);
  const canDelete  = task.createdBy === myId && task.assignedTo === myId;
  const href       = relatedHref(task.relatedType, task.relatedId);

  const borderColor = done       ? 'var(--success-text)'
                    : overdue    ? 'var(--danger)'
                    : inProgress ? 'var(--accent-base)'
                    : dueToday   ? 'var(--warning-text)'
                    : 'var(--border-subtle)';

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background:   'var(--surface-card)',
        border:       '1px solid var(--border-subtle)',
        borderLeft:   `4px solid ${borderColor}`,
        opacity:      done ? 0.55 : 1,
      }}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug truncate"
          style={{ color: 'var(--text-heading)', textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {inProgress && (
            <span className="text-[10px] font-bold rounded-full px-2 py-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              In Progress
            </span>
          )}
          {done && (
            <span className="text-[10px] font-bold rounded-full px-2 py-0"
              style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
              Completed
            </span>
          )}
          {href && task.relatedType && (
            <Link href={href}
              className="flex items-center gap-0.5 text-[10px] font-medium capitalize hover:underline"
              style={{ color: 'var(--accent-base)' }}>
              <Link2 className="h-2.5 w-2.5" />
              {task.relatedType}
            </Link>
          )}
          {dueDate && (
            <span className="flex items-center gap-0.5 text-[11px]"
              style={{ color: overdue ? 'var(--danger)' : dueToday ? 'var(--warning-text)' : 'var(--text-tertiary)' }}>
              {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
              {overdue   ? `Overdue · ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
               : dueToday ? 'Due today'
               : `Due ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            </span>
          )}
          {task.notes && !overdue && (
            <span className="text-[11px] italic truncate max-w-[160px]" style={{ color: 'var(--text-tertiary)' }}>
              {task.notes}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        ) : done ? (
          <button onClick={onUndo}
            className="text-[11px] font-semibold rounded-lg px-3 py-1 whitespace-nowrap"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}>
            Undo
          </button>
        ) : task.status === 'pending' ? (
          <button onClick={onStart}
            className="text-[11px] font-bold rounded-lg px-3 py-1 whitespace-nowrap"
            style={{ border: '1px solid var(--accent-base)', color: 'var(--accent-base)', background: 'transparent' }}>
            Start
          </button>
        ) : inProgress ? (
          <button onClick={onDone}
            className="text-[11px] font-bold rounded-lg px-3 py-1 whitespace-nowrap"
            style={{ background: 'var(--success)', color: '#fff' }}>
            Done ✓
          </button>
        ) : null}
        {canDelete && !isLoading && (
          <button onClick={onDelete} title="Delete"
            className="opacity-30 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--danger)' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function CreateTaskDialog({
  users, isOwner, onClose, onCreated,
}: { users: UserOption[]; isOwner: boolean; onClose: () => void; onCreated: (t: Task) => void }) {
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
          title:      title.trim(),
          assignedTo: assignedTo || undefined,
          dueAt:      dueAt ? new Date(dueAt).toISOString() : undefined,
          notes:      notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) { onCreated(json.data); onClose(); }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-heading)' }}>New Task</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input className="input-field w-full" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isOwner && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Assign to</label>
                <select className="input-field w-full" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Due date</label>
              <input type="date" className="input-field w-full" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea className="input-field w-full" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional context..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">Cancel</button>
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
  const [tab,      setTab]      = useState<'mine' | 'all'>('mine');
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [userList, setUserList] = useState<UserOption[]>([]);
  const [myId,     setMyId]     = useState<string | null>(null);
  const [isOwner,  setIsOwner]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [patching, setPatching] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [me, ts, us] = await Promise.all([
        fetch('/api/v1/me').then(r => r.json()),
        fetch('/api/v1/tasks?limit=200').then(r => r.json()),
        fetch('/api/v1/employees').then(r => r.json()),
      ]);
      if (me?.data?.id) setMyId(me.data.id);
      const owner = me?.data?.role === 'owner' || me?.data?.isAdmin === true;
      setIsOwner(owner);
      if (owner) setTab('all');
      if (Array.isArray(ts?.data)) setTasks(ts.data);
      if (Array.isArray(us?.data)) setUserList(us.data.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName })));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function patchStatus(task: Task, newStatus: string) {
    setPatching(task.id);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        setTasks(prev => prev.map(t => t.id === task.id ? json.data : t));
      }
    } finally { setPatching(null); }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/v1/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== id));
  }

  const displayed = tasks.filter(t => {
    if (tab === 'mine' && myId && t.assignedTo !== myId) return false;
    if (!showDone && t.status === 'done') return false;
    return true;
  });

  const pendingCount = tasks.filter(t =>
    t.status !== 'done' && (tab === 'all' || t.assignedTo === myId),
  ).length;

  // Summary counts over the current displayed active tasks
  const now           = new Date();
  const todayEnd      = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const activeTasks   = displayed.filter(t => t.status !== 'done');
  const activeCount   = activeTasks.length;
  const overdueCount  = activeTasks.filter(t => t.dueAt && new Date(t.dueAt) < now).length;
  const dueTodayCount = activeTasks.filter(t => {
    if (!t.dueAt) return false;
    const d = new Date(t.dueAt);
    return d >= now && d <= todayEnd;
  }).length;

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

      {/* Tab pill — employees only */}
      {!isOwner && (
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--surface-muted)', width: 'fit-content' }}>
          <button
            onClick={() => setTab('mine')}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === 'mine' ? 'var(--surface-card)' : 'transparent',
              color:            tab === 'mine' ? 'var(--text-heading)' : 'var(--text-secondary)',
              boxShadow:        tab === 'mine' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            My Work
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Summary indicators */}
      {!loading && activeCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent-base)' }} />
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-heading)' }}>
              {activeCount} Active
            </span>
          </div>
          {dueTodayCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-text)' }}>
              <Clock className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
              <span className="text-[12px] font-semibold" style={{ color: 'var(--warning-text)' }}>
                {dueTodayCount} Due Today
              </span>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
              <AlertTriangle className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--danger)' }} />
              <span className="text-[12px] font-semibold" style={{ color: 'var(--danger)' }}>
                {overdueCount} Overdue
              </span>
            </div>
          )}
        </div>
      )}

      {/* Show completed toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowDone(v => !v)}
          className="text-xs font-medium flex items-center gap-1.5"
          style={{ color: 'var(--text-secondary)' }}>
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
          label={isOwner ? 'No tasks yet' : 'No tasks assigned to you'}
          description={isOwner ? 'Create a task and assign it to a team member.' : 'Tasks assigned to you will appear here.'}
          actionLabel="Create Task"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="space-y-2">
          {displayed.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              myId={myId}
              isLoading={patching === t.id}
              onStart={() => patchStatus(t, 'in_progress')}
              onDone={() => patchStatus(t, 'done')}
              onUndo={() => patchStatus(t, 'pending')}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateTaskDialog
          users={userList}
          isOwner={isOwner}
          onClose={() => setCreating(false)}
          onCreated={task => setTasks(prev => [task, ...prev])}
        />
      )}
    </div>
  );
}
