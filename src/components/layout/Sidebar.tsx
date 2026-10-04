'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NAV_GROUPS } from '@/lib/nav-items';
import { ROLE_LABELS } from '@/lib/roles';
import { useUser } from '@/components/providers/user-provider';
import { Menu, X, ChevronLeft, ChevronRight, LogOut, CircleHelp } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationsPopover } from '@/components/layout/NotificationsPopover';

// ─── Brand mark — the boxed "K" monogram ─────────────────────────────────────

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 44 44" fill="none"
      aria-hidden="true" className="flex-shrink-0"
      style={{ color: 'var(--accent-base)' }}
    >
      <rect x="1.5" y="1.5" width="41" height="41" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v29" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 7.5v29" stroke="currentColor" strokeWidth="1.6" />
      <path d="M36 7.5 15 24" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 19.5 36.5 36.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 1).toUpperCase() || '?';
}

/**
 * The one nav entry to highlight: the longest href the path sits under. Without
 * this, /leads/analytics lit up both "Leads" and "Lead Analytics".
 */
function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const { href, exact } of NAV_GROUPS.flatMap(g => g.items)) {
    const hit = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}

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
      aria-current={active ? 'page' : undefined}
      className={`nav-item ${active ? 'active' : ''}`}
      style={{
        padding: iconOnly ? '9px 0' : '8px 14px',
        justifyContent: iconOnly ? 'center' : 'flex-start',
        gap: iconOnly ? 0 : 12,
      }}
    >
      <Icon className="nav-icon flex-shrink-0" style={{ width: 18, height: 18 }} strokeWidth={1.6} />
      {!iconOnly && (
        <span className="flex-1 truncate text-[14px] leading-none tracking-[-0.01em]">{label}</span>
      )}
    </Link>
  );
}

// ─── Nav group section ────────────────────────────────────────────────────────

function NavGroupSection({
  group, role, activeHref, iconOnly, first, onNavigate,
}: {
  group: typeof NAV_GROUPS[0];
  role: string;
  activeHref: string | null;
  iconOnly: boolean;
  first: boolean;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items.filter(i => !role || i.roles.includes(role));
  if (!visibleItems.length) return null;

  return (
    <div>
      {!first && <div className="mx-4 my-2 h-px" style={{ background: 'var(--border-subtle)' }} />}
      {!iconOnly && (
        <p
          className="px-5 pb-1.5 pt-1 text-[10.5px] font-medium uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {group.label}
        </p>
      )}

      <div className="space-y-0.5 px-3">
        {visibleItems.map(({ href, label, icon, exact }) => {
          const active = href === activeHref;
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
        <div className="mx-5 mb-1 mt-3 h-2.5 w-12 rounded skeleton opacity-40" />
      )}
      <div className="space-y-1 px-3">
        {widths.map((w, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${i === 3 ? 'mt-3' : ''}`}>
            <div className="h-4 w-4 flex-shrink-0 rounded skeleton opacity-30" />
            {!iconOnly && <div className={`h-3 ${w} rounded skeleton opacity-30`} />}
          </div>
        ))}
      </div>
    </nav>
  );
}

function SidebarBody({
  role, rawRole, fullName, pathname, iconOnly, roleLoaded, onNavigate, onSignOut,
}: {
  role: string; rawRole: string; fullName: string; pathname: string;
  iconOnly: boolean; roleLoaded: boolean; onNavigate?: () => void; onSignOut: () => void;
}) {
  const visibleGroups = NAV_GROUPS.filter(g => g.roles.some(r => r === role));
  const isMobile = !!onNavigate;
  const activeHref = activeNavHref(pathname);
  const roleLabel = ROLE_LABELS[rawRole] ?? rawRole;

  return (
    <>
      {/* ── Brand — hidden on the mobile drawer (the top bar already shows it) ── */}
      {!isMobile && (
        <Link
          href="/dashboard"
          className="flex flex-shrink-0 items-center"
          style={{
            height: 84,
            padding: iconOnly ? '0 14px' : '0 20px',
            gap: 14,
            justifyContent: iconOnly ? 'center' : 'flex-start',
          }}
        >
          <BrandMark size={iconOnly ? 32 : 38} />
          {!iconOnly && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[18px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--text-heading)' }}>
                Konst Design
              </p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>Design &amp; Build</p>
            </div>
          )}
        </Link>
      )}

      {/* ── Nav groups (scrollable) ───────────────────────────── */}
      {!roleLoaded ? <NavSkeleton iconOnly={iconOnly} /> : (
        <nav className="flex-1 overflow-y-auto pb-3 pt-0.5" style={{ scrollbarWidth: 'none' }}>
          {visibleGroups.map((group, i) => (
            <NavGroupSection
              key={group.key}
              group={group}
              role={role}
              activeHref={activeHref}
              iconOnly={iconOnly}
              first={i === 0}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      )}

      {/* ── Footer — who is signed in ─────────────────────────── */}
      <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {iconOnly ? (
          <div className="flex justify-center py-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white"
              style={{ background: 'var(--accent-base)' }}
              title={fullName}
            >
              {initialsOf(fullName)}
            </div>
          </div>
        ) : (
          <div className="px-3 py-3 space-y-2.5">
            <div className="flex items-center gap-3 px-1.5">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                style={{ background: 'var(--accent-base)' }}
              >
                {initialsOf(fullName)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13.5px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {fullName || '—'}
                </p>
                <p className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>{roleLabel}</p>
              </div>
              <Link
                href="/settings"
                onClick={onNavigate}
                aria-label="Help & settings"
                title="Help & settings"
                className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <CircleHelp className="h-5 w-5" strokeWidth={1.5} />
              </Link>
            </div>

            {/* Mobile drawer carries the actions the desktop top bar would */}
            {isMobile && (
              <div className="flex items-center gap-1 px-0.5">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
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

  // Lock page scroll behind the open drawer so the page doesn't scroll under a finger.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

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
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between px-4"
        style={{ background: 'var(--surface-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={30} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-heading)' }}>
              Konst Design
            </p>
            <p className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>Design &amp; Build</p>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationsPopover />
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-heading)' }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            suppressHydrationWarning
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 top-14 z-30 bg-black/25"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar lg:hidden fixed top-14 left-0 bottom-0 z-40 flex w-[min(20rem,86vw)] flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!mobileOpen}
      >
        <SidebarBody
          role={role} rawRole={rawRole} fullName={fullName} pathname={pathname}
          iconOnly={false} roleLoaded={roleLoaded} onNavigate={closeMenu} onSignOut={handleSignOut}
        />
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200 ${iconOnly ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'}`}
      >
        <SidebarBody
          role={role} rawRole={rawRole} fullName={fullName} pathname={pathname}
          iconOnly={iconOnly} roleLoaded={roleLoaded} onSignOut={handleSignOut}
        />

        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={toggleIconOnly}
          aria-label={iconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-colors hover:border-[var(--border-strong)]"
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
