'use client';
import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/leads':               'Lead Pipeline',
  '/customers':           'Customers',
  '/projects':            'Projects',
  '/quotes':              'Quotations',
  '/design-tasks':        'Design Tasks',
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
