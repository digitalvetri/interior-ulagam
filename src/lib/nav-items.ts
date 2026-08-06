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
  Receipt,
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
    key: 'overview',
    label: 'Overview',
    roles: ['owner', 'designer', 'accountant', 'supervisor'],
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'designer', 'accountant', 'supervisor'] },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    roles: ['owner', 'designer'],
    items: [
      { href: '/leads',     label: 'Leads',       icon: Users,      roles: ['owner', 'designer'] },
      { href: '/customers', label: 'Customers',   icon: UserCheck,  roles: ['owner', 'designer'] },
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
    key: 'procurement',
    label: 'Procurement',
    roles: ['owner', 'designer', 'accountant'],
    items: [
      { href: '/materials',       label: 'Materials',       icon: Package,       roles: ['owner', 'designer', 'accountant'] },
      { href: '/vendors',         label: 'Vendors',         icon: Truck,         roles: ['owner', 'designer', 'accountant'] },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart,  roles: ['owner', 'designer', 'accountant'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: ['owner', 'accountant'],
    items: [
      { href: '/invoices',  label: 'Invoices',  icon: Receipt,    roles: ['owner', 'accountant'] },
      { href: '/accounts',  label: 'Accounts & Payments',  icon: Wallet,     roles: ['owner', 'accountant'] },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    roles: ['owner', 'designer', 'supervisor'],
    items: [
      { href: '/employees', label: 'Employees', icon: UserCog,    roles: ['owner'] },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    roles: ['owner'],
    items: [
      { href: '/analytics',           label: 'Analytics', icon: BarChart3, roles: ['owner'] },
    ],
  },
  {
    key: 'system',
    label: 'System',
    roles: ['owner', 'designer', 'accountant', 'supervisor'],
    items: [
      { href: '/settings',       label: 'Settings',      icon: Settings,    roles: ['owner'] },
    ],
  },
];

// Flat list kept for any code that still uses NAV_ITEMS
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
