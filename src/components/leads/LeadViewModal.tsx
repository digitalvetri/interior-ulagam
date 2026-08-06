'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, ExternalLink, Plus, Calendar, Loader2, BellRing,
  Phone, Home, MapPin, IndianRupee, User, MessageCircle,
} from 'lucide-react';
import { Lead, STAGE_LABELS } from '@/types/leads';
import { FollowUpModal } from './FollowUpModal';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface FollowUpEntry {
  id: string;
  followUpDate: string | null;
  stage: string;
  clientStatus: string;
  comments: string | null;
  addToCalendar: boolean;
  createdByName: string | null;
  createdByRole: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Look-up maps ─────────────────────────────────────────────────────────── */
const CLIENT_STATUS_LABEL: Record<string, string> = {
  interested:        'Interested',
  not_interested:    'Not Interested',
  callback:          'Callback',
  meeting_scheduled: 'Meeting Scheduled',
  thinking:          'Thinking',
  no_response:       'No Response',
  negotiating:       'Negotiating',
  deal_closed:       'Deal Closed',
};

const CLIENT_STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  interested:        { bg: 'var(--success-soft)', color: 'var(--success)', dot: 'var(--success)' },
  not_interested:    { bg: 'var(--danger-soft)', color: 'var(--danger)', dot: 'var(--danger)' },
  callback:          { bg: 'var(--warning-soft)', color: 'var(--warning)', dot: 'var(--warning)' },
  meeting_scheduled: { bg: 'var(--accent-soft)', color: 'var(--accent-text)', dot: 'var(--accent-text)' },
  thinking:          { bg: 'var(--warning-soft)', color: 'var(--warning)', dot: 'var(--warning)' },
  no_response:       { bg: 'var(--surface-muted)', color: 'var(--text-secondary)', dot: 'var(--text-tertiary)' },
  negotiating:       { bg: 'var(--accent-soft)', color: 'var(--accent-base)', dot: 'var(--accent-base)' },
  deal_closed:       { bg: 'var(--success-soft)', color: 'var(--success-text)', dot: 'var(--success)' },
};

