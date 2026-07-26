'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NAV_ITEMS } from '@/lib/nav-items';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  designer: 'Designer',
  accountant: 'Accountant',
  supervisor: 'Supervisor',
};

// Split navigation so workspace sits above insights/setup, with a small mono
// section label between the two groups.
const WORKSPACE = new Set([
  '/dashboard', '/leads', '/projects', '/quotes',
  '/materials', '/vendors', '/purchase-orders',
]);

// Number the first 9 items with keyboard-hint shortcuts (1..9) so the sidebar
// reads as a real command surface, not a decorated list.
const KEY_HINTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const client = createClient();
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setRole((meta.role as string) ?? '');
      setFullName((meta.full_name as string) ?? data.user?.email ?? '');
    });
  }, []);

  const visible = role ? NAV_ITEMS.filter((i) => i.roles.includes(role)) : NAV_ITEMS;
  const workspaceItems = visible.filter((i) => WORKSPACE.has(i.href));
  const otherItems = visible.filter((i) => !WORKSPACE.has(i.href));

  const initials =
    fullName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IS';

  return (
    <aside className="studio-sidebar flex w-[240px] flex-col flex-shrink-0">
      <div className="side-brand">
        <div className="side-brand-mark">IS</div>
        <div className="side-brand-text">
          <span className="side-brand-title">Interior Studio</span>
          <span className="side-brand-sub">STUDIO · OS</span>
        </div>
      </div>

      <div className="side-section-label">Workspace</div>
      <nav className="side-nav" aria-label="Workspace">
        {workspaceItems.map((item, i) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            hint={KEY_HINTS[i]}
          />
        ))}
      </nav>

      {otherItems.length > 0 && (
        <>
          <div className="side-section-label">Insights &amp; setup</div>
          <nav className="side-nav" aria-label="Insights and setup">
            {otherItems.map((item, i) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                hint={KEY_HINTS[workspaceItems.length + i]}
              />
            ))}
          </nav>
        </>
      )}

      <div className="side-footer">
        <div className="side-account">
          <div className="side-account-mark">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="side-account-name truncate">{fullName || 'Signed out'}</p>
            <p className="side-account-role">{ROLE_LABELS[role] ?? role ?? '—'}</p>
          </div>
          <span className="live-dot" title="Session active" aria-label="Session active" />
        </div>
        <p className="side-credit">Built by DigitalVetri</p>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  pathname,
  hint,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  hint?: string;
}) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="side-nav-item"
      data-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
      {hint && <span className="side-nav-shortcut">{hint}</span>}
    </Link>
  );
}
