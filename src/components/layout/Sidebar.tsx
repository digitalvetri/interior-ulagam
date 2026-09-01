'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NAV_GROUPS } from '@/lib/nav-items';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Single nav item ─────────────────────────────────────────────────────────

function NavLink({
  href, label, icon: Icon, active, iconOnly, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; iconOnly: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={iconOnly ? label : undefined}
      className={`nav-item ${active ? 'active' : ''}`}
      style={{
        padding: iconOnly ? '10px 0' : '8px 10px',
        justifyContent: iconOnly ? 'center' : 'flex-start',
        gap: iconOnly ? 0 : 10,
      }}
    >
      {active && !iconOnly && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full"
          style={{ backgroundColor: 'var(--accent-base)' }}
        />
      )}
      <Icon className="nav-icon flex-shrink-0" style={{ width: 16, height: 16 }} />
      {!iconOnly && (
        <span className="flex-1 text-[13px] font-medium leading-none tracking-[-0.01em]">{label}</span>
      )}
    </Link>
  );
}

// ─── Nav group section ────────────────────────────────────────────────────────

function NavGroupSection({
  group, role, pathname, iconOnly, onNavigate,
}: {
  group: typeof NAV_GROUPS[0];
  role: string;
  pathname: string;
  iconOnly: boolean;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items.filter(i => !role || i.roles.includes(role));
  if (!visibleItems.length) return null;

  return (
    <div className="mb-0.5">
      {!iconOnly && (
        <p
          className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {group.label}
        </p>
      )}
      {iconOnly && <div className="mx-3 my-2 h-px" style={{ background: 'var(--border-subtle)' }} />}

      <div className="space-y-0.5 px-2">
        {visibleItems.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={active}
              iconOnly={iconOnly}
              onClick={onNavigate}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Sidebar body (shared by desktop + mobile) ────────────────────────────────

function SidebarBody({
  role, pathname, iconOnly, onNavigate,
}: {
  role: string; pathname: string;
  iconOnly: boolean; onNavigate?: () => void;
}) {
  const visibleGroups = NAV_GROUPS.filter(g => g.roles.some(r => r === role));

  return (
    <>
      {/* ── Brand ────────────────────────────────────────────────────── */}
      <div
        className="flex h-[60px] flex-shrink-0 items-center"
        style={{
          padding: iconOnly ? '0 14px' : '0 16px',
          gap: iconOnly ? 0 : 10,
          justifyContent: iconOnly ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-icon.png"
          alt="The Interior Studio"
          width={28} height={28}
          className="h-7 w-7 flex-shrink-0 rounded-lg object-contain"
        />
        {!iconOnly && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>
              The Interior Studio
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Studio OS</p>
          </div>
        )}
      </div>

      {/* ── Nav groups (scrollable) ───────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {visibleGroups.map(group => (
          <NavGroupSection
            key={group.key}
            group={group}
            role={role}
            pathname={pathname}
            iconOnly={iconOnly}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* ── Brand footer ─────────────────────────────────────────────── */}
      {!iconOnly && (
        <div className="flex-shrink-0 px-4 pb-8 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            Built by DigitalVetri
          </p>
        </div>
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole]             = useState('');
  const [fullName, setFullName]     = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [iconOnly, setIconOnly]     = useState(false);
  const initDone = useRef(false);

  useEffect(() => {
    fetch('/api/v1/me')
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!body?.data) return;
        setRole(body.data.role ?? '');
        setFullName(body.data.fullName ?? '');
      })
      .catch(() => {});
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    try {
      const saved = localStorage.getItem('sidebar-icon-only');
      if (saved === 'true') setIconOnly(true);
    } catch { /* noop */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleIconOnly() {
    setIconOnly(v => {
      const next = !v;
      try { localStorage.setItem('sidebar-icon-only', String(next)); } catch { /* noop */ }
      return next;
    });
  }

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { closeMenu(); }, [pathname, closeMenu]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-icon.png" alt="" className="h-7 w-7 rounded object-contain" width={28} height={28} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Interior Studio</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Toggle menu"
          suppressHydrationWarning
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar lg:hidden fixed top-14 left-0 bottom-0 z-40 flex w-64 flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarBody
          role={role} pathname={pathname}
          iconOnly={false} onNavigate={closeMenu}
        />
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200 ${iconOnly ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'}`}
      >
        <SidebarBody
          role={role} pathname={pathname} iconOnly={iconOnly}
        />

        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={toggleIconOnly}
          aria-label={iconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all hover:border-violet-300"
          style={{
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-md)',
            borderColor: 'var(--border-subtle)',
          }}
          suppressHydrationWarning
        >
          {iconOnly
            ? <ChevronRight className="h-3 w-3" style={{ color: 'var(--text-secondary)' }} />
            : <ChevronLeft  className="h-3 w-3" style={{ color: 'var(--text-secondary)' }} />
          }
        </button>
      </aside>
    </>
  );
}
