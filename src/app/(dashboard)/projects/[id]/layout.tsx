'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { STAGE_STYLE_MAP } from '@/types/deliverables';
import type { ProjectStage } from '@/types/deliverables';

interface ProjectMini {
  name: string;
  lifecycleStage: ProjectStage;
  customerFullName?: string | null;
  leadContactName?: string | null;
}

const PROJECT_TABS = (id: string) => [
  { href: `/projects/${id}`,              label: 'Overview',     exact: true  },
  { href: `/projects/${id}/payments`,     label: 'Payments',     exact: false },
  { href: `/projects/${id}/expenses`,     label: 'Expenses',     exact: false },
  { href: `/projects/${id}/boq`,          label: 'BOQ',          exact: false },
  { href: `/projects/${id}/deliverables`, label: 'Deliverables', exact: false },
  { href: `/projects/${id}/documents`,    label: 'Documents',    exact: false },
  { href: `/projects/${id}/site`,         label: 'Site',         exact: false },
  { href: `/projects/${id}/work-orders`,  label: 'Work Orders',  exact: false },
];

export default function ProjectShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const [project, setProject] = useState<ProjectMini | null>(null);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}`)
      .then(r => r.json())
      .then(({ data }: { data: ProjectMini | null }) => setProject(data ?? null))
      .catch(() => null);
  }, [id]);

  const clientName = project?.customerFullName ?? project?.leadContactName ?? null;
  const stage      = project?.lifecycleStage ? STAGE_STYLE_MAP[project.lifecycleStage] : null;

  return (
    <div className="flex min-h-full flex-col" style={{ background: 'var(--surface-bg)' }}>

      {/* Persistent project shell header */}
      <div style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="px-6 py-4">

          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-[12px] font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-heading)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <ArrowLeft className="h-3 w-3" />
            All Projects
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {project ? (
              <h1 className="text-[18px] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                {project.name}
              </h1>
            ) : (
              <div
                className="animate-pulse rounded"
                style={{ height: 22, width: 220, background: 'var(--surface-muted)' }}
              />
            )}
            {stage && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: stage.bg, color: stage.fg }}
              >
                {stage.label}
              </span>
            )}
            {clientName && (
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                · {clientName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div
        className="flex overflow-x-auto scrollbar-hide"
        style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        {PROJECT_TABS(id).map(tab => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: active ? 'var(--accent-base)' : 'var(--text-secondary)',
                borderBottom: active ? '2px solid var(--accent-base)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
