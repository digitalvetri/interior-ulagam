'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MessageCircle, Calendar, FileText, Home,
  IndianRupee, User, MapPin, Clock, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ExternalLink,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity } from '@/types/leads';

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

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [lead, setLead]       = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'followups'>('timeline');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
    ]).then(async ([leadRes, actRes]) => {
      if (leadRes.status === 404) { setNotFound(true); setLoading(false); return; }
      const { data: leadData } = await leadRes.json() as { data: Lead };
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
    try {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: 'Note', description: noteText.trim() }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: LeadActivity };
        setActivities(prev => [data, ...prev]);
        setNoteText('');
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: Lead };
        setLead(data);
        setFollowUpDate('');
        setFollowUpNote('');
      }
    } catch { /* silent */ }
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

  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isTerminal  = lead.stage === 'won' || lead.stage === 'lost';

  const tabs = [
    { key: 'timeline' as const, label: 'Activity Timeline' },
    { key: 'notes' as const,    label: 'Add Note' },
    { key: 'followups' as const, label: 'Schedule Follow-up' },
  ];

  return (
    <div className="p-6 max-w-4xl">
      {/* ── Back ──────────────────────────────────────────────────────── */}
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm mb-5 hover:opacity-75"
        style={{ color: '#24211E' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      {/* ── Status banner ─────────────────────────────────────────────── */}
      {isTerminal && (
        <div
          className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: lead.stage === 'won' ? '#F0FDF4' : '#F9FAFB',
            border: `1px solid ${lead.stage === 'won' ? '#86EFAC' : '#D1D5DB'}`,
            color:  lead.stage === 'won' ? '#14532D' : '#374151',
          }}
        >
          {lead.stage === 'won'
            ? <><CheckCircle2 className="h-4 w-4" /> Lead WON — Ready to create a project</>
            : <><AlertCircle  className="h-4 w-4" /> Lead Lost{lead.lostReason ? `: ${lead.lostReason}` : ''}</>
          }
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: Lead info ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile card */}
          <div className="premium-card p-5">
            {/* Avatar + name */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #4A443C 0%, #24211E 100%)' }}
              >
                {lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#221F1B' }}>
                  {lead.contactName}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
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

            {/* Contact details */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                <a href={`tel:${lead.contactPhone}`} className="hover:underline" style={{ color: '#221F1B' }}>
                  {lead.contactPhone}
                </a>
              </div>
              {lead.contactEmail && (
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                  <span style={{ color: '#221F1B' }}>{lead.contactEmail}</span>
                </div>
              )}
              {lead.propertyType && (
                <div className="flex items-center gap-2.5">
                  <Home className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                  <span style={{ color: '#221F1B' }}>{lead.propertyType}</span>
                </div>
              )}
              {lead.projectLocation && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                  <span style={{ color: '#221F1B' }}>{lead.projectLocation}</span>
                </div>
              )}
              {lead.budgetBand && (
                <div className="flex items-center gap-2.5">
                  <IndianRupee className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                  <span style={{ color: '#221F1B' }}>{lead.budgetBand}</span>
                </div>
              )}
              {(lead.projectValuePaise ?? 0) > 0 && (
                <div className="flex items-center gap-2.5">
                  <IndianRupee className="h-4 w-4 flex-shrink-0" style={{ color: '#8F6F2E' }} />
                  <span className="font-semibold" style={{ color: '#8F6F2E' }}>
                    {fmt(lead.projectValuePaise ?? 0)} estimated
                  </span>
                </div>
              )}
              {lead.designerName && (
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 flex-shrink-0" style={{ color: '#24211E' }} />
                  <span style={{ color: '#221F1B' }}>{lead.designerName}</span>
                </div>
              )}
              {lead.followUpDate && (
                <div
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{
                    background: new Date(lead.followUpDate) < new Date() ? '#FEF2F2' : '#FFF7ED',
                    color:      new Date(lead.followUpDate) < new Date() ? '#DC2626' : '#EA580C',
                  }}
                >
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">
                    Follow-up: {fmtDate(lead.followUpDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Source + dates */}
            <div className="pt-4 mt-4 space-y-1.5" style={{ borderTop: '1px solid #F0EEE9' }}>
              <p className="text-xs" style={{ color: '#6B6459' }}>
                Source: <span className="font-medium" style={{ color: '#24211E' }}>
                  {lead.source.replace('_', ' ')}
                </span>
              </p>
              <p className="text-xs" style={{ color: '#6B6459' }}>
                Added: {fmtDate(lead.createdAt)}
              </p>
              <p className="text-xs" style={{ color: '#6B6459' }}>
                Last activity: {fmtDate(lead.lastActivityAt)}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="premium-card p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A79E8E' }}>
              Quick Actions
            </p>
            <a
              href={`tel:${lead.contactPhone}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#F0EEE9] w-full"
              style={{ color: '#24211E' }}
            >
              <Phone className="h-4 w-4" /> Call {lead.contactName.split(' ')[0]}
            </a>
            <a
              href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#F0EEE9] w-full"
              style={{ color: '#24211E' }}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <Link
              href={`/leads/${id}/site-visit`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#F0EEE9] w-full"
              style={{ color: '#24211E' }}
            >
              <Home className="h-4 w-4" /> Schedule Site Visit
            </Link>
            {lead.stage === 'won' && (
              <Link
                href={`/projects?leadId=${id}`}
                className="btn-primary flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium w-full justify-center mt-2"
              >
                <FolderKanban className="h-4 w-4" /> Create Project
              </Link>
            )}
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="premium-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#A79E8E' }}>
                Notes
              </p>
              <p className="text-sm" style={{ color: '#221F1B', lineHeight: '1.6' }}>{lead.notes}</p>
            </div>
          )}
        </div>

        {/* ── Right: Activity + tabs ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="premium-card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b" style={{ borderColor: '#F0EEE9' }}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    color:        activeTab === tab.key ? '#24211E' : '#6B6459',
                    borderBottom: activeTab === tab.key ? '2px solid #8F6F2E' : '2px solid transparent',
                    background:   activeTab === tab.key ? '#FDFCFB' : 'transparent',
                  }}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ── Timeline tab ─────────────────────────────────────── */}
              {activeTab === 'timeline' && (
                <div>
                  {activities.length === 0 ? (
                    <div className="text-center py-12">
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: 'rgba(36,33,30,0.08)' }}
                      >
                        <Clock className="h-6 w-6" style={{ color: '#E2DED5' }} />
                      </div>
                      <p className="text-sm" style={{ color: '#6B6459' }}>No activity yet.</p>
                      <p className="text-xs mt-1" style={{ color: '#A79E8E' }}>
                        Log a call or note to start the timeline.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        className="absolute left-4 top-0 bottom-0 w-0.5"
                        style={{ background: '#F0EEE9' }}
                      />
                      <div className="space-y-5 ml-4">
                        {activities.map(activity => (
                          <div key={activity.id} className="relative pl-6">
                            <div className="absolute -left-4">
                              <ActivityIcon type={activity.type} />
                            </div>
                            <div className="premium-card p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold" style={{ color: '#221F1B' }}>
                                  {activity.title}
                                </p>
                                <span className="text-[10px] flex-shrink-0" style={{ color: '#6B6459' }}>
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
                </div>
              )}

              {/* ── Note tab ─────────────────────────────────────────── */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div>
                    <label className="studio-label block mb-1.5">Add a note</label>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="E.g. Client prefers modern style, called to confirm site visit…"
                      rows={5}
                      className="studio-input w-full text-sm resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={savingNote || !noteText.trim()}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              )}

              {/* ── Follow-up tab ─────────────────────────────────────── */}
              {activeTab === 'followups' && (
                <div className="space-y-4">
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
                      rows={3}
                      className="studio-input w-full text-sm resize-none"
                    />
                  </div>

                  {/* Urgency presets */}
                  <div>
                    <p className="text-xs mb-2" style={{ color: '#6B6459' }}>Quick set:</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Tomorrow',  days: 1 },
                        { label: 'In 3 days', days: 3 },
                        { label: 'Next week', days: 7 },
                      ].map(({ label, days }) => (
                        <button
                          key={label}
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs rounded-lg"
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
                  </div>

                  <button
                    type="button"
                    onClick={scheduleFollowUp}
                    disabled={!followUpDate}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    Schedule Follow-up
                  </button>

                  {lead.followUpDate && (
                    <div
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: '#FAF9F6', borderLeft: '3px solid #8F6F2E' }}
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: '#8F6F2E' }} />
                      <span style={{ color: '#6B6459' }}>
                        Current follow-up: <strong style={{ color: '#1C1916' }}>{fmtDate(lead.followUpDate)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
