'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, LogOut, Search, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav-items';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Lead pipeline',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/materials':           'Materials',
  '/vendors':             'Vendors',
  '/purchase-orders':     'Purchase orders',
  '/accounts':            'Accounts',
  '/portfolio':           'Portfolio',
  '/analytics/designers': 'Analytics',
  '/settings':            'Settings',
};

export function TopBar() {
  const [fullName, setFullName] = useState('');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const client = createClient();
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setFullName((meta.full_name as string) ?? data.user?.email ?? '');
    });
  }, []);

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
    const match = NAV_ITEMS.find((i) => i.label.toLowerCase().includes(q));
    if (match) {
      router.push(match.href);
      setQuery('');
      searchRef.current?.blur();
    }
  }

  async function handleSignOut() {
    const client = createClient();
    if (client) await client.auth.signOut();
    router.push('/login');
  }

  const key = Object.keys(PAGE_TITLES).find(
    (k) => pathname === k || pathname.startsWith(k + '/'),
  );
  const pageTitle = (key && PAGE_TITLES[key]) ?? 'Interior Studio';
  const firstName = fullName.split(' ')[0] || fullName;
  const initials =
    fullName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IS';

  return (
    <header className="studio-topbar sticky top-0 z-20 flex h-[60px] items-center justify-between px-6 gap-4">
      {/* Left — quiet breadcrumb, not a loud title */}
      <nav aria-label="Location" className="min-w-0 flex items-center gap-2 text-sm">
        <span
          className="font-medium"
          style={{ color: 'var(--ink-4)' }}
        >
          Studio
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 flex-shrink-0"
          style={{ color: 'var(--ink-5)' }}
          strokeWidth={2}
        />
        <span
          className="font-semibold truncate"
          style={{ color: 'var(--ink)' }}
        >
          {pageTitle}
        </span>
      </nav>

      {/* Right — command search + icon cluster + user chip */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <form onSubmit={handleSearchSubmit} className="topbar-search hidden md:flex">
          <Search
            className="h-3.5 w-3.5 flex-shrink-0"
            style={{ color: 'var(--ink-4)' }}
            strokeWidth={2}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search or jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search or jump to a section"
          />
          <span className="kbd">⌘K</span>
        </form>

        <div className="hidden md:block h-6 w-px mx-1" style={{ background: 'var(--line)' }} />

        <ThemeToggle />

        <button type="button" aria-label="Notifications" className="top-icon-btn relative">
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.75} />
          <span className="notif-badge" aria-hidden />
        </button>

        <div className="hidden md:block h-6 w-px mx-1" style={{ background: 'var(--line)' }} />

        {/* User chip — avatar + first name, only when signed in */}
        {firstName && (
          <div
            className="hidden sm:flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-lg cursor-default"
            style={{ background: 'var(--panel-hi)', border: '1px solid var(--line)' }}
            title={fullName}
          >
            <span
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[11px] font-semibold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--acc), var(--acc-lo))',
                color: '#FFFFFF',
              }}
            >
              {initials}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
              {firstName}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="top-icon-btn top-icon-btn--danger"
        >
          <LogOut className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
