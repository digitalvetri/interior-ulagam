'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NAV_GROUPS } from '@/lib/nav-items';
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Studio Owner',
  designer: 'Designer',
  accountant: 'Accountant',
  supervisor: 'Site Supervisor',
};

// ── Single nav group section ───────────────────────────────────────────────

function NavGroupSection({
  group, role, pathname, sidebarCollapsed, onNavigate,
}: {
  group: typeof NAV_GROUPS[0];
  role: string;
  pathname: string;
  sidebarCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items.filter(i => !role || i.roles.includes(role));
  const [open, setOpen] = useState(true);

  if (!visibleItems.length) return null;

  const groupActive = visibleItems.some(
    i => pathname === i.href || pathname.startsWith(i.href + '/'),
  );

  return (
    <div className="mb-0.5">
      {/* Group label / collapse trigger */}
      {!sidebarCollapsed && (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center justify-between px-4 pb-1 pt-3 text-left"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: groupActive ? 'rgba(77,217,184,0.9)' : 'rgba(255,255,255,0.28)' }}>
            {group.label}
          </span>
          <ChevronDown
            className="h-3 w-3 transition-transform duration-150"
            style={{
              color: 'rgba(255,255,255,0.25)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          />
        </button>
      )}

      {/* Divider in icon-only mode */}
      {sidebarCollapsed && (
        <div className="mx-3 my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      )}

      {/* Items */}
      {(open || sidebarCollapsed) && (
        <div className="px-2 space-y-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={sidebarCollapsed ? label : undefined}
                className="relative flex items-center rounded-lg transition-all duration-150 group"
                style={{
                  gap: sidebarCollapsed ? 0 : '10px',
                  padding: sidebarCollapsed ? '9px 0' : '8px 10px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  backgroundColor: active ? 'rgba(0,184,148,0.18)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                }}
              >
                {/* Active left bar */}
                {active && !sidebarCollapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ backgroundColor: '#00B894' }} />
                )}

                <Icon
                  className="flex-shrink-0"
                  style={{
                    width: 16, height: 16,
                    color: active ? '#4DD9B8' : 'rgba(255,255,255,0.45)',
                  }}
                />

                {!sidebarCollapsed && (
                  <span className="flex-1 text-[13px] font-medium leading-none">{label}</span>
                )}

                {!sidebarCollapsed && active && (
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#00B894' }} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared sidebar body ────────────────────────────────────────────────────

function SidebarBody({
  role, fullName, pathname, collapsed, onNavigate,
}: {
  role: string; fullName: string; pathname: string;
  collapsed: boolean; onNavigate?: () => void;
}) {
  const initials = fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const visibleGroups = NAV_GROUPS.filter(g => !role || g.roles.some(r => r === role));

  return (
    <>
      {/* Logo row */}
      <div className="flex h-[60px] flex-shrink-0 items-center border-b px-4"
        style={{ borderColor: 'rgba(255,255,255,0.07)', gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        {/* Logo mark's linework is navy — needs a light backing chip to read
            against this dark sidebar, otherwise it nearly disappears. */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-icon.png"
            alt="" className="h-full w-full object-contain" width={24} height={24}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-bold text-white truncate">InterioOS</p>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Interior CRM
            </p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {role && !collapsed && (
        <div className="px-4 pt-3 pb-0">
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: 'rgba(0,184,148,0.2)', color: '#4DD9B8' }}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
        {visibleGroups.map(group => (
          <NavGroupSection
            key={group.key}
            group={group}
            role={role}
            pathname={pathname}
            sidebarCollapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t p-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className={`flex items-center rounded-xl p-2 ${collapsed ? 'justify-center' : 'gap-2.5'}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: '#00B894' }}>
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{fullName || 'Account'}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {ROLE_LABELS[role] ?? (role || '—')}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="mt-2 px-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Built by DigitalVetri
          </p>
        )}
      </div>
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname  = usePathname();
  const [role, setRole]             = useState('');
  const [fullName, setFullName]     = useState('');
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

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between px-4"
        style={{ background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-icon.png"
              alt="" className="h-full w-full object-contain" width={20} height={20} />
          </div>
          <span className="text-sm font-bold text-white">InterioOS</span>
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile overlay ──────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/60" onClick={closeMenu} aria-hidden="true" />
      )}

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <aside
        className={`lg:hidden studio-sidebar fixed top-14 left-0 bottom-0 z-40 flex w-64 flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarBody role={role} fullName={fullName} pathname={pathname}
          collapsed={false} onNavigate={closeMenu} />
      </aside>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside
        className={`studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200 ${collapsed ? 'w-[64px]' : 'w-[220px]'}`}
      >
        <SidebarBody role={role} fullName={fullName} pathname={pathname} collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-100"
          style={{
            background: '#00B894',
            border: '2px solid #0D1B2A',
            opacity: 0.85,
          }}
        >
          {collapsed
            ? <ChevronRight className="h-3 w-3 text-white" />
            : <ChevronLeft className="h-3 w-3 text-white" />
          }
        </button>
      </aside>
    </>
  );
}
