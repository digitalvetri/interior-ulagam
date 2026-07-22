'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  FolderKanban,
  FileText,
  Package,
  Wallet,
  Settings,
  BarChart3,
  Truck,
  Images,
  ClipboardList,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/leads',                label: 'Leads',      icon: Users,          roles: ['owner', 'designer'] },
  { href: '/projects',             label: 'Projects',   icon: FolderKanban,   roles: ['owner', 'designer'] },
  { href: '/quotes',               label: 'Quotes',     icon: FileText,       roles: ['owner', 'designer'] },
  { href: '/materials',            label: 'Materials',  icon: Package,        roles: ['owner', 'designer', 'accountant'] },
  { href: '/vendors',              label: 'Vendors',    icon: Truck,          roles: ['owner', 'designer'] },
  { href: '/purchase-orders',      label: 'Orders',     icon: ClipboardList,  roles: ['owner', 'designer'] },
  { href: '/accounts',             label: 'Accounts',   icon: Wallet,         roles: ['owner', 'accountant'] },
  { href: '/portfolio',            label: 'Portfolio',  icon: Images,         roles: ['owner', 'designer'] },
  { href: '/analytics/designers',  label: 'Analytics',  icon: BarChart3,      roles: ['owner'] },
  { href: '/settings',             label: 'Settings',   icon: Settings,       roles: ['owner'] },
];

const ROLE_LABELS: Record<string, string> = {
  owner:      'Owner',
  designer:   'Designer',
  accountant: 'Accountant',
  supervisor: 'Supervisor',
};

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setRole((data.user?.user_metadata?.role as string) ?? '');
    });
  }, []);

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : NAV_ITEMS;

  return (
    <aside className="glass-sidebar flex w-60 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://theinteriorstudios.in/wp-content/uploads/2025/09/cropped-intlogo.png"
          alt="The Interior Studio"
          className="h-8 w-8 rounded-lg object-contain flex-shrink-0"
          width={32}
          height={32}
        />
        <span className="text-sm font-bold text-white leading-tight">
          The Interior<br />Studio
        </span>
      </div>

      {/* Role badge */}
      {role && (
        <div className="px-5 pt-4 pb-1">
          <span className="inline-block rounded-full bg-[#c8a45a]/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e8c87a]">
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#c8a45a]/30 text-white shadow-sm'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#e8c87a]' : ''}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[10px] text-white/35">Built by DigitalVetri</p>
      </div>
    </aside>
  );
}
