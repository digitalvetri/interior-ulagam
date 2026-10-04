'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, House, LogOut, Search, Settings, UserCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationsPopover } from '@/components/layout/NotificationsPopover';
import { CommandPalette } from '@/components/leads/CommandPalette';
import { useUser } from '@/components/providers/user-provider';
import { NAV_ITEMS } from '@/lib/nav-items';
import { ROLE_LABELS } from '@/lib/roles';

/** The page name for the breadcrumb — the longest nav entry the path sits under. */
function pageLabel(pathname: string): string {
  if (pathname === '/dashboard') return 'Overview';
  const match = NAV_ITEMS
    .filter(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return match.label;
  const seg = pathname.split('/').filter(Boolean)[0] ?? '';
  return seg ? seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Overview';
}

function UserMenu() {
  const { fullName, role } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  const initial   = fullName.trim().charAt(0).toUpperCase() || '?';
  const roleLabel = ROLE_LABELS[role] ?? role;
  const isOwner   = role === 'owner';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-1.5 transition-colors hover:bg-[var(--surface-hover)]"
        suppressHydrationWarning
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
          style={{ background: 'var(--accent-base)' }}
        >
          {initial}
        </span>
        {fullName && (
          <span className="hidden text-left leading-tight xl:block">
            <span className="block whitespace-nowrap text-[13.5px] font-semibold" style={{ color: 'var(--text-heading)' }}>
              {fullName}
            </span>
            <span className="block whitespace-nowrap text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {roleLabel}
            </span>
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[48px] z-50 w-60 overflow-hidden rounded-xl border py-1.5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}
        >
          <div className="px-4 pb-2.5 pt-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="truncate text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>{fullName || '—'}</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{roleLabel}</p>
          </div>
          <Link
            role="menuitem"
            href={isOwner ? '/settings' : '/my-space/profile'}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {isOwner ? <Settings className="h-4 w-4" /> : <UserCircle className="h-4 w-4" />}
            {isOwner ? 'Settings' : 'My profile'}
          </Link>
          <div className="flex items-center justify-between px-4 py-1.5 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-[var(--danger-soft)]"
            style={{ color: 'var(--danger-text)', borderTop: '1px solid var(--border-subtle)' }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();

  return (
    <>
      <CommandPalette />
      <header className="studio-topbar relative z-10 hidden h-[60px] flex-shrink-0 items-center gap-4 px-5 lg:flex xl:px-6">

        {/* ── Home + breadcrumb ──────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-shrink-0 items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Home"
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-hover)]"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-heading)' }}
          >
            <House className="h-4 w-4" strokeWidth={1.7} />
          </Link>
          <span className="hidden text-[13.5px] xl:inline" style={{ color: 'var(--text-secondary)' }}>Workspace</span>
          <span className="hidden text-[13.5px] xl:inline" style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span className="truncate text-[13.5px] font-semibold" style={{ color: 'var(--text-heading)' }}>
            {pageLabel(pathname)}
          </span>
        </nav>

        {/* ── Search — opens the command palette ───────────────── */}
        <div className="flex flex-1 justify-center px-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex w-full max-w-[440px] items-center gap-2.5 rounded-lg border px-3.5 transition-colors hover:border-[var(--border-strong)]"
            style={{ height: 38, borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
            aria-label="Search leads, projects, clients"
            suppressHydrationWarning
          >
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} strokeWidth={1.6} />
            <span className="flex-1 truncate text-left text-[13.5px]" style={{ color: 'var(--text-tertiary)' }}>
              Search leads, projects, clients…
            </span>
            <kbd
              className="hidden flex-shrink-0 rounded border px-1.5 py-0.5 text-[10.5px] 2xl:block"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)', fontFamily: 'inherit' }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* ── Right actions ───────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-center gap-1">
          <Link
            href="/calendar"
            aria-label="Calendar"
            title="Calendar"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-heading)' }}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={1.5} />
          </Link>

          <NotificationsPopover />

          <div className="mx-2 h-8 w-px" style={{ background: 'var(--border-subtle)' }} />

          <UserMenu />
        </div>
      </header>
    </>
  );
}
