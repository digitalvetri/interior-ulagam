import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  Ruler,
  FileText,
  ShoppingCart,
  Wallet,
  Settings,
  BarChart3,
  CalendarCheck,
  CheckSquare,
  UserCircle,
  Store,
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
      // Owners see the studio command-centre dashboard
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ADMIN_ROLES,    exact: true },
      // All other staff get their personal My Space dashboard
      { href: '/my-space',  label: 'Dashboard', icon: LayoutDashboard, roles: MY_SPACE_ROLES, exact: true },
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
    label: 'Finance',
    roles: FINANCE_ROLES,
    items: [
      { href: '/finance', label: 'Accounts', icon: Wallet, roles: FINANCE_ROLES },
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
      // All staff see their own task + attendance pages
      { href: '/my-space/tasks',      label: 'My Tasks',          icon: CheckSquare,   roles: MY_SPACE_ROLES },
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
