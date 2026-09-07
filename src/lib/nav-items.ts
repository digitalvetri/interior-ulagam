import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  Ruler,
  FileText,
  ShoppingCart,
  Package,
  HardHat,
  ClipboardList,
  Wallet,
  Settings,
  BarChart3,
  CalendarCheck,
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

const ALL_ROLES     = ['admin', 'employee', 'owner', 'designer', 'supervisor', 'accountant'];
const ADMIN_ROLES   = ['admin', 'owner'];
const FINANCE_ROLES = ['admin', 'owner', 'accountant'];
const DESIGN_ROLES  = ['admin', 'owner', 'designer', 'employee'];
const FIELD_ROLES   = ['admin', 'owner', 'designer', 'employee', 'supervisor'];
const SITE_ROLES    = ['admin', 'owner', 'designer', 'supervisor'];
// Procurement: designers track material costs; accountants track payments
const PROC_ROLES    = ['admin', 'owner', 'designer', 'accountant'];

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
    key: 'pipeline',
    label: 'Pipeline',
    roles: DESIGN_ROLES,
    items: [
      { href: '/leads',     label: 'Leads',   icon: Users,     roles: DESIGN_ROLES },
      { href: '/customers', label: 'Clients', icon: UserCheck, roles: DESIGN_ROLES },
    ],
  },
  {
    // Quotations visible to ALL_ROLES so group must include accountant
    key: 'projects',
    label: 'Projects',
    roles: ALL_ROLES,
    items: [
      { href: '/projects',    label: 'Projects',    icon: FolderKanban, roles: FIELD_ROLES },
      { href: '/quotes',      label: 'Quotations',  icon: FileText,     roles: ALL_ROLES },
      { href: '/site-visits', label: 'Site Visits', icon: Ruler,        roles: SITE_ROLES },
    ],
  },
  {
    key: 'execution',
    label: 'Execution',
    roles: FIELD_ROLES,
    items: [
      { href: '/work-orders', label: 'Work Orders', icon: ClipboardList, roles: SITE_ROLES },
      { href: '/site-logs',   label: 'Site Logs',   icon: HardHat,       roles: SITE_ROLES },
      { href: '/materials',   label: 'Materials',   icon: Package,       roles: DESIGN_ROLES },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: PROC_ROLES,
    items: [
      { href: '/finance',         label: 'Accounts',        icon: Wallet,       roles: FINANCE_ROLES },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: PROC_ROLES },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    roles: FINANCE_ROLES,
    items: [
      { href: '/reports',    label: 'Reports',    icon: BarChart3,    roles: FINANCE_ROLES },
      { href: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: FINANCE_ROLES },
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
