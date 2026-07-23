'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NAV_ITEMS } from '@/lib/nav-items';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', designer: 'Designer', accountant: 'Accountant', supervisor: 'Supervisor',
};

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole]         = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setRole((meta.role as string) ?? '');
      setFullName((meta.full_name as string) ?? (data.user?.email ?? ''));
    });
  }, []);

  const visible = role ? NAV_ITEMS.filter(i => i.roles.includes(role)) : NAV_ITEMS;
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <aside className="studio-sidebar flex w-60 flex-col flex-shrink-0">
      {/* Brand header */}
      <div className="flex h-16 items-center gap-3 px-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
          alt=""
          className="h-8 w-8 rounded-lg object-contain flex-shrink-0"
          width={32} height={32}
        />
        <div className="leading-tight">
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>The Interior</p>
          <p className="text-[11px] font-medium" style={{ color: 'var(--violet-primary)' }}>Studio</p>
        </div>
      </div>

      {/* Role badge */}
      {role && (
        <div className="px-4 pt-4 pb-1">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'var(--violet-soft)', color: 'var(--violet-primary)' }}
          >
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150"
              style={active
                ? { backgroundColor: 'var(--violet-soft)', color: 'var(--violet-primary)' }
                : { color: 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-muted)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--violet-primary)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card + footer */}
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: 'var(--violet-primary)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
              {fullName || 'Account'}
            </p>
            <p className="text-[10px] capitalize" style={{ color: 'var(--text-secondary)' }}>
              {ROLE_LABELS[role] ?? (role || '—')}
            </p>
          </div>
        </div>
        <p className="mt-2 px-2.5 text-[10px] tracking-wide" style={{ color: '#9CA3AF' }}>Built by DigitalVetri</p>
      </div>
    </aside>
  );
}
