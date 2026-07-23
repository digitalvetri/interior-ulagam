'use client';
import { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

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
  owner:      { bg: '#6F4E37', text: '#FFFFFF' },
  designer:   { bg: '#3D6B41', text: '#FFFFFF' },
  accountant: { bg: '#2B4B6B', text: '#FFFFFF' },
  supervisor: { bg: '#6B5B2B', text: '#FFFFFF' },
};

export function TopBar() {
  const [fullName, setFullName] = useState('');
  const [role, setRole]         = useState('');
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setFullName((meta.full_name as string) ?? (data.user?.email ?? ''));
      setRole((meta.role as string) ?? '');
    });
  }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push('/login');
  }

  const pageTitle = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Interior Studio OS';

  const roleStyle = ROLE_COLORS[role] ?? ROLE_COLORS.owner;
  const initials  = fullName
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <header className="studio-topbar flex h-14 items-center justify-between px-6 relative z-10">
      {/* Page title — brown per spec */}
      <h1
        className="text-base font-bold tracking-tight"
        style={{ color: '#3D2314' }}
      >
        {pageTitle}
      </h1>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg p-2 transition-colors hover:bg-[#E9DFD3]"
          style={{ color: '#6F4E37' }}
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#C8B7A6]">
          {/* Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
            title={fullName}
          >
            {initials}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold" style={{ color: '#1C1C1C' }}>{fullName}</p>
            <p className="text-[10px] capitalize" style={{ color: '#6B6B6B' }}>{role}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="ml-1 rounded-lg p-2 transition-colors hover:bg-red-50"
          style={{ color: '#6B6B6B' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6B6B')}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
