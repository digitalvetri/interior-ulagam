import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  FileText,
  ShoppingCart,
  Truck,
  Package,
  Wrench,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
}

export interface NavGroup {
  key: string;
  label: string;
  roles: string[];     // group is hidden if user has none of these roles
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    label: 'Home',
    roles: ['owner', 'designer', 'accountant', 'supervisor'],
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'designer', 'accountant', 'supervisor'] },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    roles: ['owner', 'designer'],
    items: [
      { href: '/leads',     label: 'Leads',     icon: Users,     roles: ['owner', 'designer'] },
      { href: '/customers', label: 'Customers', icon: UserCheck, roles: ['owner', 'designer'] },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    roles: ['owner', 'designer', 'supervisor'],
    items: [
      { href: '/projects',    label: 'Projects',    icon: FolderKanban, roles: ['owner', 'designer', 'supervisor'] },
      { href: '/quotes',      label: 'Quotations',  icon: FileText,     roles: ['owner', 'designer'] },
      { href: '/work-orders', label: 'Design Tasks', icon: Wrench,      roles: ['owner', 'designer', 'supervisor'] },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    roles: ['owner', 'designer', 'accountant'],
    items: [
      { href: '/materials',       label: 'Materials',       icon: Package,      roles: ['owner', 'designer', 'accountant'] },
      { href: '/vendors',         label: 'Vendors',         icon: Truck,        roles: ['owner', 'designer', 'accountant'] },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: ['owner', 'designer', 'accountant'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: ['owner', 'accountant'],
    items: [
      { href: '/accounts', label: 'Finance', icon: Wallet, roles: ['owner', 'accountant'] },
    ],
  },
];

// Secondary footer nav — shown at the bottom of the sidebar, above the user chip
export const FOOTER_NAV: NavItem[] = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['owner'] },
  { href: '/employees', label: 'Employees', icon: UserCog,   roles: ['owner'] },
  { href: '/settings',  label: 'Settings',  icon: Settings,  roles: ['owner'] },
];

// Flat list — includes footer items so CommandPalette can search them
export const NAV_ITEMS = [...NAV_GROUPS.flatMap(g => g.items), ...FOOTER_NAV];
