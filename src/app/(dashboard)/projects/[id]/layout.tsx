'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { STAGE_STYLE_MAP } from '@/types/deliverables';
import type { ProjectStage } from '@/types/deliverables';

interface ProjectMini {
  name: string;
  lifecycleStage: ProjectStage;
  customerFullName?: string | null;
  leadContactName?: string | null;
}

export default function ProjectShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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

      {children}
    </div>
  );
}
