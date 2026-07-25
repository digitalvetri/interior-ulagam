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

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

/* Sidebar nav order per spec: Dashboard, Leads, Projects, Quotations,
   Materials, Vendors, Orders, Accounts, Portfolio, Analytics, Settings */
export const NAV_ITEMS: NavItem[] = [
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
