import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  HardHat,
  FileText,
  ShoppingCart,
  Truck,
  Package,
  Boxes,
  ClipboardList,
  Wrench,
  Receipt,
  CreditCard,
  Wallet,
  UserCog,
  CalendarDays,
  Images,
  BarChart3,
  FolderOpen,
  Bell,
  Settings,
  ShieldCheck,
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
      { href: '/site-visits', label: 'Site Visits', icon: HardHat,      roles: ['owner', 'designer', 'supervisor'] },
      { href: '/quotes',      label: 'Quotations',  icon: FileText,     roles: ['owner', 'designer'] },
      { href: '/work-orders', label: 'Work Orders', icon: Wrench,       roles: ['owner', 'designer', 'supervisor'] },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    roles: ['owner', 'designer', 'accountant'],
    items: [
      { href: '/materials',       label: 'Materials',       icon: Package,       roles: ['owner', 'designer', 'accountant'] },
      { href: '/inventory',       label: 'Inventory',       icon: Boxes,         roles: ['owner', 'accountant'] },
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
      { href: '/payments',  label: 'Payments',  icon: CreditCard, roles: ['owner', 'accountant'] },
      { href: '/accounts',  label: 'Accounts',  icon: Wallet,     roles: ['owner', 'accountant'] },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    roles: ['owner', 'designer', 'supervisor'],
    items: [
      { href: '/employees', label: 'Employees', icon: UserCog,    roles: ['owner'] },
      { href: '/calendar',  label: 'Calendar',  icon: CalendarDays, roles: ['owner', 'designer', 'supervisor'] },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    roles: ['owner', 'designer'],
    items: [
      { href: '/portfolio',  label: 'Portfolio',  icon: Images,     roles: ['owner', 'designer'] },
      { href: '/documents',  label: 'Documents',  icon: FolderOpen, roles: ['owner', 'designer'] },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    roles: ['owner'],
    items: [
      { href: '/analytics/designers', label: 'Analytics', icon: BarChart3, roles: ['owner'] },
    ],
  },
  {
    key: 'system',
    label: 'System',
    roles: ['owner', 'designer', 'accountant', 'supervisor'],
    items: [
      { href: '/notifications',  label: 'Notifications', icon: Bell,        roles: ['owner', 'designer', 'accountant', 'supervisor'] },
      { href: '/settings',       label: 'Settings',      icon: Settings,    roles: ['owner'] },
      { href: '/settings/users', label: 'User Mgmt',     icon: ShieldCheck, roles: ['owner'] },
    ],
  },
];

// Flat list kept for any code that still uses NAV_ITEMS
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
