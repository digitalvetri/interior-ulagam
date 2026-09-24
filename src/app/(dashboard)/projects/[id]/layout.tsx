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

const PROJECT_TABS = [
  { label: 'Overview',     suffix: ''              },
  { label: 'Deliverables', suffix: '/deliverables' },
  { label: 'Site',         suffix: '/site'         },
  { label: 'Work Orders',  suffix: '/work-orders'  },
  { label: 'Snag',         suffix: '/snag'         },
  { label: 'Documents',    suffix: '/documents'    },
  { label: 'BOQ',          suffix: '/boq'          },
  { label: 'Expenses',     suffix: '/expenses'     },
  { label: 'Payments',     suffix: '/payments'     },
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
  const base       = `/projects/${id}`;

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

        {/* Project sub-navigation */}
        <div
          className="flex gap-0 overflow-x-auto"
          style={{ scrollbarWidth: 'none', borderTop: '1px solid var(--border-subtle)' }}
        >
          {PROJECT_TABS.map(({ label, suffix }) => {
            const href    = `${base}${suffix}`;
            const isActive = suffix === ''
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
            return (
              <Link
                key={suffix}
                href={href}
                className="relative flex-shrink-0 px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap"
                style={{
                  color: isActive ? 'var(--accent-base)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent-base)' : '2px solid transparent',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
