'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  FileText,
  Camera,
  Ruler,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MeasurementRow {
  id: string;
  roundName: string;
  status: string;
  measurementNumber: number;
  completedAt: string | null;
}

interface SiteVisitDetail {
  id: string;
  leadId: string;
  projectId: string | null;
  designerId: string | null;
  status: string;
  purpose: string;
  visitNumber: number | null;
  scheduledAt: string;
  completedAt: string | null;
  locationJson: { address?: string } | null;
  photos: string[];
  notes: string | null;
  followUpNotes: string | null;
  leadName: string | null;
  leadPhone: string | null;
  customerId: string | null;
  customerName: string | null;
  designerName: string | null;
  measurements: MeasurementRow[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PURPOSE_LABELS: Record<string, string> = {
  initial:             'Initial Visit',
  measurement:         'Measurement',
  design_review:       'Design Review',
  site_inspection:     'Site Inspection',
  material_inspection: 'Material Inspection',
  final_inspection:    'Final Inspection',
  other:               'Other',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-32 flex-shrink-0 text-xs text-[var(--text-tertiary)] pt-0.5">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value ?? '—'}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-4 w-40 rounded bg-[var(--surface-muted)]" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteVisitDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [visit, setVisit] = useState<SiteVisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/v1/site-visits/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((body: { data?: SiteVisitDetail; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed to load site visit');
        setVisit(body.data);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkComplete = useCallback(async () => {
    if (!id || !visit || visit.status === 'completed') return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${id}/complete`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      load();
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : 'Failed to mark complete');
    } finally {
      setCompleting(false);
    }
  }, [id, visit, load]);

  if (loading) return <Skeleton />;

  if (fetchError || !visit) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          {fetchError ?? 'Site visit not found.'}
        </div>
      </div>
    );
  }

  const purposeLabel = PURPOSE_LABELS[visit.purpose] ?? visit.purpose ?? 'Site Visit';
  const pageTitle = visit.visitNumber != null
    ? `Visit #${visit.visitNumber}`
    : `Visit ${id.slice(0, 8)}`;
  const isCompleted = visit.status === 'completed';

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={pageTitle}
        subtitle={purposeLabel}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge module="site_visits" status={visit.status} />
            <button
              onClick={handleMarkComplete}
              disabled={isCompleted || completing}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isCompleted ? 'var(--surface-muted)' : 'var(--violet-primary)',
                color: isCompleted ? 'var(--text-secondary)' : '#fff',
              }}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isCompleted ? 'Completed' : 'Mark Complete'}
            </button>
          </div>
        }
      />

      {/* Complete error */}
      {completeError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {completeError}
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Visit Details */}
          <Card title="Visit Details" icon={Calendar}>
            <div className="space-y-2">
              <DetailRow
                label="Scheduled"
                value={fmtDateTime(visit.scheduledAt)}
              />
              {visit.completedAt && (
                <DetailRow
                  label="Completed"
                  value={fmtDateTime(visit.completedAt)}
                />
              )}
              <DetailRow
                label="Address"
                value={
                  visit.locationJson?.address ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      {visit.locationJson.address}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="Designer"
                value={
                  visit.designerName ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      {visit.designerName}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            </div>
          </Card>

          {/* Notes */}
          <Card title="Notes" icon={FileText}>
            {visit.notes ? (
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {visit.notes}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No notes recorded for this visit.</p>
            )}
            {visit.followUpNotes && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Follow-up Notes</p>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {visit.followUpNotes}
                </p>
              </div>
            )}
          </Card>

          {/* Photos */}
          <Card title="Photos" icon={Camera}>
            {visit.photos && visit.photos.length > 0 ? (
              <p className="text-sm text-[var(--text-primary)]">
                {visit.photos.length} photo{visit.photos.length !== 1 ? 's' : ''} recorded
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No photos recorded for this visit.</p>
            )}
          </Card>

          {/* Measurements */}
          <Card title="Measurements" icon={Ruler}>
            {visit.measurements && visit.measurements.length > 0 ? (
              <div className="space-y-2">
                {visit.measurements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-[var(--text-heading)]">
                        {m.roundName}
                        <span className="ml-1.5 text-xs text-[var(--text-tertiary)] font-normal">
                          #{m.measurementNumber}
                        </span>
                      </p>
                      {m.completedAt && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          Completed {fmtDate(m.completedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge module="measurements" status={m.status} />
                      <Link
                        href={`/measurements/${m.id}`}
                        className="text-xs text-[var(--accent-base)] underline underline-offset-2 hover:opacity-70 transition-opacity flex items-center gap-1"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                label="No measurements yet"
                description="Measurements recorded during this visit will appear here."
              />
            )}
            <Link
              href={`/leads/${visit.leadId}?tab=measurements`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
            >
              <Ruler className="h-4 w-4" />
              Record measurements
            </Link>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card title="Related" icon={ExternalLink}>
            <div className="space-y-3">
              {/* Lead */}
              <div className="space-y-0.5">
                <p className="text-xs text-[var(--text-tertiary)]">Lead</p>
                {visit.leadId ? (
                  <Link
                    href={`/leads/${visit.leadId}`}
                    className="text-sm font-medium text-[var(--accent-base)] underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    {visit.leadName ?? visit.leadId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-sm text-[var(--text-tertiary)]">—</span>
                )}
              </div>

              {/* Client */}
              {visit.customerId && (
                <div className="space-y-0.5">
                  <p className="text-xs text-[var(--text-tertiary)]">Client</p>
                  <Link
                    href={`/customers/${visit.customerId}`}
                    className="text-sm font-medium text-[var(--accent-base)] underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    {visit.customerName ?? visit.customerId.slice(0, 8)}
                  </Link>
                </div>
              )}

              {/* Project */}
              {visit.projectId && (
                <div className="space-y-0.5">
                  <p className="text-xs text-[var(--text-tertiary)]">Project</p>
                  <Link
                    href={`/projects/${visit.projectId}`}
                    className="text-sm font-medium text-[var(--accent-base)] underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Linked project
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
