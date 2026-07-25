'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NAV_GROUPS } from '@/lib/nav-items';
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', designer: 'Designer', accountant: 'Accountant', supervisor: 'Supervisor',
};

// ── Group nav section ─────────────────────────────────────────────────────────

function NavGroup({
  group,
  role,
  pathname,
  collapsed,
  onNavigate,
}: {
  group: typeof NAV_GROUPS[0];
  role: string;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items.filter(i => !role || i.roles.includes(role));
  const [open, setOpen] = useState(true);
  const isGroupActive = visibleItems.some(
    i => pathname === i.href || pathname.startsWith(i.href + '/'),
  );

  if (!visibleItems.length) return null;

  return (
    <div className="mb-1">
      {/* Group header — hidden in icon-only mode */}
      {!collapsed && (
        <button
          onClick={() => setOpen(o => !o)}
          className="group w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
          style={{ color: isGroupActive ? '#C89B3C' : 'rgba(255,255,255,0.3)' }}
        >
          {group.label}
          <ChevronDown
            className="h-3 w-3 transition-transform"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </button>
      )}

      {/* Items */}
      {(open || collapsed) && (
        <div className="space-y-0.5">
          {visibleItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={[
                  'group relative flex items-center rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center mx-1 p-2.5' : 'gap-3 px-3 py-2.5 mx-1',
                  active ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/8',
                ].join(' ')}
                style={active ? { backgroundColor: 'rgba(200,155,60,0.18)' } : {}}
              >
                {/* Active pill */}
                {!collapsed && (
                  <span
                    className={['absolute left-0 w-0.5 h-5 rounded-r-full transition-opacity', active ? 'opacity-100' : 'opacity-0'].join(' ')}
                    style={{ backgroundColor: '#C89B3C' }}
                  />
                )}

                <Icon
                  className="h-[17px] w-[17px] flex-shrink-0"
                  style={{ color: active ? '#C89B3C' : undefined }}
                />

                {!collapsed && (
                  <span className="flex-1 text-sm font-medium">{label}</span>
                )}

                {!collapsed && badge && (
                  <span className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                    style={{ background: '#C89B3C', color: '#fff' }}>
                    {badge}
                  </span>
                )}

                {!collapsed && active && !badge && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#C89B3C' }} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar content (shared between desktop + mobile) ─────────────────────────

function SidebarContent({
  role, fullName, pathname, collapsed, onNavigate,
}: {
  role: string; fullName: string; pathname: string;
  collapsed: boolean; onNavigate?: () => void;
}) {
  const initials = fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const visibleGroups = NAV_GROUPS.filter(g =>
    !role || g.roles.some(r => r === role)
  );

  return (
    <>
      {/* Logo */}
      <div className={[
        'flex h-16 items-center border-b border-white/10 flex-shrink-0',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4',
      ].join(' ')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
          alt="" className="h-8 w-8 rounded-lg object-contain flex-shrink-0" width={32} height={32}
        />
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <p className="text-[13px] font-bold text-white truncate">The Interior</p>
            <p className="text-[11px] font-medium text-white/55">Studio OS</p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {role && !collapsed && (
        <div className="px-4 pt-3 pb-0.5">
          <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(200,155,60,0.2)', color: '#C89B3C' }}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-0 scrollbar-thin">
        {visibleGroups.map(group => (
          <NavGroup
            key={group.key}
            group={group}
            role={role}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-2 py-3 flex-shrink-0">
        <div className={['flex items-center rounded-xl px-2 py-2', collapsed ? 'justify-center' : 'gap-2.5'].join(' ')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#C89B3C' }}>
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold text-white">{fullName || 'Account'}</p>
              <p className="text-[10px] capitalize text-white/50">{ROLE_LABELS[role] ?? (role || '—')}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="mt-1 px-2 text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Built by DigitalVetri
          </p>
        )}
      </div>
    </>
  );
}

// ── Main Sidebar export ───────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole]         = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  const initDone = useRef(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.app_metadata ?? data.user?.user_metadata ?? {};
      setRole((meta.role as string) ?? '');
      setFullName((meta.full_name as string) ?? (data.user?.email ?? ''));
    });
  }, []);

  // Restore collapsed state from localStorage
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') setCollapsed(true);
    } catch { /* noop */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { /* noop */ }
      return next;
    });
  }

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { closeMenu(); }, [pathname, closeMenu]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sidebarW = collapsed ? 'w-[64px]' : 'w-[240px]';

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between h-14 px-4 fixed top-0 left-0 right-0 z-40"
        style={{ background: '#4B2E2B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
            alt="" className="h-7 w-7 rounded object-contain" width={28} height={28} />
          <span className="text-sm font-bold text-white">Interior Studio</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={closeMenu} aria-hidden="true" />
      )}

      {/* ── Mobile drawer (always full-width, no icon-only on mobile) ─── */}
      <aside className={[
        'lg:hidden studio-sidebar fixed top-14 left-0 bottom-0 z-40 w-64 flex flex-col transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <SidebarContent role={role} fullName={fullName} pathname={pathname}
          collapsed={false} onNavigate={closeMenu} />
      </aside>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className={[
        'studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200',
        sidebarW,
      ].join(' ')}>
        <SidebarContent role={role} fullName={fullName} pathname={pathname} collapsed={collapsed} />

        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 shadow-lg transition-colors hover:border-white/40"
          style={{ background: '#4B2E2B' }}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-white/70" />
            : <ChevronLeft className="h-3.5 w-3.5 text-white/70" />
          }
        </button>
      </aside>
    </>
  );
}
