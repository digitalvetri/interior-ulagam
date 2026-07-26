'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav-items';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Lead Pipeline',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/materials':           'Materials',
  '/vendors':             'Vendors',
  '/purchase-orders':     'Purchase Orders',
  '/accounts':            'Accounts',
  '/portfolio':           'Portfolio',
  '/analytics/designers': 'Analytics',
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
  const [query, setQuery]       = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setFullName((meta.full_name as string) ?? (data.user?.email ?? ''));
      setRole((meta.role as string) ?? '');
    });
  }, []);

  // ⌘K / Ctrl+K focuses the search box, matching the hint shown inside it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = NAV_ITEMS.find(i => i.label.toLowerCase().includes(q));
    if (match) {
      router.push(match.href);
      setQuery('');
      searchRef.current?.blur();
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push('/login');
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
        {/* Quick-jump search — ⌘K focuses it, Enter navigates to the first matching page */}
        <form onSubmit={handleSearchSubmit} className="topbar-search hidden md:flex">
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search pages"
          />
          <kbd>⌘K</kbd>
        </form>

        {/* Notification bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--text-heading)' }}
        >
          <Bell className="h-4 w-4" />
        </button>

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
  );
}
