'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, Calendar, MapPin, User,
  FileText, Camera, CheckCircle2, XCircle,
  UserX, RefreshCw,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Types ─────────────────────────────────────────────────────────────────────

type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

interface SiteVisitDetail {
  id: string;
  leadId: string;
  projectId: string | null;
  designerId: string | null;
  status: VisitStatus;
  purpose: string | null;
  visitNumber: string | null;
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
}

interface CompleteForm {
  notes: string;
  outcome: string;
  photos: string;
  createFollowUp: boolean;
  followUpDate: string;
  followUpStage: string;
  followUpStatus: string;
  followUpComments: string;
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

const FOLLOW_UP_STAGES = [
  { value: 'contacted',    label: 'Contacted'    },
  { value: 'qualified',    label: 'Qualified'    },
  { value: 'site_visit',   label: 'Site Visit'   },
  { value: 'measurement',  label: 'Measurement'  },
  { value: 'quotation',    label: 'Quotation'    },
  { value: 'negotiation',  label: 'Negotiation'  },
];

const FOLLOW_UP_STATUSES = [
  { value: 'interested',        label: 'Interested'        },
  { value: 'callback',          label: 'Callback Requested' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled'  },
  { value: 'thinking',          label: 'Thinking'           },
  { value: 'negotiating',       label: 'Negotiating'        },
  { value: 'not_interested',    label: 'Not Interested'     },
];

const TERMINAL_STATUSES = new Set<VisitStatus>(['completed', 'cancelled', 'no_show']);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
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
    <div className="px-6 py-6 space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-4 w-40 rounded bg-[var(--surface-muted)]" />
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="sticky top-6 self-start space-y-4">
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

  const [visit,      setVisit]      = useState<SiteVisitDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialogs
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAt,   setRescheduleAt]   = useState('');
  const [rescheduleAddr, setRescheduleAddr] = useState('');
  const [rescheduling,   setRescheduling]   = useState(false);
  const [rescheduleErr,  setRescheduleErr]  = useState<string | null>(null);

