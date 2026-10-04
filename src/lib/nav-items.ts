import {
  LayoutGrid,
  UserRound,
  UserRoundCheck,
  ChartColumnIncreasing,
  Folder,
  MapPin,
  ShoppingCart,
  UsersRound,
  Wallet,
  FileText,
  ChartColumn,
  CalendarDays,
  Settings,
  CheckSquare,
  CalendarCheck,
  UserCircle,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  TrendingUp,
  Banknote,
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
// Civil Management division — office staff (matches ROLES.CIVIL in lib/auth)
const CIVIL_ROLES    = ['admin', 'owner', 'accountant'];
// Self-service: all staff including admin/owner
const MY_SPACE_ROLES  = ['admin', 'owner', 'employee', 'designer', 'supervisor', 'accountant'];
// Employee self-service only — owners/admins have dedicated pages for these
const EMPLOYEE_ROLES  = ['employee', 'designer', 'supervisor', 'accountant'];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    roles: ALL_ROLES,
    items: [
      // All roles land on /dashboard — admin sees analytics view, staff see employee workspace
      { href: '/dashboard',       label: 'Dashboard',      icon: LayoutGrid,            roles: ALL_ROLES, exact: true },
      { href: '/leads',           label: 'Leads',          icon: UserRound,             roles: DESIGN_ROLES },
      { href: '/customers',       label: 'Clients',        icon: UserRoundCheck,        roles: DESIGN_ROLES },
      { href: '/leads/analytics', label: 'Lead Analytics', icon: ChartColumnIncreasing, roles: ADMIN_ROLES },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    roles: FIELD_ROLES,
    items: [
      { href: '/projects',    label: 'Projects',    icon: Folder, roles: FIELD_ROLES },
      { href: '/site-visits', label: 'Site Visits', icon: MapPin, roles: FIELD_ROLES },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    roles: PROC_ROLES,
    items: [
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: PROC_ROLES },
      { href: '/vendors',         label: 'Vendors',         icon: UsersRound,   roles: PROC_ROLES },
    ],
  },
  {
    key: 'civil',
    label: 'Civil Management',
    roles: CIVIL_ROLES,
    items: [
      { href: '/civil',        label: 'Companies', icon: Building2,       roles: CIVIL_ROLES },
      { href: '/civil/jobs',   label: 'All Jobs',  icon: ClipboardList,   roles: CIVIL_ROLES },
      { href: '/civil/import', label: 'Import',    icon: FileSpreadsheet, roles: CIVIL_ROLES },
      // Real costs and profit are the owner's private numbers.
      { href: '/civil/profit', label: 'Profit',    icon: TrendingUp,      roles: ADMIN_ROLES },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: FINANCE_ROLES,
    items: [
      { href: '/finance',  label: 'Accounts', icon: Wallet,   roles: FINANCE_ROLES },
      { href: '/invoices', label: 'Invoices', icon: FileText, roles: FINANCE_ROLES },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    roles: ALL_ROLES,
    items: [
      // Admin / owner / accountant see studio-wide reporting
      { href: '/reports',             label: 'Reports',            icon: ChartColumn,   roles: FINANCE_ROLES  },
      { href: '/attendance',          label: 'Attendance',         icon: CalendarDays,  roles: FINANCE_ROLES  },
      // Employees use /tasks for their assigned work; owners assign tasks via lead/project pages directly
      { href: '/tasks',               label: 'Tasks',              icon: CheckSquare,   roles: EMPLOYEE_ROLES },
      { href: '/my-space/attendance', label: 'Attendance & Leave', icon: CalendarCheck, roles: EMPLOYEE_ROLES },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    roles: ADMIN_ROLES,
    items: [
      { href: '/employees', label: 'Employees', icon: UsersRound, roles: ADMIN_ROLES },
      { href: '/payroll',   label: 'Payroll',   icon: Banknote,   roles: ADMIN_ROLES },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    roles: ALL_ROLES,
    items: [
      { href: '/my-space/profile', label: 'My Profile', icon: UserCircle, roles: EMPLOYEE_ROLES },
      { href: '/settings',         label: 'Settings',   icon: Settings,   roles: ADMIN_ROLES   },
    ],
  },
];

// Flat list kept for any code that still uses NAV_ITEMS
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
