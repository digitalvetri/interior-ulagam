'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell, CheckCheck, Info, AlertTriangle, AlertOctagon, CircleCheck, Check, Trash2, Loader2,
} from 'lucide-react';

type Severity = 'info' | 'success' | 'warning' | 'critical';

interface Notification {
  id: string;
  severity: Severity;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const SEV: Record<Severity, { Icon: typeof Info; iconClass: string; bg: string }> = {
  info:     { Icon: Info,         iconClass: 'text-[var(--text-secondary)]',   bg: 'bg-[var(--surface-muted)] '     },
  success:  { Icon: CircleCheck,  iconClass: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  warning:  { Icon: AlertTriangle,iconClass: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/40'   },
  critical: { Icon: AlertOctagon, iconClass: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/40'       },
};

export function NotificationsPopover() {
  const [open, setOpen]         = useState(false);
  const [rows, setRows]         = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(false);
  const [markingAll, setMarking] = useState(false);
  const [unreadCount, setUnread] = useState<number>(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  // Poll unread count every 30s so the badge stays fresh even without opening.
  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const res = await fetch('/api/v1/notifications?unread=true');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setUnread((body.data ?? []).length);
      } catch { /* silent */ }
    }
    loadCount();
    const t = setInterval(loadCount, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // When opened, fetch the full recent list
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/v1/notifications')
      .then((r) => r.json())
      .then((res) => {
        setRows(res.data ?? []);
        setUnread((res.data ?? []).filter((n: Notification) => !n.readAt).length);
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggleRead(n: Notification) {
    const wantRead = !n.readAt;
    const res = await fetch(`/api/v1/notifications/${n.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ read: wantRead }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setRows((prev) => prev.map((r) => (r.id === n.id ? body.data : r)));
    setUnread((c) => Math.max(0, c + (wantRead ? -1 : 1)));
  }

  async function remove(n: Notification) {
    const res = await fetch(`/api/v1/notifications/${n.id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setRows((prev) => prev.filter((r) => r.id !== n.id));
    if (!n.readAt) setUnread((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarking(true);
    const res = await fetch('/api/v1/notifications', { method: 'PATCH' });
    setMarking(false);
    if (!res.ok) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: now })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
        style={{ color: 'var(--text-heading)' }}
        suppressHydrationWarning
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--surface-card)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-40 w-96 origin-top-right overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl "
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 ">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Notifications</h3>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={markingAll || unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-heading)] disabled:opacity-40 "
            >
              {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-[var(--text-tertiary)]" />
                <p className="text-xs text-[var(--text-secondary)]">No notifications yet.</p>
              </div>
            ) : (
              <ul>
                {rows.slice(0, 20).map((n) => {
                  const s = SEV[n.severity];
                  const Icon = s.Icon;
                  const unread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      className={
                        'group relative flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0 /60 ' +
                        (unread ? 'bg-blue-50/40 dark:bg-blue-950/10' : '')
                      }
                    >
                      {unread && (
                        <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-blue-500" aria-label="Unread" />
                      )}
                      <span className={'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ' + s.bg}>
                        <Icon className={'h-3.5 w-3.5 ' + s.iconClass} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          {n.href ? (
                            <Link
                              href={n.href}
                              onClick={() => setOpen(false)}
                              className="text-xs font-semibold hover:text-emerald-600"
                              style={{ color: unread ? 'var(--text-heading)' : 'var(--text-secondary)' }}
                            >
                              {n.title}
                            </Link>
                          ) : (
                            <p
                              className="text-xs font-semibold"
                              style={{ color: unread ? 'var(--text-heading)' : 'var(--text-secondary)' }}
                            >
                              {n.title}
                            </p>
                          )}
                          <span className="flex-shrink-0 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                            {relativeTime(new Date(n.createdAt))}
                          </span>
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {n.body}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => toggleRead(n)}
                          title={unread ? 'Mark as read' : 'Mark as unread'}
                          className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] "
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(n)}
                          title="Delete"
                          className="rounded p-1 text-[var(--text-tertiary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-center ">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
            >
              See all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60)      return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)      return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)      return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7)    return `${days}d`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
