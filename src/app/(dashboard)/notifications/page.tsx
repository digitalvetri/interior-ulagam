'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, AlertOctagon, CircleCheck, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Severity = 'info' | 'success' | 'warning' | 'critical';

interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  severity: Severity;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const SEV: Record<Severity, { Icon: typeof Info; ring: string; bg: string; iconClass: string }> = {
  info:     { Icon: Info,         ring: 'ring-slate-200 dark:ring-slate-700',    bg: 'bg-[var(--surface-muted)] /60',    iconClass: 'text-[var(--text-secondary)]'    },
  success:  { Icon: CircleCheck,  ring: 'ring-emerald-200 dark:ring-emerald-800',bg: 'bg-emerald-50 dark:bg-emerald-950/40',iconClass: 'text-emerald-600'  },
  warning:  { Icon: AlertTriangle,ring: 'ring-amber-200 dark:ring-amber-800',   bg: 'bg-amber-50 dark:bg-amber-950/40',    iconClass: 'text-amber-600'    },
  critical: { Icon: AlertOctagon, ring: 'ring-red-200 dark:ring-red-800',       bg: 'bg-red-50 dark:bg-red-950/40',        iconClass: 'text-red-600'      },
};

export default function NotificationsPage() {
  const [rows, setRows]           = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'all' | 'unread'>('all');
  const [markingAll, setMarking]  = useState(false);

  useEffect(() => {
    fetch('/api/v1/notifications')
      .then((r) => r.json())
      .then(({ data }) => { setRows(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'unread') return rows.filter((r) => !r.readAt);
    return rows;
  }, [rows, filter]);

  const unreadCount = rows.filter((r) => !r.readAt).length;

  async function toggleRead(n: Notification) {
    const wantRead = !n.readAt;
    const res = await fetch(`/api/v1/notifications/${n.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ read: wantRead }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setRows((prev) => prev.map((r) => r.id === n.id ? body.data : r));
  }

  async function remove(n: Notification) {
    if (!confirm(`Delete "${n.title}"?`)) return;
    const res = await fetch(`/api/v1/notifications/${n.id}`, { method: 'DELETE' });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== n.id));
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarking(true);
    const res = await fetch(`/api/v1/notifications`, { method: 'PATCH' });
    setMarking(false);
    if (!res.ok) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => r.readAt ? r : { ...r, readAt: now }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4 ">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-card)] text-white ">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>Notifications</h1>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {unreadCount > 0 ? `${unreadCount} unread of ${rows.length}` : `${rows.length} total, all read`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
          className="gap-1.5"
        >
          {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Mark all read
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-6 py-3 ">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium capitalize ' +
              (filter === f
                ? 'bg-[var(--surface-card)] text-white '
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
            }
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-300">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Loading notifications…</div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-md p-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-tertiary)] ">
              <Bell className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
              {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {filter === 'unread'
                ? 'Switch to "All" to see previous items.'
                : 'Payment updates, task alerts and site messages will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-2">
            {filtered.map((n) => {
              const s = SEV[n.severity];
              const Icon = s.Icon;
              const unread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className={
                    'group relative flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ' +
                    (unread
                      ? 'border-[var(--border-strong)] bg-[var(--surface-card)] '
                      : 'border-[var(--border-subtle)] bg-transparent opacity-70 ')
                  }
                >
                  {unread && (
                    <span className="absolute left-1.5 top-6 h-2 w-2 rounded-full bg-blue-500" aria-label="Unread" />
                  )}
                  <div className={'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-inset ' + s.ring + ' ' + s.bg}>
                    <Icon className={'h-4 w-4 ' + s.iconClass} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className="text-sm font-semibold"
                        style={{ color: unread ? 'var(--text-heading)' : 'var(--text-secondary)' }}
                      >
                        {n.title}
                      </h3>
                      <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--text-tertiary)]">
                        {relativeTime(new Date(n.createdAt))}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {n.body}
                      </p>
                    )}
                    {n.href && (
                      <Link href={n.href} className="mt-1.5 inline-block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                        View →
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => toggleRead(n)}
                      title={unread ? 'Mark as read' : 'Mark as unread'}
                      className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-heading)] "
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(n)}
                      title="Delete"
                      className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60)      return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)      return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)      return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7)    return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
