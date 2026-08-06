'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays, LogOut, Search } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationsPopover } from '@/components/layout/NotificationsPopover';
import { CommandPalette } from '@/components/leads/CommandPalette';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Lead Pipeline',
  '/customers':           'Customers',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/work-orders':         'Design Tasks',
  '/materials':           'Materials',
  '/vendors':             'Vendors',
  '/purchase-orders':     'Purchase Orders',
  '/invoices':            'Invoices',
  '/accounts':            'Accounts & Payments',
  '/employees':           'Employees',
  '/calendar':            'Calendar',
  '/analytics/designers': 'Analytics',
  '/analytics':           'Analytics',
  '/settings':            'Settings',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:      { bg: '#0D1B2A', text: '#FFFFFF' },
  designer:   { bg: '#00B894', text: '#FFFFFF' },
  accountant: { bg: '#6C5CE7', text: '#FFFFFF' },
  supervisor: { bg: '#F9C74F', text: '#0D1B2A' },
};

const GREETINGS: Record<string, string> = {
  '/dashboard': "Here's what's happening with your business today.",
};

export function TopBar() {
  const [fullName, setFullName] = useState('');
  const [role, setRole]         = useState('');
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/v1/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.data) return;
        setFullName(body.data.fullName ?? '');
        setRole(body.data.role ?? '');
      })
      .catch(() => { /* identity unavailable — chrome renders without it */ });
  }, []);

  async function handleSignOut() {
    // Better Auth needs an explicit JSON content type and a body — without them
    // it answers 415/400. The Origin header its CSRF check requires is added by
    // the browser automatically.
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  const pageTitle = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'InterioOS';

  const greeting = Object.entries(GREETINGS).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1];

  const roleStyle = ROLE_COLORS[role] ?? ROLE_COLORS.owner;
  const initials  = fullName
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const firstName = fullName.split(' ')[0] || fullName;

  return (
    <>
      <CommandPalette />
      <header className="studio-topbar flex h-16 items-center justify-between px-6 relative z-10 gap-6">
        {/* Page title */}
        <div className="min-w-0">
          <h1
            className="text-base font-bold tracking-tight truncate"
            style={{ color: 'var(--text-heading)' }}
          >
            {pageTitle}
          </h1>
          {greeting && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              {firstName ? `Welcome back, ${firstName}! ` : ''}{greeting}
            </p>
          )}
        </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* ⌘K command palette trigger */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="topbar-search hidden md:flex items-center gap-2"
          style={{ maxWidth: '180px', cursor: 'pointer', border: '1.5px solid var(--border-subtle)', borderRadius: 10, padding: '6px 12px', background: 'var(--surface-muted)' }}
          aria-label="Open command palette"
          suppressHydrationWarning
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF', flex: 1 }}>Search…</span>
          <kbd style={{ fontSize: 10, background: 'var(--surface-app)', color: '#9CA3AF', borderRadius: 4, padding: '1px 4px', border: '1px solid var(--border-subtle)' }}>⌘K</kbd>
        </button>

        {/* Calendar shortcut */}
        <Link
          href="/calendar"
          aria-label="Open calendar"
          title="Calendar"
          className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--text-heading)' }}
        >
          <CalendarDays className="h-4 w-4" />
        </Link>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell — clicking opens a popover with the latest notifications */}
        <NotificationsPopover />

        {/* User info */}
        <div className="flex items-center gap-2.5 pl-3 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
            title={fullName}
          >
            {initials}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{fullName}</p>
            <p className="text-[10px] capitalize" style={{ color: 'var(--text-secondary)' }}>{role}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="ml-1 rounded-lg p-2 transition-colors hover:bg-red-50"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
    </>
  );
}
