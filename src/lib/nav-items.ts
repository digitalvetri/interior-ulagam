import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  Ruler,
  Palette,
  FileText,
  ShoppingCart,
  Truck,
  Package,
  HardHat,
  Wrench,
  Wallet,
  UserCog,
  Settings,
  Star,
  BarChart3,
  ClipboardList,
  CheckSquare,
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
  roles: string[];
  items: NavItem[];
}

// Admin = full access. Employee = filtered by individual permissions.
// During transition, old roles (owner, designer, supervisor, accountant) are
// treated as: owner→admin, rest→employee.
const ALL_ROLES = ['admin', 'employee', 'owner', 'designer', 'supervisor', 'accountant'];
const ADMIN_ROLES = ['admin', 'owner'];
const FINANCE_ROLES = ['admin', 'owner', 'accountant'];
const DESIGN_ROLES = ['admin', 'owner', 'designer', 'employee'];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    roles: ALL_ROLES,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    roles: ALL_ROLES,
    items: [
      { href: '/leads',     label: 'Enquiries', icon: Users,      roles: ALL_ROLES },
      { href: '/customers', label: 'Clients',   icon: UserCheck,  roles: ALL_ROLES },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    roles: ALL_ROLES,
    items: [
      { href: '/projects',     label: 'Projects',      icon: FolderKanban,  roles: ALL_ROLES },
      { href: '/site-visits',  label: 'Site Visits',   icon: Ruler,         roles: DESIGN_ROLES },
      { href: '/design-tasks', label: 'Design Tasks',  icon: Palette,       roles: DESIGN_ROLES },
      { href: '/quotes',       label: 'Quotations',    icon: FileText,      roles: ALL_ROLES },
      { href: '/work-orders',  label: 'Work Orders',   icon: ClipboardList, roles: ALL_ROLES },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    roles: ALL_ROLES,
    items: [
      { href: '/materials',       label: 'Materials',       icon: Package,      roles: ALL_ROLES },
      { href: '/vendors',         label: 'Vendors',         icon: Truck,        roles: ALL_ROLES },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: ALL_ROLES },
    ],
  },
  {
    key: 'site',
    label: 'Site',
    roles: ALL_ROLES,
    items: [
      { href: '/site-logs', label: 'Site Logs', icon: HardHat, roles: ALL_ROLES },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: FINANCE_ROLES,
    items: [
      { href: '/finance', label: 'Finance', icon: Wallet, roles: FINANCE_ROLES },
    ],
  },
  {
    key: 'after_sales',
    label: 'After Sales',
    roles: ADMIN_ROLES,
    items: [
      { href: '/service',   label: 'Service Requests', icon: Wrench,    roles: ADMIN_ROLES },
      { href: '/portfolio', label: 'Portfolio',        icon: Star,      roles: ADMIN_ROLES },
      { href: '/reports',   label: 'Reports',          icon: BarChart3, roles: ADMIN_ROLES },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    roles: ALL_ROLES,
    items: [
      { href: '/tasks',     label: 'Tasks',     icon: CheckSquare, roles: ALL_ROLES },
      { href: '/employees', label: 'Employees', icon: UserCog,     roles: ADMIN_ROLES },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    roles: ADMIN_ROLES,
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, roles: ADMIN_ROLES },
    ],
  },
];

// Flat list kept for any code that still uses NAV_ITEMS
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
