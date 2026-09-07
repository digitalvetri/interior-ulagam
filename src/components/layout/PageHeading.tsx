'use client';
import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Leads',
  '/customers':           'Clients',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/site-visits':         'Site Visits',
  '/work-orders':         'Work Orders',
  '/site-logs':           'Site Logs',
  '/materials':           'Materials',
  '/purchase-orders':     'Purchase Orders',
  '/finance':             'Accounts',
  '/reports':             'Reports',
  '/settings':            'Settings',
  // Direct-access pages (not in sidebar, still navigable)
  '/design-tasks':        'Design Tasks',
  '/vendors':             'Vendors',
  '/employees':           'Employees',
  '/portfolio':           'Portfolio',
  '/service':             'Service Requests',
  '/tasks':               'Tasks',
  '/invoices':            'Invoices',
  '/analytics':           'Analytics',
};

export function PageHeading() {
  const pathname = usePathname();

  // These pages have their own self-contained header sections
  if (pathname === '/dashboard' || pathname === '/leads') return null;

  const title = Object.entries(PAGE_TITLES).find(
    ([key]) => pathname === key || pathname.startsWith(key + '/')
  )?.[1];

  if (!title) return null;

  return (
    <div className="mb-5">
      <h1
        className="text-[22px] font-bold tracking-tight"
        style={{ color: 'var(--text-heading)', lineHeight: 1.2 }}
      >
        {title}
      </h1>
    </div>
  );
}
