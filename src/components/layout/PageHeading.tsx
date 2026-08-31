'use client';
import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Lead Pipeline',
  '/customers':           'Customers',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/work-orders':         'Design Tasks',
  '/materials':           'Materials',
  '/vendors':             'Vendors',
  '/purchase-orders':     'Purchase Orders',
  '/invoices':            'Invoices',
  '/accounts':            'Accounts & Payments',
  '/employees':           'Employees',
  '/calendar':            'Calendar',
  '/analytics/designers': 'Analytics',
  '/analytics':           'Analytics',
  '/settings':            'Settings',
};

export function PageHeading() {
  const pathname = usePathname();

  // Dashboard has its own greeting heading — skip the generic title there
  if (pathname === '/dashboard') return null;

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
