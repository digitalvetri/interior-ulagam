'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  X, Phone, MessageCircle, Calendar, MapPin, IndianRupee,
  Home, Clock, Plus, ExternalLink, Loader2, CheckCircle2,
  AlertCircle, PhoneCall, StickyNote, Building2, ArrowRight,
} from 'lucide-react';
import { Lead, LeadActivity, STAGE_LABELS, PRIORITY_CONFIG } from '@/types/leads';

const ACTIVITY_ICONS: Record<LeadActivity['type'], React.ElementType> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  note: StickyNote,
  site_visit: Building2,
  meeting: Calendar,
  stage_change: ArrowRight,
  follow_up: Clock,
};

const ACTIVITY_STYLE: Record<LeadActivity['type'], { bg: string; color: string }> = {
  call:         { bg: '#EFF6FF', color: '#2563EB' },
  whatsapp:     { bg: '#F0FDF4', color: '#16A34A' },
  note:         { bg: '#F5F3FF', color: '#9333EA' },
  site_visit:   { bg: '#FFFBEB', color: '#D97706' },
  meeting:      { bg: '#EDE9FE', color: '#7C5CFC' },
  stage_change: { bg: '#F1F5F9', color: '#64748B' },
  follow_up:    { bg: '#FFF7ED', color: '#EA580C' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadDetailPanel({ lead, onClose }: Props) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteBox, setShowNoteBox] = useState(false);

  const loadActivities = useCallback((id: string) => {
    setActivitiesLoading(true);
    fetch(`/api/v1/leads/${id}/activities`)
      .then(r => r.json())
      .then(({ data }: { data: LeadActivity[] }) => {
        setActivities(data ?? []);
        setActivitiesLoading(false);
      })
      .catch(() => setActivitiesLoading(false));
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!lead) {
      setActivities([]);
      setNoteText('');
      setShowNoteBox(false);
      return;
    }
    loadActivities(lead.id);
  }, [lead, loadActivities]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function addNote() {
    if (!lead || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: noteText.trim() }),
      });
      if (res.ok) {
        const { data } = await res.json() as { data: LeadActivity };
        setActivities(prev => [data, ...prev]);
        setNoteText('');
        setShowNoteBox(false);
      }
    } finally {
      setAddingNote(false);
    }
  }

  const isOpen = !!lead;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[90vw] flex flex-col bg-white shadow-2xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ borderLeft: '1px solid #E7E7ED' }}
        aria-label="Lead details"
      >
        {!lead ? null : (
          <>
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #E7E7ED' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7C5CFC 0%, #9B8AFB 100%)' }}
                >
                  {lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold truncate" style={{ color: '#171923' }}>
                    {lead.contactName}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#EDE9FE', color: '#6D4FE0' }}
                    >
                      {STAGE_LABELS[lead.stage]}
                    </span>
                    {lead.priority && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: PRIORITY_CONFIG[lead.priority].bg,
                          color: PRIORITY_CONFIG[lead.priority].color,
                        }}
                      >
                        {PRIORITY_CONFIG[lead.priority].label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Link
                  href={`/leads/${lead.id}`}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Open full page"
                >
                  <ExternalLink className="h-4 w-4" style={{ color: '#6B7280' }} />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" style={{ color: '#6B7280' }} />
                </button>
              </div>
            </div>

            {/* ── Quick actions ─────────────────────────────────────── */}
            <div className="flex gap-2 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <a
                href={`tel:${lead.contactPhone}`}
                className="flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#EFF6FF', color: '#2563EB' }}
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#F0FDF4', color: '#16A34A' }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setShowNoteBox(v => !v)}
                className="flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#F5F3FF', color: '#7C5CFC' }}
              >
                <Plus className="h-3.5 w-3.5" /> Note
              </button>
            </div>

            {/* ── Body (scrollable) ─────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>

              {/* Quick note input */}
              {showNoteBox && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: '#F9F8FF', border: '1px solid #EDE9FE' }}>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note about this lead…"
                    rows={3}
                    className="w-full text-sm rounded-lg p-2.5 resize-none outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #DDD6FE', color: '#171923' }}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowNoteBox(false); setNoteText(''); }}
                      className="px-3 py-1.5 text-xs rounded-lg"
                      style={{ background: '#F3F4F6', color: '#374151' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addNote}
                      disabled={addingNote || !noteText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50"
                      style={{ background: '#7C5CFC', color: '#FFFFFF' }}
                    >
                      {addingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Contact</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                    <a href={`tel:${lead.contactPhone}`} className="hover:underline">{lead.contactPhone}</a>
                  </div>
                  {lead.contactEmail && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                      <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      <a href={`mailto:${lead.contactEmail}`} className="hover:underline truncate">{lead.contactEmail}</a>
                    </div>
                  )}
                  {lead.projectLocation && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      {lead.projectLocation}
                    </div>
                  )}
                </div>
              </div>

              {/* Project details */}
              {(lead.propertyType || lead.budgetBand || (lead.projectValuePaise ?? 0) > 0) && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Project</p>
                  <div className="space-y-1.5">
                    {lead.propertyType && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                        <Home className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                        {lead.propertyType}
                      </div>
                    )}
                    {lead.budgetBand && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                        <IndianRupee className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                        Budget: {lead.budgetBand}
                      </div>
                    )}
                    {(lead.projectValuePaise ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#8F6F2E' }}>
                        <IndianRupee className="h-3.5 w-3.5 flex-shrink-0" />
                        ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} estimated
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {lead.followUpDate && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Follow-up</p>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: '#FFF7ED', color: '#EA580C' }}
                  >
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    {fmtDate(lead.followUpDate)}
                  </div>
                </div>
              )}

              {/* Notes */}
              {lead.notes && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Notes</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{lead.notes}</p>
                </div>
              )}

              {/* Activity log */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  Activity Log {activities.length > 0 && `(${activities.length})`}
                </p>

                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#9CA3AF' }} />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>No activities recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => {
                      const Icon = ACTIVITY_ICONS[activity.type] ?? Clock;
                      const style = ACTIVITY_STYLE[activity.type] ?? { bg: '#F9FAFB', color: '#374151' };
                      const isCompleted = activity.completedAt || activity.status === 'completed';
                      return (
                        <div key={activity.id} className="flex gap-3">
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: style.bg }}
                          >
                            <Icon className="h-3.5 w-3.5" style={{ color: style.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold" style={{ color: '#171923' }}>{activity.title}</p>
                              {isCompleted && (
                                <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#16A34A' }} />
                              )}
                              {activity.status === 'overdue' && (
                                <AlertCircle className="h-3 w-3 flex-shrink-0" style={{ color: '#DC2626' }} />
                              )}
                            </div>
                            {activity.description && (
                              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{activity.description}</p>
                            )}
                            <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>
                              {fmtDate(activity.createdAt)} · {fmtTime(activity.createdAt)}
                              {activity.scheduledAt && ` · Scheduled: ${fmtDate(activity.scheduledAt)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
