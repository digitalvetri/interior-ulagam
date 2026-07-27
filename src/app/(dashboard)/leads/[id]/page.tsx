'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MessageCircle, Calendar, FileText, Home,
  IndianRupee, User, MapPin, Clock, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity, ScoreBreakdown } from '@/types/leads';

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function followUpUrgency(dateIso: string): 'overdue' | 'today' | 'upcoming' {
  const due = new Date(dateIso);
  const now = new Date();
  if (due < now) return 'overdue';
  if (due.toDateString() === now.toDateString()) return 'today';
  return 'upcoming';
}

/* ── Activity icon ────────────────────────────────────────────────────────── */
function ActivityIcon({ type }: { type: LeadActivity['type'] }) {
  const iconCfg: Record<LeadActivity['type'], { icon: React.ElementType; bg: string; color: string }> = {
    call:         { icon: Phone,          bg: '#EFF6FF', color: '#2563EB' },
    whatsapp:     { icon: MessageCircle,  bg: '#F0FDF4', color: '#16A34A' },
    note:         { icon: FileText,       bg: '#FFF7ED', color: '#EA580C' },
    site_visit:   { icon: Home,           bg: '#F5F3FF', color: '#7C3AED' },
    meeting:      { icon: Calendar,       bg: '#FDF2F8', color: '#BE185D' },
    stage_change: { icon: ArrowLeft,      bg: '#FAF9F6', color: '#24211E' },
    follow_up:    { icon: Clock,          bg: '#FFFBEB', color: '#D97706' },
  };
  const cfg = iconCfg[type];
  const Icon = cfg.icon;
  return (
    <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: cfg.bg }}>
      <Icon className="h-4 w-4" style={{ color: cfg.color }} />
    </div>
  );
}