const STAGE_STYLE: Record<string, { bg: string; color: string }> = {
  new:                  { bg: 'var(--accent-soft)', color: 'var(--accent-text)' },
  site_visit_scheduled: { bg: '#FEF9C3', color: '#854D0E' },
  consultation_done:    { bg: 'var(--warning-soft)', color: '#C2410C' },
  proposal_sent:        { bg: '#EEF2FF', color: '#4338CA' },
  negotiation:          { bg: 'var(--accent-soft)', color: 'var(--accent-base)' },
  won:                  { bg: 'var(--success-soft)', color: 'var(--success-text)' },
  lost:                 { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

/* ── Formatters ───────────────────────────────────────────────────────────── */
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

function fmtUpdated(iso: string) {
  const d = new Date(iso);
  return (
    'Updated on ' +
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/* ── Details tab ──────────────────────────────────────────────────────────── */
function DetailsTab({ lead }: { lead: Lead }) {
  const stageStyle = STAGE_STYLE[lead.stage] ?? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' };
  const waHref = `https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`;

  return (
    <div className="p-5 space-y-5">
      {/* Stage + Follow-up date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: stageStyle.bg, color: stageStyle.color }}
        >
          {STAGE_LABELS[lead.stage as keyof typeof STAGE_LABELS] ?? lead.stage}
        </span>
        {lead.followUpDate && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}
          >
            <Calendar className="h-3 w-3" />
            {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>CONTACT</p>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={`tel:${lead.contactPhone}`}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <Phone className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            {lead.contactPhone}
          </a>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--success)' }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          {lead.contactEmail && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.contactEmail}</span>
          )}
        </div>
      </div>

      {/* Property */}
      {(lead.propertyType || lead.budgetBand || lead.projectLocation) && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>PROPERTY</p>
          <div className="flex flex-wrap gap-3">
            {lead.propertyType && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                <Home className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                {lead.propertyType}
              </span>
            )}
            {lead.projectLocation && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                {lead.projectLocation}
              </span>
            )}
            {lead.budgetBand && (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#8F6F2E' }}>
                <IndianRupee className="h-3.5 w-3.5" />
                {lead.budgetBand}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Assigned designer */}
      {lead.designerName && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>ASSIGNED TO</p>
          <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
            <User className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            {lead.designerName}
          </span>
        </div>
      )}

      {/* Notes */}
      {lead.notes && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>NOTES</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{lead.notes}</p>
        </div>
      )}

      {(lead.projectValuePaise ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>ESTIMATED VALUE</p>
          <p className="text-base font-bold" style={{ color: '#8F6F2E' }}>
            ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Follow-ups tab ───────────────────────────────────────────────────────── */
interface FollowUpsTabProps {
  followUps: FollowUpEntry[];
  loading: boolean;
  error: string | null;
  onAddFollowUp: () => void;
}

function FollowUpsTab({ followUps, loading, error, onAddFollowUp }: FollowUpsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-tertiary)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Add button */}
      <button
        type="button"
        onClick={onAddFollowUp}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent-base)' }}
      >
        <Plus className="h-4 w-4" />
        Add Follow-up
      </button>

      {followUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}
          >
            <BellRing className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No follow-ups recorded yet</p>
        </div>
      ) : (
        /* Timeline */
        <div className="relative">
          {/* Vertical connector */}
          <div
            className="absolute left-[9px] top-5 bottom-5 w-0.5"
            style={{ background: 'var(--border-subtle)' }}
          />

          <div className="space-y-0">
            {followUps.map((fu) => {
              const sStyle = CLIENT_STATUS_STYLE[fu.clientStatus] ?? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)', dot: 'var(--text-tertiary)' };
              const stStyl = STAGE_STYLE[fu.stage] ?? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' };

              return (
                <div key={fu.id} className="relative flex gap-4 pb-6">
                  {/* Timeline dot */}
                  <div
                    className="relative z-10 h-5 w-5 rounded-full flex-shrink-0 mt-0.5"
                    style={{
                      background: sStyle.bg,
                      border: `2px solid ${sStyle.dot}`,
                    }}
                  />

                  {/* Content card */}
                  <div
                    className="flex-1 min-w-0 rounded-xl p-3.5"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
                  >
                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: sStyle.bg, color: sStyle.color }}
                      >
                        {CLIENT_STATUS_LABEL[fu.clientStatus] ?? fu.clientStatus}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: stStyl.bg, color: stStyl.color }}
                      >
                        {STAGE_LABELS[fu.stage as keyof typeof STAGE_LABELS] ?? fu.stage}
                      </span>
                      {fu.followUpDate && (
                        <span
                          className="flex items-center gap-1 text-[11px] font-medium"
                          style={{ color: 'var(--text-heading)' }}
                        >
                          <Calendar className="h-3 w-3" />
                          {fmtDateTime(fu.followUpDate)}
                        </span>
                      )}
                    </div>

                    {/* Comments */}
                    {fu.comments && (
                      <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {fu.comments}
                      </p>
                    )}

                    {/* Footer: avatar + name + role + timestamp */}
                    <div className="flex items-center gap-2">
                      {fu.createdByName ? (
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ background: 'var(--accent-base)' }}
                        >
                          {initials(fu.createdByName)}
                        </div>
                      ) : (
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--border-subtle)' }}
                        >
                          <User className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-none" style={{ color: 'var(--text-heading)' }}>
                          {fu.createdByName ?? 'System'}
                        </p>
                        {fu.createdByRole && (
                          <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'var(--accent-base)' }}>
                            {fu.createdByRole}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {fmtUpdated(fu.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main modal ───────────────────────────────────────────────────────────── */
interface LeadViewModalProps {
  lead: Lead;
  onClose: () => void;
}

export function LeadViewModal({ lead, onClose }: LeadViewModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'followups'>('followups');
  const [followUps, setFollowUps] = useState<FollowUpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/follow-ups`);
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? 'Failed to load follow-ups');
        return;
      }
      setFollowUps(data.data ?? []);
    } catch {
      setFetchError('Network error — could not load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => {
    if (activeTab === 'followups') fetchFollowUps();
  }, [activeTab, fetchFollowUps]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          style={{ background: 'var(--surface-card)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>
                {lead.contactName}
              </h2>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                {lead.contactPhone}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <Link
                href={`/leads/${lead.id}`}
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--border-subtle)]"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
              >
                <ExternalLink className="h-3 w-3" />
                Full Details
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--border-subtle)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="flex flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {(['followups', 'details'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
                style={{
                  color: activeTab === tab ? 'var(--accent-base)' : 'var(--text-secondary)',
                  borderBottomColor: activeTab === tab ? 'var(--accent-base)' : 'transparent',
                }}
              >
                {tab === 'followups' ? 'Follow-ups' : 'Details'}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === 'details' ? (
              <DetailsTab lead={lead} />
            ) : (
              <FollowUpsTab
                followUps={followUps}
                loading={loading}
                error={fetchError}
                onAddFollowUp={() => setShowAddModal(true)}
              />
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <FollowUpModal
          lead={lead}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            fetchFollowUps();
          }}
        />
      )}
    </>
  );
}
