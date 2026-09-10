'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  MessageSquare,
  Users,
  TrendingUp,
  Image as ImageIcon,
  FileText,
  ShieldAlert,
  ListChecks,
  FolderKanban,
  Wrench,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SiteLogDetail {
  id: string;
  projectId: string;
  projectName: string;
  logDate: string;
  photos: string[];
  transcript: string | null;
  progressPct: number | null;
  stage: string | null;
  activityType: string | null;
  delayFlag: boolean;
  labourCount: number | null;
  blockersJson: unknown | null;
  source: string;
  followUpActions: string | null;
  attachments: string[];
  relatedWorkOrderIds: string[];
  createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
        <h2 className="text-sm font-semibold text-[var(--text-heading)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-[var(--surface-muted)]" />
      <div className="h-4 w-40 rounded bg-[var(--surface-muted)]" />
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="sticky top-6 self-start space-y-4">
          <div className="h-24 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-24 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteLogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [log, setLog] = useState<SiteLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/v1/site-logs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((body: { data?: SiteLogDetail; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed to load site log');
        setLog(body.data);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Skeleton />;

  if (fetchError || !log) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          {fetchError ?? 'Site log not found.'}
        </div>
      </div>
    );
  }

  const formattedDate = fmtDate(log.logDate);

  const sourceBadge = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{
        background: log.source === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'var(--surface-muted)',
        color: log.source === 'whatsapp' ? '#128c3d' : 'var(--text-secondary)',
      }}
    >
      {log.source === 'whatsapp' && <MessageSquare className="h-3 w-3" />}
      {log.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
    </span>
  );

  const delayBadge = log.delayFlag ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <AlertTriangle className="h-3 w-3" />
      Delayed
    </span>
  ) : null;

  return (
    <div className="px-6 py-6 space-y-6">

      {/* Header */}
      <PageHeader
        title={`Site Log — ${formattedDate}`}
        subtitle={log.projectName}
        actions={
          <>
            {sourceBadge}
            {delayBadge}
          </>
        }
      />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">

        {/* LEFT — main content */}
        <div className="space-y-4">

          {/* Progress card */}
          <Card title="Progress" icon={TrendingUp}>
            <div className="space-y-3">
              {log.progressPct !== null ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Progress</span>
                    <span className="font-semibold text-[var(--text-heading)]">{log.progressPct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div
                      className="bg-green-500 h-2 rounded transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, log.progressPct))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">No progress recorded</p>
              )}

              <div className="flex flex-wrap gap-4 pt-1">
                {log.stage && (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Stage</p>
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{log.stage}</p>
                  </div>
                )}
                {log.labourCount !== null && (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Labour</p>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">{log.labourCount} workers</p>
                    </div>
                  </div>
                )}
                {log.activityType && (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Activity</p>
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{log.activityType}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Notes / Transcript card */}
          <Card title="Notes / Transcript" icon={FileText}>
            {log.transcript ? (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {log.transcript}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No transcript</p>
            )}
          </Card>

          {/* Blockers card */}
          <Card title="Blockers" icon={ShieldAlert}>
            {log.blockersJson != null ? (
              <pre className="text-xs text-[var(--text-primary)] bg-[var(--surface-muted)] rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.blockersJson, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No blockers</p>
            )}
          </Card>

          {/* Follow-up Actions card */}
          <Card title="Follow-up Actions" icon={ListChecks}>
            {log.followUpActions ? (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {log.followUpActions}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">None</p>
            )}
          </Card>

          {/* Photos card */}
          <Card title="Photos" icon={ImageIcon}>
            {(log.photos ?? []).length > 0 ? (
              <p className="text-sm text-[var(--text-primary)]">
                {(log.photos ?? []).length} photo{(log.photos ?? []).length !== 1 ? 's' : ''} attached
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No photos</p>
            )}
          </Card>
        </div>

        {/* RIGHT — sticky sidebar */}
        <div className="sticky top-6 self-start space-y-4">

          {/* Related project card */}
          <Card title="Related" icon={FolderKanban}>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Project</p>
              <Link
                href={`/projects/${log.projectId}`}
                className="text-sm font-medium text-[var(--text-heading)] hover:text-violet-600 transition-colors underline underline-offset-2"
              >
                {log.projectName}
              </Link>
            </div>
          </Card>

          {/* Work orders card */}
          <Card title="Work Orders" icon={Wrench}>
            {(log.relatedWorkOrderIds ?? []).length > 0 ? (
              <ul className="space-y-1.5">
                {(log.relatedWorkOrderIds ?? []).map((woId) => (
                  <li key={woId}>
                    <Link
                      href={`/work-orders/${woId}`}
                      className="text-sm text-[var(--text-heading)] hover:text-violet-600 transition-colors underline underline-offset-2 font-medium"
                    >
                      {woId}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">None</p>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