  const [cancelOpen,   setCancelOpen]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelErr,    setCancelErr]    = useState<string | null>(null);

  const [noShowOpen,   setNoShowOpen]   = useState(false);
  const [noShowing,    setNoShowing]    = useState(false);
  const [noShowErr,    setNoShowErr]    = useState<string | null>(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [completeErr,  setCompleteErr]  = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteForm>({
    notes: '', outcome: '', photos: '',
    createFollowUp: false,
    followUpDate: '', followUpStage: 'site_visit', followUpStatus: 'interested', followUpComments: '',
  });

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/v1/site-visits/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((body: { data?: SiteVisitDetail; error?: string }) => {
        if (!body.data) throw new Error(body.error ?? 'Failed to load site visit');
        setVisit(body.data);
      })
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Open reschedule dialog pre-filled with current values
  function openReschedule() {
    if (!visit) return;
    setRescheduleAt(toLocalDatetimeValue(visit.scheduledAt));
    setRescheduleAddr(visit.locationJson?.address ?? '');
    setRescheduleErr(null);
    setRescheduleOpen(true);
  }

  async function handleReschedule() {
    if (!rescheduleAt) { setRescheduleErr('Choose a new date and time.'); return; }
    if (!rescheduleAddr.trim()) { setRescheduleErr('Enter the address.'); return; }
    setRescheduling(true);
    setRescheduleErr(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: new Date(rescheduleAt).toISOString(),
          address:     rescheduleAddr.trim(),
        }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setRescheduleErr(typeof b.error === 'string' ? b.error : 'Failed to reschedule');
        return;
      }
      setRescheduleOpen(false);
      load();
    } catch {
      setRescheduleErr('Network error — try again');
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setCancelErr(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setCancelErr(typeof b.error === 'string' ? b.error : 'Failed to cancel');
        return;
      }
      setCancelOpen(false);
      load();
    } catch {
      setCancelErr('Network error — try again');
    } finally {
      setCancelling(false);
    }
  }

  async function handleNoShow() {
    setNoShowing(true);
    setNoShowErr(null);
    try {
      const res = await fetch(`/api/v1/site-visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'no_show' }),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setNoShowErr(typeof b.error === 'string' ? b.error : 'Failed to mark no-show');
        return;
      }
      setNoShowOpen(false);
      load();
    } catch {
      setNoShowErr('Network error — try again');
    } finally {
      setNoShowing(false);
    }
  }

  async function handleComplete() {
    if (completeForm.createFollowUp && !completeForm.followUpStage) {
      setCompleteErr('Select a follow-up stage.');
      return;
    }
    setCompleting(true);
    setCompleteErr(null);
    try {
      const photos = completeForm.photos
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const body: Record<string, unknown> = {
        notes:   completeForm.notes.trim() || undefined,
        outcome: completeForm.outcome.trim() || undefined,
        photos:  photos.length > 0 ? photos : undefined,
      };

      if (completeForm.createFollowUp) {
        body.followUp = {
          followUpDate:  completeForm.followUpDate
            ? new Date(completeForm.followUpDate).toISOString()
            : null,
          stage:        completeForm.followUpStage,
          clientStatus: completeForm.followUpStatus,
          comments:     completeForm.followUpComments.trim() || undefined,
          addToCalendar: true,
        };
      }

      const res = await fetch(`/api/v1/site-visits/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; followUpWarning?: string };
      if (!res.ok) {
        setCompleteErr(typeof json.error === 'string' ? json.error : 'Failed to complete');
        return;
      }
      if (json.followUpWarning) {
        setCompleteErr(`Completed, but follow-up not created: ${json.followUpWarning}`);
      }
      setCompleteOpen(false);
      load();
    } catch {
      setCompleteErr('Network error — try again');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <Skeleton />;

  if (fetchError || !visit) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          {fetchError ?? 'Site visit not found.'}
        </div>
      </div>
    );
  }

  const purposeLabel = PURPOSE_LABELS[visit.purpose ?? ''] ?? visit.purpose ?? 'Site Visit';
  const pageTitle = visit.visitNumber ?? `Visit ${id.slice(0, 8)}`;
  const isTerminal = TERMINAL_STATUSES.has(visit.status);

  return (
    <div className="px-6 py-6 space-y-6">

      {/* Header */}
      <PageHeader
        title={pageTitle}
        subtitle={purposeLabel}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge module="site_visits" status={visit.status} />

            {!isTerminal && (
              <>
                <button
                  onClick={openReschedule}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium border transition-colors"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reschedule
                </button>
                <button
                  onClick={() => { setCancelErr(null); setCancelOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium border transition-colors"
                  style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FFF1F2' }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel Visit
                </button>
                <button
                  onClick={() => { setNoShowErr(null); setNoShowOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium border transition-colors"
                  style={{ borderColor: '#FDE68A', color: '#92400E', background: '#FFFBEB' }}
                >
                  <UserX className="h-3.5 w-3.5" />
                  No Show
                </button>
                <button
                  onClick={() => {
                    setCompleteErr(null);
                    setCompleteOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Complete
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">

        {/* Left column */}
        <div className="space-y-4">

          {/* Visit Details */}
          <Card title="Visit Details" icon={Calendar}>
            <div className="space-y-2">
              <DetailRow label="Scheduled" value={fmtDateTime(visit.scheduledAt)} />
              {visit.completedAt && (
                <DetailRow label="Completed" value={fmtDateTime(visit.completedAt)} />
              )}
              <DetailRow
                label="Address"
                value={
                  visit.locationJson?.address ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      {visit.locationJson.address}
                    </span>
                  ) : null
                }
              />
              <DetailRow
                label="Assigned To"
                value={
                  visit.designerName ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      {visit.designerName}
                    </span>
                  ) : null
                }
              />
              {visit.leadPhone && (
                <DetailRow label="Contact" value={visit.leadPhone} />
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card title="Notes" icon={FileText}>
            {visit.notes ? (
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {visit.notes}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No notes recorded.</p>
            )}
          </Card>

          {/* Designer's report (set on completion) */}
          {visit.followUpNotes && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />
                <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-base)' }}>
                  {visit.designerName ? `${visit.designerName}'s Report` : 'Field Report'}
                </h2>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                What they saw on site
              </p>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {visit.followUpNotes}
              </p>
            </div>
          )}

          {/* Photos */}
          {visit.photos && visit.photos.length > 0 && (
            <Card title="Photos" icon={Camera}>
              <div className="flex flex-wrap gap-2">
                {visit.photos.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium border hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-base)', background: 'var(--surface-muted)' }}
                  >
                    <Camera className="h-3 w-3" />
                    Photo {i + 1}
                  </a>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* Right column — Client Details */}
        <div className="sticky top-6 self-start space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4">

            {/* Client name + status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-base)' }}>
                  {visit.customerId ? 'Client' : 'Lead'}
                </p>
                <p className="text-base font-bold leading-snug truncate" style={{ color: 'var(--text-heading)' }}>
                  {visit.customerName ?? visit.leadName ?? '—'}
                </p>
              </div>
              <StatusBadge module="site_visits" status={visit.status} />
            </div>

            {/* Scheduled + Assigned To */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                  <Calendar className="h-3 w-3" /> Scheduled
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                  {new Date(visit.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {visit.designerName && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    <User className="h-3 w-3" /> Assigned To
                  </p>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>
                    {visit.designerName}
                  </p>
                </div>
              )}
            </div>

            {/* Completed date */}
            {visit.completedAt && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                  <Calendar className="h-3 w-3" /> Completed
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                  {new Date(visit.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}

            {/* Lead / Client links */}
            {(visit.leadId || visit.customerId || visit.projectId) && (
              <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-1.5">
                {visit.leadId && (
                  <Link href={`/leads/${visit.leadId}`}
                    className="text-xs font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                    View Lead →
                  </Link>
                )}
                {visit.customerId && (
                  <Link href={`/customers/${visit.customerId}`}
                    className="text-xs font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                    View Client →
                  </Link>
                )}
                {visit.projectId && (
                  <Link href={`/projects/${visit.projectId}`}
                    className="text-xs font-medium hover:underline" style={{ color: 'var(--accent-base)' }}>
                    View Project →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reschedule dialog ─────────────────────────────────── */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reschedule Visit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>New Date &amp; Time *</label>
              <input
                type="datetime-local"
                value={rescheduleAt}
                onChange={e => setRescheduleAt(e.target.value)}
                className="studio-input h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Address *</label>
              <input
                type="text"
                value={rescheduleAddr}
                onChange={e => setRescheduleAddr(e.target.value)}
                className="studio-input h-9 w-full"
              />
            </div>
            {rescheduleErr && <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{rescheduleErr}</p>}
          </div>
          <DialogFooter>
            <button onClick={() => setRescheduleOpen(false)} disabled={rescheduling}
              className="inline-flex items-center px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
              Cancel
            </button>
            <button onClick={handleReschedule} disabled={rescheduling}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" />
              {rescheduling ? 'Saving…' : 'Save New Schedule'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel dialog ────────────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cancel Visit?</DialogTitle></DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
            This will mark the visit as cancelled. This action cannot be undone.
          </p>
          {cancelErr && <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{cancelErr}</p>}
          <DialogFooter>
            <button onClick={() => setCancelOpen(false)} disabled={cancelling}
              className="inline-flex items-center px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
              Keep Visit
            </button>
            <button onClick={handleCancel} disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium disabled:opacity-50"
              style={{ background: '#DC2626', color: '#fff' }}>
              <XCircle className="h-3.5 w-3.5" />
              {cancelling ? 'Cancelling…' : 'Cancel Visit'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── No Show dialog ───────────────────────────────────── */}
      <Dialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mark as No Show?</DialogTitle></DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
            The client did not appear for this visit. This will be recorded in the activity log.
          </p>
          {noShowErr && <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{noShowErr}</p>}
          <DialogFooter>
            <button onClick={() => setNoShowOpen(false)} disabled={noShowing}
              className="inline-flex items-center px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
              Go Back
            </button>
            <button onClick={handleNoShow} disabled={noShowing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium disabled:opacity-50"
              style={{ background: '#D97706', color: '#fff' }}>
              <UserX className="h-3.5 w-3.5" />
              {noShowing ? 'Saving…' : 'Mark No Show'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete dialog ──────────────────────────────────── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Complete Visit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                Visit Notes <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={completeForm.notes}
                onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="What was observed during the visit…"
                rows={3}
                className="studio-input w-full py-2 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                Outcome / Customer Requirements <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={completeForm.outcome}
                onChange={e => setCompleteForm(f => ({ ...f, outcome: e.target.value }))}
                placeholder="What the client wants, decisions made, next steps…"
                rows={3}
                className="studio-input w-full py-2 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                Photo URLs <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(one per line, optional)</span>
              </label>
              <textarea
                value={completeForm.photos}
                onChange={e => setCompleteForm(f => ({ ...f, photos: e.target.value }))}
                placeholder="https://…"
                rows={2}
                className="studio-input w-full py-2 resize-none font-mono text-[11px]"
              />
            </div>

            {/* Optional follow-up */}
            <div className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={completeForm.createFollowUp}
                  onChange={e => setCompleteForm(f => ({ ...f, createFollowUp: e.target.checked }))}
                  className="accent-purple-600 h-3.5 w-3.5"
                />
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
                  Create a follow-up for this lead
                </span>
              </label>

              {completeForm.createFollowUp && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Follow-up Date</label>
                    <input
                      type="datetime-local"
                      value={completeForm.followUpDate}
                      onChange={e => setCompleteForm(f => ({ ...f, followUpDate: e.target.value }))}
                      className="studio-input h-9 w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Stage *</label>
                      <select
                        value={completeForm.followUpStage}
                        onChange={e => setCompleteForm(f => ({ ...f, followUpStage: e.target.value }))}
                        className="studio-input h-9 w-full"
                      >
                        {FOLLOW_UP_STAGES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Client Status *</label>
                      <select
                        value={completeForm.followUpStatus}
                        onChange={e => setCompleteForm(f => ({ ...f, followUpStatus: e.target.value }))}
                        className="studio-input h-9 w-full"
                      >
                        {FOLLOW_UP_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Follow-up Comments</label>
                    <textarea
                      value={completeForm.followUpComments}
                      onChange={e => setCompleteForm(f => ({ ...f, followUpComments: e.target.value }))}
                      placeholder="What to discuss in the next follow-up…"
                      rows={2}
                      className="studio-input w-full py-2 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {completeErr && (
              <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{completeErr}</p>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setCompleteOpen(false)} disabled={completing}
              className="inline-flex items-center px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
              Cancel
            </button>
            <button onClick={handleComplete} disabled={completing}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {completing ? 'Completing…' : 'Mark Complete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
