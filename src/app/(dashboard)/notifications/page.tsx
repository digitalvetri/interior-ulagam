'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, CheckCheck, Trash2, Info, AlertTriangle, AlertOctagon, CircleCheck, Loader2,
} from 'lucide-react';

type Severity = 'info' | 'success' | 'warning' | 'critical';
type FilterTab = 'unread' | 'all' | 'read';

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
  info:     { Icon: Info,          ring: 'ring-slate-200',    bg: 'bg-[var(--surface-muted)]',          iconClass: 'text-[var(--text-secondary)]' },
  success:  { Icon: CircleCheck,   ring: 'ring-emerald-200',  bg: 'bg-emerald-50',                      iconClass: 'text-emerald-600'             },
  warning:  { Icon: AlertTriangle, ring: 'ring-amber-200',    bg: 'bg-amber-50',                        iconClass: 'text-amber-600'               },
  critical: { Icon: AlertOctagon,  ring: 'ring-red-200',      bg: 'bg-red-50',                          iconClass: 'text-red-600'                 },
};

export default function NotificationsPage() {
  const [rows, setRows]          = useState<Notification[]>([]);
  const [loading, setLoading]    = useState(true);
  const [filter, setFilter]      = useState<FilterTab>('unread');
  const [markingAll, setMarking] = useState(false);

  useEffect(() => {
    fetch('/api/v1/notifications')
      .then(r => r.json())
      .then(({ data }) => { setRows(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const unreadCount = rows.filter(r => !r.readAt).length;
  const readCount   = rows.filter(r => !!r.readAt).length;

  const filtered = useMemo(() => {
    if (filter === 'unread') return rows.filter(r => !r.readAt);
    if (filter === 'read')   return rows.filter(r => !!r.readAt);
    return rows;
  }, [rows, filter]);

  async function toggleRead(n: Notification) {
    const wantRead = !n.readAt;
    const res = await fetch(`/api/v1/notifications/${n.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ read: wantRead }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setRows(prev => prev.map(r => r.id === n.id ? body.data : r));
  }

  async function remove(n: Notification) {
    if (!confirm(`Delete "${n.title}"?`)) return;
    const res = await fetch(`/api/v1/notifications/${n.id}`, { method: 'DELETE' });
    if (res.ok) setRows(prev => prev.filter(r => r.id !== n.id));
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarking(true);
    const res = await fetch(`/api/v1/notifications`, { method: 'PATCH' });
    setMarking(false);
    if (!res.ok) return;
    const now = new Date().toISOString();
    setRows(prev => prev.map(r => r.readAt ? r : { ...r, readAt: now }));
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'all',    label: 'All',    count: rows.length  },
    { key: 'read',   label: 'Read',   count: readCount    },
  ];

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--surface-muted)' }}>
      <div className="px-4 sm:px-6 py-8">

        {/* Page header */}
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>
          {unreadCount} unread of {rows.length} total. Chronological — newest first.
        </p>
        <h1 className="text-3xl font-bold tracking-tight mb-6" style={{ color: 'var(--text-heading)' }}>
          Notifications
        </h1>

        {/* Tabs + Mark all read */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {TABS.map(tab => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
                    (active
                      ? 'border '
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-card)] ')
                  }
                  style={active ? {
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-card)',
                    color: 'var(--text-heading)',
                  } : {}}
                >
                  {tab.label}
                  <span
                    className="inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[11px] font-bold"
                    style={active
                      ? { background: 'var(--accent-soft, #E6F4F1)', color: 'var(--accent-base, #0D7F6E)' }
                      : { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }
                    }
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={markAllRead}
            disabled={markingAll || unreadCount === 0}
            className="flex items-center gap-1.5 text-sm disabled:opacity-40 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {markingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCheck className="h-3.5 w-3.5" />
            }
            Mark all read
          </button>
        </div>

        {/* Content card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
                {filter === 'unread'
                  ? 'No unread notifications.'
                  : filter === 'read'
                    ? 'No read notifications.'
                    : 'No notifications yet.'}
              </p>
              <p className="text-sm" style={{ color: 'var(--accent-base, #0D7F6E)' }}>
                Follow-ups, payment reminders and stock alerts will land here.
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.map((n, idx) => {
                const s = SEV[n.severity];
                const Icon = s.Icon;
                const unread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    className={
                      'relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-muted)] ' +
                      (unread ? '' : 'opacity-60')
                    }
                  >
                    {/* Unread dot */}
                    {unread && (
                      <span className="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}

                    {/* Icon */}
                    <div className={'flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset ' + s.ring + ' ' + s.bg}>
                      <Icon className={'h-4 w-4 ' + s.iconClass} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-heading)' }}>
                          {n.title}
                        </h3>
                        <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                          {relativeTime(new Date(n.createdAt))}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>
                      )}
                      {n.href && (
                        <Link href={n.href} className="mt-1 inline-block text-xs font-medium hover:underline" style={{ color: 'var(--accent-base, #0D7F6E)' }}>
                          View →
                        </Link>
                      )}
                    </div>

                    {/* Actions — always visible */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggleRead(n)}
                        title={unread ? 'Mark as read' : 'Mark as unread'}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(n)}
                        title="Delete"
                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600"
                        style={{ color: 'var(--text-secondary)' }}
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
    </div>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60)    return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
