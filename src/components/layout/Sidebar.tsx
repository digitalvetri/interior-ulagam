'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NAV_GROUPS } from '@/lib/nav-items';
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Studio Owner',
  designer: 'Designer',
  accountant: 'Accountant',
  supervisor: 'Site Supervisor',
};

// ─── Single nav group ─────────────────────────────────────────────────────────

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
  const [open, setOpen] = useState(true);

  if (!visibleItems.length) return null;

  const groupHasActive = visibleItems.some(
    i => pathname === i.href || pathname.startsWith(i.href + '/'),
  );

  return (
    <div className="mb-1">
      {/* Section label — hidden when icon-only */}
      {!iconOnly && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="group flex w-full items-center justify-between px-3 py-1.5 text-left"
          suppressHydrationWarning
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: groupHasActive ? 'var(--accent-base)' : 'var(--text-tertiary)' }}
          >
            {group.label}
          </span>
          <ChevronDown
            className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-150"
            style={{
              color: 'var(--text-tertiary)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          />
        </button>
      )}

      {/* Divider in icon-only mode */}
      {iconOnly && <div className="mx-2 my-2 h-px bg-[var(--surface-muted)]" />}

      {/* Nav items */}
      {(open || iconOnly) && (
        <div className="space-y-0.5 px-2">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={iconOnly ? label : undefined}
                className={`nav-item ${active ? 'active' : ''}`}
                style={{
                  padding: iconOnly ? '11px 0' : '9px 12px',
                  justifyContent: iconOnly ? 'center' : 'flex-start',
                  gap: iconOnly ? 0 : 11,
                }}
              >
                {/* Active left indicator */}
                {active && !iconOnly && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ backgroundColor: 'var(--accent-base)' }}
                  />
                )}

                <Icon className="nav-icon flex-shrink-0" style={{ width: 17, height: 17 }} />

                {!iconOnly && (
                  <span className="flex-1 text-[13.5px] font-medium leading-none">{label}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar body (shared by desktop + mobile drawer) ─────────────────────────

function SidebarBody({
  role, fullName, pathname, iconOnly, onNavigate,
}: {
  role: string; fullName: string; pathname: string;
  iconOnly: boolean; onNavigate?: () => void;
}) {
  const initials = fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const visibleGroups = NAV_GROUPS.filter(g => !role || g.roles.some(r => r === role));

  return (
    <>
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div
        className="flex h-[60px] flex-shrink-0 items-center border-b border-[var(--border-subtle)]"
        style={{ padding: iconOnly ? '0 12px' : '0 16px', gap: iconOnly ? 0 : 10, justifyContent: iconOnly ? 'center' : 'flex-start' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-icon.png"
          alt="The Interior Studio"
          width={32} height={32}
          className="h-8 w-8 flex-shrink-0 rounded-lg object-contain"
        />
        {!iconOnly && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>The Interior Studio</p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Studio OS</p>
          </div>
        )}
      </div>

      {/* ── Role pill ────────────────────────────────────────────────── */}
      {role && !iconOnly && (
        <div className="px-4 pt-3 pb-0">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--accent-soft)', color: '#6D4FE0' }}
          >
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}

      {/* ── Nav groups ───────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2"
        style={{ scrollbarWidth: 'none' }}
      >
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

      {/* ── User footer ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] p-3">
        <div
          className={`flex items-center rounded-xl p-2 ${iconOnly ? 'justify-center' : 'gap-2.5'}`}
          style={{ backgroundColor: 'var(--surface-muted)' }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: 'var(--accent-base)' }}
          >
            {initials}
          </div>
          {!iconOnly && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[var(--text-heading)]">{fullName || 'Account'}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{ROLE_LABELS[role] ?? (role || '—')}</p>
            </div>
          )}
        </div>
        {!iconOnly && (
          <p className="mt-2 px-1 text-[10px] text-[var(--text-tertiary)]">Built by DigitalVetri</p>
        )}
      </div>
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
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.data) return;
        setRole(body.data.role ?? '');
        setFullName(body.data.fullName ?? '');
      })
      .catch(() => { /* identity unavailable — sidebar renders without role */ });
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
          <span className="text-sm font-bold text-[var(--text-heading)]">Interior Studio</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-heading)] transition-colors"
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
          role={role} fullName={fullName} pathname={pathname}
          iconOnly={false} onNavigate={closeMenu}
        />
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className={`studio-sidebar hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-200 ${iconOnly ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'}`}
      >
        <SidebarBody
          role={role} fullName={fullName} pathname={pathname} iconOnly={iconOnly}
        />

        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={toggleIconOnly}
          aria-label={iconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-card)] shadow-md border border-[var(--border-subtle)] hover:border-violet-300 transition-all"
          suppressHydrationWarning
        >
          {iconOnly
            ? <ChevronRight className="h-3 w-3 text-[var(--text-secondary)]" />
            : <ChevronLeft  className="h-3 w-3 text-[var(--text-secondary)]" />
          }
        </button>
      </aside>
    </>
  );
}
