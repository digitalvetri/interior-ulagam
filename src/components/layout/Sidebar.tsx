'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NAV_GROUPS } from '@/lib/nav-items';
import { useUser } from '@/components/providers/user-provider';
import { Menu, X, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

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
        padding: iconOnly ? '10px 0' : '9px 12px',
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
        <span className="flex-1 text-[14px] font-medium leading-none tracking-[-0.01em]">{label}</span>
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
        {visibleItems.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
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

function NavSkeleton({ iconOnly }: { iconOnly: boolean }) {
  const widths = ['w-20', 'w-28', 'w-24', 'w-16', 'w-28', 'w-22', 'w-20', 'w-24'];
  return (
    <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
      {!iconOnly && (
        <div className="mx-3 mb-1 mt-3 h-2.5 w-12 rounded skeleton opacity-40" />
      )}
      <div className="space-y-0.5 px-2">
        {widths.map((w, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${i === 3 ? 'mt-3' : ''}`}>
            <div className="h-4 w-4 flex-shrink-0 rounded skeleton opacity-30" />
            {!iconOnly && <div className={`h-3 ${w} rounded skeleton opacity-30`} />}
          </div>
        ))}
      </div>
    </nav>
  );
}

function SidebarBody({
  role, isAdmin, fullName, pathname, iconOnly, roleLoaded, onNavigate, onSignOut,
}: {
  role: string; isAdmin: boolean; fullName: string; pathname: string;
  iconOnly: boolean; roleLoaded: boolean; onNavigate?: () => void; onSignOut?: () => void;
}) {
  const visibleGroups = NAV_GROUPS.filter(g => g.roles.some(r => r === role));
  const isMobile = !!onNavigate;

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin', owner: 'Owner', designer: 'Designer',
    accountant: 'Accountant', supervisor: 'Supervisor', employee: 'Employee',
  };
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      {/* ── Brand — hidden on mobile drawer (top bar already shows it) ── */}
      {!isMobile && <div
        className="flex h-[60px] flex-shrink-0 items-center"
        style={{
          padding: iconOnly ? '0 14px' : '0 16px',
          gap: iconOnly ? 0 : 10,
          justifyContent: iconOnly ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-icon.png"
            alt="Konst Design"
            width={28} height={28}
            className="h-full w-full object-contain"
          />
        </div>
        {!iconOnly && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>
              Konst Design
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Design Studio</p>
          </div>
        )}
      </div>}

      {/* ── Nav groups (scrollable) ───────────────────────────── */}
      {!roleLoaded ? <NavSkeleton iconOnly={iconOnly} /> : (
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
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      {!iconOnly && (
        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Mobile drawer footer — user info + theme + sign out */}
          {isMobile ? (
            <div className="px-3 py-3 space-y-2">
              {fullName && (
                <div className="flex items-center gap-2.5 px-1 py-1">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#E2E8F0' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold" style={{ color: '#E2E8F0' }}>
                      {fullName}
                    </p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>{roleLabel}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 px-1">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
                  style={{ color: '#CBD5E1' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                  Sign out
                </button>
              </div>
              {isAdmin && (
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--accent-base)' }}>
                  Admin
                </p>
              )}
            </div>
          ) : (
            /* Desktop sidebar footer */
            <div className="px-4 pb-8 pt-3">
              {isAdmin && (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--accent-base)' }}>
                  Admin
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role: rawRole, isAdmin, fullName, roleLoaded } = useUser();
  const role = isAdmin ? 'admin' : rawRole ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [iconOnly, setIconOnly]     = useState(false);
  const initDone = useRef(false);

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

  async function handleSignOut() {
    closeMenu();
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between px-4" style={{ background: 'linear-gradient(90deg, #131545 0%, #1a1e6e 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-icon.png" alt="" className="h-full w-full object-contain" width={28} height={28} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#E2E8F0' }}>Konst Design</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 transition-colors"
          style={{ color: '#94A3B8' }}
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
        className={`studio-sidebar lg:hidden fixed top-14 left-0 bottom-0 z-40 flex w-72 flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ position: 'fixed' }}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <SidebarBody
            role={role} isAdmin={isAdmin} fullName={fullName} pathname={pathname}
            iconOnly={false} roleLoaded={roleLoaded} onNavigate={closeMenu} onSignOut={handleSignOut}
          />
        </div>
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200 ${iconOnly ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'}`}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <SidebarBody
            role={role} isAdmin={isAdmin} fullName={fullName} pathname={pathname}
            iconOnly={iconOnly} roleLoaded={roleLoaded}
          />
        </div>

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