/* ── Collapsible Section ─────────────────────────────────────────────────── */
function Section({
  title, defaultOpen = true, children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EBE9E6', background: '#FFFFFF' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ borderBottom: open ? '1px solid #F0EEE9' : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-sm font-semibold" style={{ color: '#1C1916' }}>{title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: '#A79E8E' }} />
          : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: '#A79E8E' }} />
        }
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [lead, setLead]               = useState<Lead | null>(null);
  const [activities, setActivities]   = useState<LeadActivity[]>([]);
  const [recentMessages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [noteText, setNoteText]         = useState('');
  const [savingNote, setSavingNote]     = useState(false);
  const [noteError, setNoteError]       = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpError, setFUError]     = useState<string | null>(null);
  const [savingFU, setSavingFU]         = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
    ]).then(async ([leadRes, actRes]) => {
      if (leadRes.status === 404) { setNotFound(true); setLoading(false); return; }
      const { data: leadData } = await leadRes.json() as { data: Lead & { recentMessages?: WaMessage[] } };
      setMessages(leadData.recentMessages ?? []);
      setLead(leadData);
      if (actRes && actRes.ok) {
        const { data: actData } = await actRes.json() as { data: LeadActivity[] };
        setActivities(actData ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: 'Note', description: noteText.trim() }),
      });
      const json = await res.json().catch(() => ({})) as { data?: LeadActivity; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setActivities(prev => [json.data!, ...prev]);
      setNoteText('');
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    setSavingFU(true);
    setFUError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
      setFollowUpDate('');
      setFollowUpNote('');
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule follow-up');
    } finally {
      setSavingFU(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="skeleton h-8 w-48 mx-auto mb-3" />
          <div className="skeleton h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="p-6">
        <p className="mb-4 text-sm" style={{ color: '#6B6459' }}>Lead not found.</p>
        <button
          type="button"
          className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
          onClick={() => router.push('/leads')}
        >
          <ArrowLeft className="h-4 w-4" />Back to Pipeline
        </button>
      </div>
    );
  }

  const priorityCfg    = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon          = lead.stage === 'won';
  const isLost         = lead.stage === 'lost';
  const isTerminal     = isWon || isLost;
  const initials       = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const fuUrgency      = lead.followUpDate ? followUpUrgency(lead.followUpDate) : null;
  const siteVisits     = activities.filter(a => a.type === 'site_visit');
  const noteActivities = activities.filter(a => a.type === 'note');

  const followUpStyle = {
    overdue:  { bg: '#FEF2F2', color: '#DC2626', label: 'Overdue' },
    today:    { bg: '#FFF7ED', color: '#EA580C', label: 'Today'   },
    upcoming: { bg: '#FFFBEB', color: '#D97706', label: ''        },
  };

  return (
    <div className="min-h-full" style={{ background: '#F8F9FC' }}>
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-12 space-y-4">

        {/* ── Back link ─────────────────────────────────────────────────── */}
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm hover:opacity-75"
          style={{ color: '#6B6459' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pipeline
        </Link>

        {/* ── HERO: Name + contact + stage ──────────────────────────────── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #EBE9E6' }}
        >
          {/* Status banner (won / lost) */}
          {isTerminal && (
            <div
              className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: isWon ? '#F0FDF4' : '#F9FAFB',
                border: `1px solid ${isWon ? '#86EFAC' : '#D1D5DB'}`,
                color:  isWon ? '#14532D' : '#374151',
              }}
            >
              {isWon
                ? <><CheckCircle2 className="h-4 w-4" /> Lead WON — ready to create a project</>
                : <><AlertCircle  className="h-4 w-4" /> Lead Lost{lead.lostReason ? `: ${lead.lostReason}` : ''}</>
              }
            </div>
          )}

          {/* Avatar + name row */}
          <div className="flex items-start gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FDD 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold" style={{ color: '#1C1916' }}>
                {lead.contactName}
              </h1>
              {/* Stage + priority badges */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
                  {STAGE_LABELS[lead.stage]}
                </span>
                {priorityCfg && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: priorityCfg.bg, color: priorityCfg.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                    {priorityCfg.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact + follow-up info */}
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 flex-shrink-0" style={{ color: '#7C5CFC' }} />
              <a href={`tel:${lead.contactPhone}`} className="font-medium hover:underline" style={{ color: '#1C1916' }}>
                {lead.contactPhone}
              </a>
            </div>
            {lead.contactEmail && (
              <div className="flex items-center gap-2.5">
                <ExternalLink className="h-4 w-4 flex-shrink-0" style={{ color: '#6B6459' }} />
                <span style={{ color: '#1C1916' }}>{lead.contactEmail}</span>
              </div>
            )}
            {lead.followUpDate && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: followUpStyle[fuUrgency!].bg,
                  color: followUpStyle[fuUrgency!].color,
                }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Follow-up: {fmtDate(lead.followUpDate)}
                {fuUrgency !== 'upcoming' && (
                  <span className="font-bold">({followUpStyle[fuUrgency!].label})</span>
                )}
              </div>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <a
              href={`tel:${lead.contactPhone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#F0F0FF', color: '#7C5CFC', border: '1px solid #D4C8FF' }}
            >
              <Phone className="h-4 w-4" /> Call
            </a>
            <a
              href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <Link
              href={`/leads/${id}/site-visit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#FAF9F6', color: '#24211E', border: '1px solid #E2DED5' }}
            >
              <Home className="h-4 w-4" /> Site Visit
            </Link>
            {isWon && (
              <Link
                href={`/projects?leadId=${id}`}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg"
              >
                <FolderKanban className="h-4 w-4" /> Create Project
              </Link>
            )}
          </div>
        </div>

        {/* ── Project details ───────────────────────────────────────────── */}
        {(lead.propertyType || lead.projectLocation || lead.budgetBand || (lead.projectValuePaise ?? 0) > 0 || lead.designerName || lead.notes) && (
          <Section title="Project Details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {lead.propertyType && (
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7C5CFC' }} />
                  <div>
                    <dt className="text-xs" style={{ color: '#6B6459' }}>Property Type</dt>
                    <dd style={{ color: '#1C1916' }}>{lead.propertyType}</dd>
                  </div>
                </div>
              )}
              {lead.projectLocation && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7C5CFC' }} />
                  <div>
                    <dt className="text-xs" style={{ color: '#6B6459' }}>Location</dt>
                    <dd style={{ color: '#1C1916' }}>{lead.projectLocation}</dd>
                  </div>
                </div>
              )}
              {lead.budgetBand && (
                <div className="flex items-start gap-2">
                  <IndianRupee className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7C5CFC' }} />
                  <div>
                    <dt className="text-xs" style={{ color: '#6B6459' }}>Budget Range</dt>
                    <dd style={{ color: '#1C1916' }}>{lead.budgetBand}</dd>
                  </div>
                </div>
              )}
              {(lead.projectValuePaise ?? 0) > 0 && (
                <div className="flex items-start gap-2">
                  <IndianRupee className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#8F6F2E' }} />
                  <div>
                    <dt className="text-xs" style={{ color: '#6B6459' }}>Estimated Value</dt>
                    <dd className="font-semibold" style={{ color: '#8F6F2E' }}>{fmt(lead.projectValuePaise ?? 0)}</dd>
                  </div>
                </div>
              )}
              {lead.designerName && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7C5CFC' }} />
                  <div>
                    <dt className="text-xs" style={{ color: '#6B6459' }}>Assigned Designer</dt>
                    <dd style={{ color: '#1C1916' }}>{lead.designerName}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#6B6459' }} />
                <div>
                  <dt className="text-xs" style={{ color: '#6B6459' }}>Source · Added</dt>
                  <dd style={{ color: '#1C1916' }}>
                    {lead.source.replace('_', ' ')} · {fmtDate(lead.createdAt)}
                  </dd>
                </div>
              </div>
            </dl>
            {lead.notes && (
              <p
                className="mt-4 pt-4 text-sm"
                style={{ color: '#1C1916', lineHeight: '1.6', borderTop: '1px solid #F0EEE9' }}
              >
                {lead.notes}
              </p>
            )}
          </Section>
        )}

        {/* ── Schedule Follow-up ────────────────────────────────────────── */}
        <Section title="Schedule Follow-up">
          {lead.followUpDate && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4"
              style={{ background: '#FAF9F6', borderLeft: '3px solid #8F6F2E' }}
            >
              <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: '#8F6F2E' }} />
              <span style={{ color: '#6B6459' }}>
                Current: <strong style={{ color: '#1C1916' }}>{fmtDate(lead.followUpDate)}</strong>
              </span>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="studio-label block mb-1.5">Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="studio-input w-full text-sm"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="studio-label block mb-1.5">Notes (optional)</label>
              <textarea
                value={followUpNote}
                onChange={e => setFollowUpNote(e.target.value)}
                placeholder="What to discuss on this follow-up…"
                rows={2}
                className="studio-input w-full text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs" style={{ color: '#6B6459' }}>Quick:</p>
              {[
                { label: 'Tomorrow',  days: 1 },
                { label: 'In 3 days', days: 3 },
                { label: 'Next week', days: 7 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  type="button"
                  className="btn-secondary px-3 py-1 text-xs rounded-lg"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    setFollowUpDate(d.toISOString().split('T')[0]);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {followUpError && (
              <p className="text-xs text-red-600">{followUpError}</p>
            )}
            <button
              type="button"
              onClick={scheduleFollowUp}
              disabled={!followUpDate || savingFU}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Calendar className="h-4 w-4" />
              {savingFU ? 'Saving…' : lead.followUpDate ? 'Update Follow-up' : 'Schedule Follow-up'}
            </button>
          </div>
        </Section>

        {/* ── Add Note ─────────────────────────────────────────────────── */}
        <Section title="Add Note">
          <div className="space-y-3">
            <textarea
              value={noteText}
              onChange={e => { setNoteText(e.target.value); setNoteError(null); }}
              placeholder="E.g. Client prefers modern style, called to confirm site visit…"
              rows={3}
              className="studio-input w-full text-sm resize-none"
            />
            {noteError && (
              <p className="text-xs text-red-600">{noteError}</p>
            )}
            <button
              type="button"
              onClick={saveNote}
              disabled={savingNote || !noteText.trim()}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {savingNote ? 'Saving…' : 'Save Note'}
            </button>
          </div>
          {/* Saved notes */}
          {noteActivities.length > 0 && (
            <div className="mt-4 space-y-3 pt-4" style={{ borderTop: '1px solid #F0EEE9' }}>
              <p className="text-xs font-semibold" style={{ color: '#A79E8E' }}>SAVED NOTES</p>
              {noteActivities.map(n => (
                <div key={n.id} className="rounded-xl px-4 py-3" style={{ background: '#FAF9F6', border: '1px solid #F0EEE9' }}>
                  <p className="text-sm" style={{ color: '#1C1916', lineHeight: '1.5' }}>{n.description}</p>
                  <p className="text-xs mt-1.5" style={{ color: '#A79E8E' }}>
                    {fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Site Visits ──────────────────────────────────────────────── */}
        {siteVisits.length > 0 && (
          <Section title={`Site Visits (${siteVisits.length})`}>
            <div className="space-y-3">
              {siteVisits.map(sv => (
                <div key={sv.id} className="rounded-xl p-4" style={{ background: '#FAF9F6', border: '1px solid #F0EEE9' }}>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5F3FF' }}>
                      <Home className="h-4 w-4" style={{ color: '#7C3AED' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{sv.title}</p>
                      {sv.description && <p className="text-xs mt-1" style={{ color: '#6B6459' }}>{sv.description}</p>}
                      <p className="text-[10px] mt-1.5" style={{ color: '#A79E8E' }}>{fmtDate(sv.createdAt)} · {fmtTime(sv.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Activity History ─────────────────────────────────────────── */}
        <Section title={`Activity History (${activities.length})`} defaultOpen={activities.length > 0}>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(36,33,30,0.08)' }}>
                <Clock className="h-5 w-5" style={{ color: '#E2DED5' }} />
              </div>
              <p className="text-sm" style={{ color: '#6B6459' }}>No activity yet.</p>
              <p className="text-xs mt-1" style={{ color: '#A79E8E' }}>Log a call, note, or site visit to start the history.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ background: '#F0EEE9' }} />
              <div className="space-y-4 ml-4">
                {activities.map(activity => (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute -left-4">
                      <ActivityIcon type={activity.type} />
                    </div>
                    <div className="rounded-xl p-3" style={{ background: '#FAF9F6', border: '1px solid #F0EEE9' }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{activity.title}</p>
                        <span className="text-[10px] flex-shrink-0" style={{ color: '#A79E8E' }}>
                          {fmtDate(activity.createdAt)} · {fmtTime(activity.createdAt)}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-xs mt-1" style={{ color: '#6B6459', lineHeight: '1.5' }}>
                          {activity.description}
                        </p>
                      )}
                      {activity.status && (
                        <span
                          className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{
                            background: activity.status === 'completed' ? '#F0FDF4' : activity.status === 'overdue' ? '#FEF2F2' : '#FFF7ED',
                            color:      activity.status === 'completed' ? '#15803D' : activity.status === 'overdue' ? '#DC2626' : '#EA580C',
                          }}
                        >
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── WhatsApp Thread Preview ───────────────────────────────────── */}
        {recentMessages.length > 0 && (
          <Section title="Recent WhatsApp Messages" defaultOpen>
            <div className="space-y-2">
              {recentMessages.map(msg => (
                <div
                  key={msg.id}
                  className="flex gap-2.5"
                  style={{ justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}
                >
                  <div
                    className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm"
                    style={{
                      background: msg.direction === 'inbound' ? '#F0FDF4' : '#F5F3FF',
                      border: `1px solid ${msg.direction === 'inbound' ? '#86EFAC' : '#DDD6FE'}`,
                      color: '#1C1916',
                    }}
                  >
                    <p className="leading-relaxed">{msg.bodyPreview ?? '(media)'}</p>
                    <p className="text-[10px] mt-1 opacity-60">{fmtTime(msg.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '').slice(-10)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium"
              style={{ color: '#16A34A' }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open in WhatsApp
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Section>
        )}

        {/* ── Lead Score Breakdown ──────────────────────────────────────── */}
        {(lead.score ?? 0) > 0 && lead.scoreBreakdown && (
          <Section title="Lead Score" defaultOpen={false}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-3xl font-bold" style={{ color: (lead.score ?? 0) >= 70 ? '#16A34A' : (lead.score ?? 0) >= 40 ? '#EA580C' : '#6B7280' }}>
                {lead.score}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#1C1916' }}>out of 100</p>
                <p className="text-xs" style={{ color: '#6B6459' }}>Updated automatically on activity</p>
              </div>
            </div>
            <div className="space-y-2">
              {(
                [
                  { label: 'Recency',      val: lead.scoreBreakdown.recency,      max: 30 },
                  { label: 'Project Value',val: lead.scoreBreakdown.value,        max: 25 },
                  { label: 'Completeness', val: lead.scoreBreakdown.completeness, max: 20 },
                  { label: 'Source',       val: lead.scoreBreakdown.source,       max: 15 },
                  { label: 'Engagement',   val: lead.scoreBreakdown.engagement,   max: 10 },
                ] as { label: string; val: number; max: number }[]
              ).map(({ label, val, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: '#6B6459' }}>
                    <span>{label}</span>
                    <span className="font-medium" style={{ color: '#1C1916' }}>{val}/{max}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#F0EEE9' }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(val / max) * 100}%`, background: '#7C5CFC' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Quotations / Work Orders / Documents (stubs) ─────────────── */}
        <Section title="Quotations" defaultOpen={false}>
          <div className="text-center py-6">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#D4C8FF' }} />
            <p className="text-sm" style={{ color: '#6B6459' }}>No quotations linked yet.</p>
            <p className="text-xs mt-1" style={{ color: '#A79E8E' }}>
              Quotations appear here once this lead is converted to a project.
            </p>
            {isWon && (
              <Link
                href={`/projects?leadId=${id}`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium btn-primary"
              >
                <FolderKanban className="h-4 w-4" /> Create Project
              </Link>
            )}
          </div>
        </Section>

        <Section title="Documents" defaultOpen={false}>
          <div className="text-center py-6">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#D4C8FF' }} />
            <p className="text-sm" style={{ color: '#6B6459' }}>No documents uploaded.</p>
            <p className="text-xs mt-1" style={{ color: '#A79E8E' }}>Contracts, floor plans, and proposals will appear here.</p>
          </div>
        </Section>

      </div>
    </div>
  );
}
