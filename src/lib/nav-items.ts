import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  Ruler,
  ShoppingCart,
  Wallet,
  Settings,
  BarChart3,
  CalendarCheck,
  CheckSquare,
  UserCircle,
  Store,
  Receipt,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
  exact?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  roles: string[];
  items: NavItem[];
}

const ALL_ROLES      = ['admin', 'employee', 'owner', 'designer', 'supervisor', 'accountant'];
const ADMIN_ROLES    = ['admin', 'owner'];
const FINANCE_ROLES  = ['admin', 'owner', 'accountant'];
const DESIGN_ROLES   = ['admin', 'owner', 'designer', 'employee'];
const FIELD_ROLES    = ['admin', 'owner', 'designer', 'employee', 'supervisor'];
const PROC_ROLES     = ['admin', 'owner', 'designer', 'accountant'];
// Self-service: all non-owner staff
const MY_SPACE_ROLES = ['employee', 'designer', 'supervisor', 'accountant'];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    roles: ALL_ROLES,
    items: [
      // All roles land on /dashboard — admin sees analytics view, staff see employee workspace
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES, exact: true },
    ],
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    roles: DESIGN_ROLES,
    items: [
      { href: '/leads',     label: 'Leads',   icon: Users,     roles: DESIGN_ROLES },
      { href: '/customers', label: 'Clients', icon: UserCheck, roles: DESIGN_ROLES },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    roles: ALL_ROLES,
    items: [
      { href: '/projects',    label: 'Projects',    icon: FolderKanban, roles: FIELD_ROLES },
      { href: '/site-visits', label: 'Site Visits', icon: Ruler,        roles: FIELD_ROLES },
    ],
  },
  {
    key: 'execution',
    label: 'Execution',
    roles: PROC_ROLES,
    items: [
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: PROC_ROLES },
      { href: '/vendors',         label: 'Vendors',         icon: Store,        roles: PROC_ROLES },
    ],
  },

  {
    key: 'finance',
    label: 'Accounts & Payments',
    roles: FINANCE_ROLES,
    items: [
      { href: '/finance',   label: 'Accounts', icon: Wallet,   roles: FINANCE_ROLES },
      { href: '/invoices',  label: 'Invoices', icon: Receipt,  roles: FINANCE_ROLES },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    roles: ALL_ROLES,
    items: [
      // Admin / owner / accountant see studio-wide reporting
      { href: '/reports',             label: 'Reports',           icon: BarChart3,     roles: FINANCE_ROLES  },
      { href: '/attendance',          label: 'Attendance',        icon: CalendarCheck, roles: FINANCE_ROLES  },
      // Employees use /tasks for their assigned work; owners assign tasks via lead/project pages directly
      { href: '/tasks',               label: 'Tasks',              icon: CheckSquare,   roles: MY_SPACE_ROLES },
      { href: '/my-space/attendance', label: 'Attendance & Leave', icon: CalendarCheck, roles: MY_SPACE_ROLES },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    roles: ALL_ROLES,
    items: [
      { href: '/my-space/profile', label: 'My Profile', icon: UserCircle, roles: MY_SPACE_ROLES },
      { href: '/settings',         label: 'Settings',   icon: Settings,   roles: ADMIN_ROLES    },
    ],
  },
];

// Flat list kept for any code that still uses NAV_ITEMS
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
