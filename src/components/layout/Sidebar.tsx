'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Package,
  Truck,
  ClipboardList,
  Wallet,
  Images,
  BarChart3,
  Settings,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',            label: 'Dashboard',   icon: LayoutDashboard, roles: ['owner', 'designer', 'accountant'] },
  { href: '/leads',                label: 'Leads',       icon: Users,           roles: ['owner', 'designer'] },
  { href: '/projects',             label: 'Projects',    icon: FolderKanban,    roles: ['owner', 'designer'] },
  { href: '/quotes',               label: 'Quotations',  icon: FileText,        roles: ['owner', 'designer'] },
  { href: '/materials',            label: 'Materials',   icon: Package,         roles: ['owner', 'designer', 'accountant'] },
  { href: '/vendors',              label: 'Vendors',     icon: Truck,           roles: ['owner', 'designer'] },
  { href: '/purchase-orders',      label: 'Orders',      icon: ClipboardList,   roles: ['owner', 'designer'] },
  { href: '/accounts',             label: 'Accounts',    icon: Wallet,          roles: ['owner', 'accountant'] },
  { href: '/portfolio',            label: 'Portfolio',   icon: Images,          roles: ['owner', 'designer'] },
  { href: '/analytics/designers',  label: 'Analytics',   icon: BarChart3,       roles: ['owner'] },
  { href: '/settings',             label: 'Settings',    icon: Settings,        roles: ['owner'] },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', designer: 'Designer', accountant: 'Accountant', supervisor: 'Supervisor',
};

function NavList({
  role,
  pathname,
  onNavigate,
}: {
  role: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const visible = role ? NAV_ITEMS.filter(i => i.roles.includes(role)) : NAV_ITEMS;
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={[
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
              active
                ? 'text-white'
                : 'text-white/60 hover:text-white hover:bg-white/8',
            ].join(' ')}
            style={active ? { backgroundColor: 'rgba(200,155,60,0.18)' } : {}}
          >
            <span
              className={[
                'absolute left-0 w-0.5 h-5 rounded-r-full transition-all duration-150',
                active ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ backgroundColor: '#C89B3C' }}
            />
            <Icon
              className="h-4 w-4 flex-shrink-0 transition-colors"
              style={{ color: active ? '#C89B3C' : undefined }}
            />
            <span>{label}</span>
            {active && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#C89B3C' }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandHeader({ role }: { role: string }) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
          alt=""
          className="h-8 w-8 rounded-lg object-contain flex-shrink-0"
          width={32} height={32}
        />
        <div className="leading-tight">
          <p className="text-[13px] font-bold text-white">The Interior</p>
          <p className="text-[11px] font-medium text-white/60">Studio</p>
        </div>
      </div>
      {role && (
        <div className="px-4 pt-4 pb-1">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(200,155,60,0.2)', color: '#C89B3C' }}
          >
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      // Prefer app_metadata (server-only, not user-editable); fall back to user_metadata for
      // existing accounts that haven't been migrated yet.
      const meta = data.user?.app_metadata ?? data.user?.user_metadata ?? {};
      setRole((meta.role as string) ?? '');
    });
  }, []);

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  // Close mobile drawer on route change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      {/* ── Mobile top bar (hamburger) ───────────────────────────────────── */}
      <div
        className="lg:hidden flex items-center justify-between h-14 px-4 fixed top-0 left-0 right-0 z-40"
        style={{ background: '#4B2E2B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
            alt="" className="h-7 w-7 rounded object-contain" width={28} height={28}
          />
          <span className="text-sm font-bold text-white">Interior Studio</span>
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────────────────────────── */}
      <aside
        className={[
          'lg:hidden studio-sidebar fixed top-14 left-0 bottom-0 z-40 w-64 flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <BrandHeader role={role} />
        <NavList role={role} pathname={pathname} onNavigate={closeMenu} />
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[10px] text-white/30 tracking-wide">Built by DigitalVetri</p>
        </div>
      </aside>

      {/* ── Desktop sidebar (always visible on lg+) ──────────────────────── */}
      <aside className="studio-sidebar hidden lg:flex w-60 flex-col flex-shrink-0">
        <BrandHeader role={role} />
        <NavList role={role} pathname={pathname} />
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[10px] text-white/30 tracking-wide">Built by DigitalVetri</p>
        </div>
      </aside>
    </>
  );
}
