'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

/* Sidebar nav order per spec: Dashboard, Leads, Projects, Quotations,
   Materials, Vendors, Orders, Accounts, Portfolio, Analytics, Settings */
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

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState('');

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setRole((data.user?.user_metadata?.role as string) ?? '');
    });
  }, []);

  const visible = role ? NAV_ITEMS.filter(i => i.roles.includes(role)) : NAV_ITEMS;

  return (
    <aside className="studio-sidebar flex w-60 flex-col flex-shrink-0">
      {/* Brand header */}
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

      {/* Role badge */}
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/8',
              ].join(' ')}
              style={active ? { backgroundColor: 'rgba(200,155,60,0.18)' } : {}}
            >
              {/* Gold left bar for active */}
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

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[10px] text-white/30 tracking-wide">Built by DigitalVetri</p>
      </div>
    </aside>
  );
}
