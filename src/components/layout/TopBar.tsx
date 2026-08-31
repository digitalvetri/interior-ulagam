'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarDays, LogOut, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationsPopover } from '@/components/layout/NotificationsPopover';
import { CommandPalette } from '@/components/leads/CommandPalette';

const ROLE_LABELS: Record<string, string> = {
  owner:      'Studio Owner',
  designer:   'Designer',
  accountant: 'Accountant',
  supervisor: 'Site Supervisor',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:      { bg: '#111110', text: '#FFFFFF' },
  designer:   { bg: 'var(--success)', text: '#FFFFFF' },
  accountant: { bg: 'var(--accent-base)', text: '#FFFFFF' },
  supervisor: { bg: 'var(--warning)', text: '#111110' },
};

export function TopBar() {
  const [fullName, setFullName] = useState('');
  const [role, setRole]         = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/me')
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        if (!body?.data) return;
        setFullName(body.data.fullName ?? '');
        setRole(body.data.role ?? '');
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  const initials  = fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const roleStyle = ROLE_COLORS[role] ?? ROLE_COLORS.owner;
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <CommandPalette />
      <header className="studio-topbar flex h-16 items-center gap-4 px-6 relative z-10">

        {/* ── Search — always visible, proportional width ──────────── */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="flex items-center gap-2 flex-shrink-0"
          style={{
            width: 'clamp(140px, 22vw, 300px)',
            cursor: 'pointer',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '7px 12px',
            background: 'var(--surface-muted)',
          }}
          aria-label="Open command palette"
          suppressHydrationWarning
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <span
            className="hidden sm:block flex-1 text-left"
            style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
          >
            Search…
          </span>
          <kbd
            className="hidden sm:block flex-shrink-0"
            style={{
              fontSize: 10,
              background: 'var(--surface-app)',
              color: 'var(--text-tertiary)',
              borderRadius: 4,
              padding: '2px 5px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'inherit',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* ── Spacer ──────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── Right actions ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 flex-shrink-0">

          <Link
            href="/calendar"
            aria-label="Calendar"
            title="Calendar"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <CalendarDays className="h-4 w-4" />
          </Link>

          <ThemeToggle />

          <NotificationsPopover />

          {/* User pill — avatar always, name on sm+ */}
          <div
            className="flex items-center gap-2 ml-2 pl-3 border-l"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
              style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
              title={fullName}
            >
              {initials}
            </div>
            {fullName && (
              <div className="hidden sm:block leading-tight">
                <p className="text-[13px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                  {fullName}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {roleLabel}
                </p>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="ml-1 rounded-lg p-2 transition-colors hover:bg-red-50"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
    </>
  );
}
