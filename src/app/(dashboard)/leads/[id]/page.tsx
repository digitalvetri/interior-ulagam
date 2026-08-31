'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MessageCircle, Calendar, FileText, Home,
  User, MapPin, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ChevronDown, ChevronUp,
  Sparkles, Zap, ShieldAlert, Mic, MicOff,
  Edit2, Trash2, Archive, MoreVertical,
  Upload, ExternalLink, X, StickyNote, BellRing,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity } from '@/types/leads';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import type { Quote } from '@/types/quotes';
import type { DocumentRow } from '@/types/documents';

type LeadDocument = DocumentRow & { downloadUrl: string | null };

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  createdAt: string;
}

/* ── Helpers ── */
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

/* ── Stage progress bar ── */
const PIPELINE = [
  { key: 'new',                  short: 'New' },
  { key: 'site_visit_scheduled', short: 'Site Visit' },
  { key: 'consultation_done',    short: 'Consult' },
  { key: 'proposal_sent',        short: 'Proposal' },
  { key: 'negotiation',          short: 'Negotiation' },
  { key: 'won',                  short: 'Won' },
];

function StageProgressBar({ stage, isLost }: { stage: string; isLost: boolean }) {
  if (isLost) {
    return (
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <div className="h-1 rounded-full" style={{ width: '100%', background: 'var(--danger)' }} />
        </div>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: 'var(--danger)' }}>Lost</span>
      </div>
    );
  }
  const ci = PIPELINE.findIndex(s => s.key === stage);
  return (
    <div className="mt-4 flex items-end">
      {PIPELINE.map((s, i) => {
        const done   = i < ci;
        const active = i === ci;
        const last   = i === PIPELINE.length - 1;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center flex-shrink-0">
              <span className="text-[10px] mb-1 whitespace-nowrap"
                style={{ color: active ? 'var(--accent-base)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: active ? 700 : 400 }}>
                {s.short}
              </span>
              <div className="h-2 w-2 rounded-full" style={{
                background: done || active ? 'var(--accent-base)' : 'var(--border-subtle)',
                boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.18)' : 'none',
                transform: active ? 'scale(1.4)' : 'scale(1)',
              }} />
            </div>
            {!last && (
              <div className="flex-1 h-0.5 mb-1" style={{ background: done ? 'var(--accent-base)' : 'var(--border-subtle)', minWidth: 8 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Section ── */
function Section({ title, defaultOpen = true, action, children }: {
  title: string; defaultOpen?: boolean; action?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}>
        <button type="button" className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setOpen(v => !v)}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</span>
          {open
            ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />}
        </button>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ── ConfirmDialog ── */
function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: danger ? 'var(--danger)' : 'var(--violet-primary)', color: '#fff' }}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── MarkLostDialog ── */
function MarkLostDialog({ open, value, onChange, onConfirm, onCancel, loading }: {
  open: boolean; value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Mark Lead as Lost</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Provide a reason to help improve the team&apos;s close rate.</p>
        <textarea rows={3} className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-heading)' }}
          placeholder="e.g. Budget exceeded, chose a competitor, project postponed…"
          value={value} onChange={e => onChange(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus />
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading || !value.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: 'var(--danger)', color: '#fff' }}>
            {loading ? 'Marking Lost…' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Activity timeline entry ── */
const ACTIVITY_STYLE: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  note:         { Icon: StickyNote, bg: '#EEF2FF',             color: '#4338CA' },
  follow_up:    { Icon: BellRing,   bg: '#FFFBEB',             color: '#D97706' },
  stage_change: { Icon: Zap,        bg: 'var(--accent-soft)',  color: 'var(--accent-base)' },
  site_visit:   { Icon: Home,       bg: 'var(--success-soft)', color: 'var(--success-text)' },
};

function TimelineEntry({ activity, isLast }: { activity: LeadActivity; isLast: boolean }) {
  const s = ACTIVITY_STYLE[activity.type] ?? ACTIVITY_STYLE.note;
  const { Icon } = s;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: s.bg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border-subtle)', minHeight: 16 }} />}
      </div>
      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{activity.title}</p>
        {activity.description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: '1.55' }}>{activity.description}</p>
        )}
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {fmtDate(activity.createdAt)} · {fmtTime(activity.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;
  const followUpRef = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  const scrollToFollowUp = useCallback(() => {
    followUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const [lead, setLead]                   = useState<Lead | null>(null);
  const [activities, setActivities]       = useState<LeadActivity[]>([]);
  const [customerId, setCustomerId]       = useState<string | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; lifecycleStage: string } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);

  const [leadQuotes, setLeadQuotes]       = useState<Quote[]>([]);
  const [leadDocs, setLeadDocs]           = useState<LeadDocument[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [uploadingDoc, setUploadingDoc]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [noteText, setNoteText]     = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError]   = useState<string | null>(null);

  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpError, setFUError]     = useState<string | null>(null);
  const [savingFU, setSavingFU]         = useState(false);
  const [clearingFU, setClearingFU]     = useState(false);
  const [fuSuccess, setFUSuccess]       = useState(false);

  const [showActionsMenu, setShowActionsMenu]       = useState(false);
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [markingWon, setMarkingWon]                   = useState(false);
  const [markingLost, setMarkingLost]                 = useState(false);
  const [reopening, setReopening]                     = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog]   = useState(false);
  const [lostReasonInput, setLostReasonInput]         = useState('');
  const [stageError, setStageError]                   = useState<string | null>(null);

  type BriefData = { summary: string; nextBestAction: string; riskFlags: string[]; sentiment: 'hot' | 'warm' | 'cold' | 'lost' };
  const [brief, setBrief]           = useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError]     = useState<string | null>(null);

  const [recording, setRecording]         = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing]   = useState(false);
  const [userRole, setUserRole]           = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowActionsMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  useEffect(() => {
    if (!recording) return;
    const timerId = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    return () => clearInterval(timerId);
  }, [recording]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
      fetch(`/api/v1/leads/${id}/quotes`).catch(() => null),
      fetch(`/api/v1/leads/${id}/documents`).catch(() => null),
      fetch('/api/v1/me').catch(() => null),
    ]).then(async ([leadRes, actRes, quotesRes, docsRes, meRes]) => {
      if (leadRes.status === 404) { setNotFound(true); setLoading(false); return; }
      const { data: leadData } = await leadRes.json() as {
        data: Lead & {
          recentMessages?: WaMessage[];
          customerId?: string | null;
          linkedProject?: { id: string; name: string; lifecycleStage: string } | null;
        }
      };
      setCustomerId(leadData.customerId ?? null);
      setLinkedProject(leadData.linkedProject ?? null);
      setLead(leadData);
      if (actRes?.ok) {
        const { data: actData } = await actRes.json() as { data: LeadActivity[] };
        setActivities(actData ?? []);
      }
      if (quotesRes?.ok) {
        const { data: qData } = await quotesRes.json() as { data: Quote[] };
        setLeadQuotes(qData ?? []);
      }
      if (docsRes?.ok) {
        const { data: dData } = await docsRes.json() as { data: LeadDocument[] };
        setLeadDocs(dData ?? []);
      }
      if (meRes?.ok) {
        const meJson = await meRes.json() as { data?: { role?: string } };
        setUserRole(meJson.data?.role ?? '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true); setNoteError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: 'Note', description: noteText.trim() }),
      });
      const json = await res.json().catch(() => ({})) as { data?: LeadActivity; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setActivities(prev => [json.data!, ...prev]);
      setNoteText('');
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Failed to save note');
    } finally { setSavingNote(false); }
  }

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    setSavingFU(true); setFUError(null); setFUSuccess(false);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
      if (followUpNote.trim()) {
        const dueDateLabel = new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const actRes = await fetch(`/api/v1/leads/${id}/activities`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'follow_up', title: `Follow-up — ${dueDateLabel}`, description: followUpNote.trim(), scheduledAt: new Date(followUpDate + 'T00:00:00').toISOString(), status: 'pending' }),
        });
        if (actRes.ok) {
          const actJson = await actRes.json() as { data?: LeadActivity };
          if (actJson.data) setActivities(prev => [actJson.data!, ...prev]);
        }
      }
      setFollowUpDate(''); setFollowUpNote('');
      setFUSuccess(true); setTimeout(() => setFUSuccess(false), 3000);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule follow-up');
    } finally { setSavingFU(false); }
  }

  async function clearFollowUp() {
    setClearingFU(true); setFUError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: null }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to clear follow-up');
    } finally { setClearingFU(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Delete failed');
      }
      router.push('/leads');
    } catch (e) {
      setShowDeleteConfirm(false);
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const body = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Archive failed');
      router.push('/leads');
    } catch (e) {
      setShowArchiveConfirm(false);
      alert(e instanceof Error ? e.message : 'Archive failed');
    } finally { setArchiving(false); }
  }

  async function changeStage(targetStage: string, lostReason?: string) {
    const isWonTarget  = targetStage === 'won';
    const isLostTarget = targetStage === 'lost';
    if (isWonTarget) setMarkingWon(true);
    else if (isLostTarget) setMarkingLost(true);
    else setReopening(true);
    setStageError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/stage`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage, ...(lostReason ? { lostReason } : {}) }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!); setShowMarkLostDialog(false); setLostReasonInput('');
      if (isWonTarget) {
        const refreshRes = await fetch(`/api/v1/leads/${id}`);
        if (refreshRes.ok) {
          const { data } = await refreshRes.json() as { data: Lead & { linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
          if (data.linkedProject) setLinkedProject(data.linkedProject);
        }
      }
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Stage change failed');
    } finally { setMarkingWon(false); setMarkingLost(false); setReopening(false); }
  }

  async function generateBrief() {
    setBriefLoading(true); setBriefError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/brief`, { method: 'POST' });
      const json = await res.json() as { data?: BriefData; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setBrief(json.data!);
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : 'Unable to generate brief');
    } finally { setBriefLoading(false); }
  }

  async function startRecording() {
    setNoteError(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setNoteError('Microphone access denied. Allow mic permission in your browser settings and try again.'); return; }
    const mimeType = (
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
      MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : null
    );
    let recorder: MediaRecorder;
    try { recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
    catch (e) { stream.getTracks().forEach(t => t.stop()); setNoteError(e instanceof Error ? e.message : 'Your browser does not support audio recording. Try Chrome or Edge.'); return; }
    audioChunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const ext = (mimeType ?? '').includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType ?? 'audio/webm' });
      if (blob.size === 0) { setNoteError('Recording was empty. Please try again.'); return; }
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', blob, `voice-note.${ext}`);
        const res = await fetch(`/api/v1/leads/${id}/voice-note`, { method: 'POST', body: form });
        const json = await res.json() as { data?: { transcript: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
        setNoteText(prev => (prev ? prev + '\n' : '') + json.data!.transcript);
      } catch (e) { setNoteError(e instanceof Error ? e.message : 'Transcription failed'); }
      finally { setTranscribing(false); }
    };
    recorder.start(); mediaRecorderRef.current = recorder; setRecording(true);
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); setRecording(false); setRecordingSeconds(0); }

  async function createQuote() {
    setCreatingQuote(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}/quotes`, { method: 'POST' });
      const json = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create quote');
      router.push(`/quotes/${json.data!.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to create quotation'); setCreatingQuote(false); }
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file); form.append('leadId', id);
      const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: form });
      const json = await res.json() as { data?: LeadDocument; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setLeadDocs(prev => [{ ...json.data!, downloadUrl: null }, ...prev]);
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingDoc(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
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
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Lead not found.</p>
        <button type="button" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-4 w-4" />Back to Pipeline
        </button>
      </div>
    );
  }

  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon       = lead.stage === 'won';
  const isLost      = lead.stage === 'lost';
  const isTerminal  = isWon || isLost;
  const initials    = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const fuUrgency   = lead.followUpDate ? followUpUrgency(lead.followUpDate) : null;

  const followUpStyle = {
    overdue:  { bg: 'var(--danger-soft)',  color: 'var(--danger)',  label: 'Overdue' },
    today:    { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Today'   },
    upcoming: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: ''        },
  };

  // Timeline split: upcoming follow-ups (future scheduledAt) sorted ascending; everything else newest-first
  const nowForTimeline = new Date();
  const upcomingActivities = [...activities]
    .filter(a => a.type === 'follow_up' && a.scheduledAt && new Date(a.scheduledAt) > nowForTimeline)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const historyActivities = [...activities]
    .filter(a => !(a.type === 'follow_up' && a.scheduledAt && new Date(a.scheduledAt) > nowForTimeline))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Project detail chips — only defined fields
  const detailChips: { label: string; value: string; wide?: boolean }[] = [
    lead.projectName    && { label: 'Project Name',   value: lead.projectName,                                wide: true },
    lead.propertyType   && { label: 'Property Type',  value: lead.propertyType },
    lead.budgetBand     && { label: 'Budget Range',   value: lead.budgetBand },
    (lead.projectValuePaise ?? 0) > 0 && { label: 'Final Price', value: fmt(lead.projectValuePaise!) },
    lead.designerName   && { label: 'Designer',       value: lead.designerName },
    lead.source         && { label: 'Lead Source',    value: lead.source.replace('_', ' ') },
    lead.contactEmail   && { label: 'Email',          value: lead.contactEmail },
    lead.alternatePhone && { label: 'Alt. Mobile',    value: lead.alternatePhone },
    lead.pincode        && { label: 'Pincode',        value: lead.pincode },
    lead.projectLocation && { label: 'Site Address',  value: lead.projectLocation, wide: true },
  ].filter(Boolean) as { label: string; value: string; wide?: boolean }[];

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete lead?"
        message={`"${lead.contactName}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" danger loading={deleting}
        onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive lead?"
        message={`"${lead.contactName}" will be moved to the archive and hidden from the active pipeline.`}
        confirmLabel="Archive" loading={archiving}
        onConfirm={handleArchive} onCancel={() => setShowArchiveConfirm(false)}
      />
      {showEditDialog && (
        <EditLeadDialog
          lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog}
          onSuccess={updated => { setLead(updated); setShowEditDialog(false); }}
        />
      )}
      <MarkLostDialog
        open={showMarkLostDialog} value={lostReasonInput} onChange={setLostReasonInput}
        loading={markingLost}
        onCancel={() => { setShowMarkLostDialog(false); setLostReasonInput(''); }}
        onConfirm={() => changeStage('lost', lostReasonInput)}
      />

      <div className="px-4 lg:px-6 pt-5 pb-8">

        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to Pipeline
        </Link>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* HERO */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

              {/* Won / Lost banner */}
              {isTerminal && (
                <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{
                    background: isWon ? 'var(--success-soft)' : 'var(--surface-muted)',
                    border: `1px solid ${isWon ? '#86EFAC' : 'var(--border-strong)'}`,
                    color: isWon ? 'var(--success-text)' : 'var(--text-primary)',
                  }}>
                  {isWon
                    ? <><CheckCircle2 className="h-4 w-4" /> Lead WON — ready to create a project</>
                    : <><AlertCircle  className="h-4 w-4" /> Lead Lost{lead.lostReason ? `: ${lead.lostReason}` : ''}</>
                  }
                </div>
              )}

              {/* Avatar + Name row */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #5B3FDD 100%)' }}>
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="text-[20px] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                        {lead.contactName}
                      </h1>
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <a href={`tel:${lead.contactPhone}`} className="flex items-center gap-1 text-[13px] hover:underline" style={{ color: 'var(--text-secondary)' }}>
                          <Phone className="h-3 w-3" />{lead.contactPhone}
                        </a>
                        {lead.contactCity && (
                          <span className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                            <MapPin className="h-3 w-3" />{lead.contactCity}
                          </span>
                        )}
                        <span className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                          · {lead.source.replace('_', ' ')} · {fmtDate(lead.createdAt)}
                        </span>
                      </div>
                      {/* Badges */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
                          {STAGE_LABELS[lead.stage]}
                        </span>
                        {priorityCfg && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: priorityCfg.bg, color: priorityCfg.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                            {priorityCfg.label}
                          </span>
                        )}
                        {lead.designerName && (
                          <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            <User className="h-3 w-3" />{lead.designerName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Kebab menu */}
                    <div className="relative flex-shrink-0" ref={menuRef}>
                      <button type="button" onClick={() => setShowActionsMenu(v => !v)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                        style={{ border: '1px solid var(--border-subtle)' }}>
                        <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      {showActionsMenu && (
                        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 overflow-hidden"
                          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                          <button type="button" onClick={() => { setShowActionsMenu(false); setShowEditDialog(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                            style={{ color: 'var(--text-heading)' }}>
                            <Edit2 className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} /> Edit Lead
                          </button>
                          <button type="button" onClick={() => { setShowActionsMenu(false); setShowArchiveConfirm(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                            style={{ color: 'var(--text-heading)' }}>
                            <Archive className="h-4 w-4 text-amber-500" /> Archive Lead
                          </button>
                          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <button type="button" onClick={() => { setShowActionsMenu(false); setShowDeleteConfirm(true); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-red-50 transition-colors text-red-600">
                              <Trash2 className="h-4 w-4" /> Delete Lead
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage progress bar */}
              <StageProgressBar stage={lead.stage} isLost={isLost} />

              {/* Follow-up badge */}
              {lead.followUpDate && (
                <div className="mt-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: followUpStyle[fuUrgency!].bg, color: followUpStyle[fuUrgency!].color }}>
                    <Calendar className="h-3.5 w-3.5" />
                    Follow-up: {fmtDate(lead.followUpDate)}
                    {fuUrgency !== 'upcoming' && <span className="font-bold">({followUpStyle[fuUrgency!].label})</span>}
                  </div>
                </div>
              )}

              {/* Stage action buttons */}
              {!isTerminal && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button type="button" onClick={() => changeStage('won')} disabled={markingWon || markingLost}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--success)', color: '#fff' }}>
                    <CheckCircle2 className="h-4 w-4" />{markingWon ? 'Marking Won…' : 'Mark as Won'}
                  </button>
                  <button type="button" onClick={() => setShowMarkLostDialog(true)} disabled={markingWon || markingLost}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border transition-opacity disabled:opacity-60"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}>
                    <AlertCircle className="h-4 w-4" /> Mark as Lost
                  </button>
                </div>
              )}
              {isLost && (
                <div className="mt-3">
                  <button type="button" onClick={() => changeStage('negotiation')} disabled={reopening}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg disabled:opacity-60"
                    style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                    <Zap className="h-4 w-4" />{reopening ? 'Reopening…' : 'Reopen Lead'}
                  </button>
                </div>
              )}
              {stageError && <p className="mt-2 text-xs text-red-600">{stageError}</p>}

              {/* Linked records */}
              {(customerId || linkedProject) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customerId && (
                    <Link href={`/customers/${customerId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold hover:opacity-80"
                      style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success-text)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <User className="h-3 w-3" /> Customer Profile
                    </Link>
                  )}
                  {linkedProject && (
                    <Link href={`/projects/${linkedProject.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold hover:opacity-80"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <FolderKanban className="h-3 w-3" /> {linkedProject.name || 'View Project'}
                    </Link>
                  )}
                </div>
              )}

              {/* Project link if won */}
              {(linkedProject || isWon) && (
                <div className="mt-4">
                  {linkedProject ? (
                    <Link href={`/projects/${linkedProject.id}`} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg">
                      <FolderKanban className="h-4 w-4" /> View Project
                    </Link>
                  ) : (
                    <Link href={`/projects?leadId=${id}`} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg">
                      <FolderKanban className="h-4 w-4" /> Create Project
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* ACTIVITY TIMELINE */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              {/* Note input */}
              <div className="mb-5">
                <div className="relative">
                  <textarea value={noteText} onChange={e => { setNoteText(e.target.value); setNoteError(null); }}
                    placeholder="Add a note — call outcome, meeting summary, client requirements…"
                    rows={3} className="studio-input w-full text-sm resize-none pr-10" />
                  <button type="button" title={recording ? 'Stop recording' : 'Record voice note'}
                    onClick={recording ? stopRecording : startRecording} disabled={transcribing}
                    className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                    style={{
                      background: recording ? 'var(--danger-soft)' : transcribing ? 'var(--surface-muted)' : 'var(--purple-soft)',
                      color: recording ? 'var(--danger)' : transcribing ? 'var(--text-secondary)' : 'var(--violet-primary)',
                    }}>
                    {recording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {recording && (
                  <p className="text-xs flex items-center gap-1.5 mt-1" style={{ color: 'var(--danger)' }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} — tap the mic to stop
                  </p>
                )}
                {transcribing && <p className="text-xs mt-1" style={{ color: 'var(--violet-primary)' }}>Transcribing voice note…</p>}
                {noteError && <p className="text-xs mt-1 text-red-600">{noteError}</p>}
                <button type="button" onClick={saveNote} disabled={savingNote || !noteText.trim()}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50 mt-2">
                  <Plus className="h-4 w-4" />{savingNote ? 'Saving…' : 'Save Note'}
                </button>
              </div>

              {/* Timeline */}
              {(upcomingActivities.length + historyActivities.length) > 0 ? (
                <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {upcomingActivities.length > 0 && (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-base)' }}>Upcoming</p>
                      {upcomingActivities.map((a, i) => (
                        <TimelineEntry key={a.id} activity={a} isLast={i === upcomingActivities.length - 1 && historyActivities.length === 0} />
                      ))}
                      {historyActivities.length > 0 && (
                        <div className="my-4" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                      )}
                    </>
                  )}
                  {historyActivities.length > 0 && (
                    <>
                      {upcomingActivities.length > 0 && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>History</p>
                      )}
                      {historyActivities.map((a, i) => (
                        <TimelineEntry key={a.id} activity={a} isLast={i === historyActivities.length - 1} />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <StickyNote className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    No activity yet. Add a note above to start tracking this lead.
                  </p>
                </div>
              )}
            </div>

            {/* PROJECT DETAILS */}
            <Section title="Project Details" action={
              linkedProject ? (
                <Link href={`/projects/${linkedProject.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-75"
                  style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-subtle)', color: 'var(--accent-base)' }}>
                  <FolderKanban className="h-3 w-3" /> Edit in Project
                </Link>
              ) : (
                <button type="button" onClick={() => setShowEditDialog(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-75"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
              )
            }>
              {detailChips.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detailChips.map(({ label, value, wide }) => (
                    <div key={label}
                      className={`rounded-xl p-3 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No project details yet.{' '}
                  <button type="button" onClick={() => setShowEditDialog(true)} className="underline" style={{ color: 'var(--violet-primary)' }}>Edit lead</button>
                  {' '}to add them.
                </p>
              )}
              {lead.notes && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Initial Notes</p>
                  <p className="text-sm" style={{ color: 'var(--text-heading)', lineHeight: '1.6' }}>{lead.notes}</p>
                </div>
              )}
            </Section>

            {/* QUOTATIONS */}
            <Section
              title={`Quotations${leadQuotes.length > 0 ? ` (${leadQuotes.length})` : ''}`}
              action={
                <button type="button" onClick={createQuote} disabled={creatingQuote}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Plus className="h-3.5 w-3.5" />{creatingQuote ? 'Creating…' : 'Create Quotation'}
                </button>
              }
            >
              {leadQuotes.length > 0 ? (
                <div className="space-y-2">
                  {leadQuotes.map(q => (
                    <Link key={q.id} href={`/quotes/${q.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: 'var(--text-heading)' }}>
                          QUO-{q.id.slice(-6).toUpperCase()} v{q.version}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style={{
                          background: q.status === 'approved' ? 'var(--success-soft)' : q.status === 'sent' ? 'var(--accent-soft)' : 'var(--surface-card)',
                          color: q.status === 'approved' ? 'var(--success-text)' : q.status === 'sent' ? 'var(--accent-text)' : 'var(--text-secondary)',
                        }}>{q.status.toUpperCase()}</span>
                        {q.totalPaise > 0 && (
                          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-gold)' }}>
                            · ₹{(q.totalPaise / 100).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Click &quot;Create Quotation&quot; to draft a pre-sale estimate for this lead.</p>
                </div>
              )}
            </Section>

            {/* DOCUMENTS */}
            <Section
              title={`Documents${leadDocs.length > 0 ? ` (${leadDocs.length})` : ''}`}
              action={
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <Upload className="h-3.5 w-3.5" />{uploadingDoc ? 'Uploading…' : 'Upload Document'}
                </button>
              }
            >
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(f); }} />
              {leadDocs.length > 0 ? (
                <div className="space-y-2">
                  {leadDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                      <FileText className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{doc.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB · ` : ''}
                          {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {doc.downloadUrl && (
                        <a href={doc.downloadUrl} target="_blank" rel="noreferrer"
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--surface-muted)]" title="Download">
                          <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Upload className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Upload floor plans, mood boards, site photos, or any project document.</p>
                </div>
              )}
            </Section>

            <div className="h-20 lg:hidden" />
          </div>{/* end left column */}

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4 self-start lg:sticky lg:top-6">

            {/* ACTIONS — merged Quick Actions + Manage Lead */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>ACTIONS</p>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <a href={`tel:${lead.contactPhone}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <Phone className="h-4 w-4" /> Call
                </a>
                <a href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '').slice(-10)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#F0FDF4', color: '#16A34A' }}>
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>

              <Link href={`/leads/${id}/site-visit`}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-50 transition-colors mb-2"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                <Home className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} /> Schedule Site Visit
              </Link>

              {linkedProject ? (
                <Link href={`/projects/${linkedProject.id}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-2"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <FolderKanban className="h-4 w-4" /> View Project
                </Link>
              ) : isWon ? (
                <Link href={`/projects?leadId=${id}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-2"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                  <FolderKanban className="h-4 w-4" /> Convert to Project
                </Link>
              ) : null}

              <div className="space-y-1 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowEditDialog(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-violet-50 transition-colors text-left"
                  style={{ color: 'var(--text-heading)' }}>
                  <Edit2 className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} /> Edit Lead
                </button>
                <button type="button" onClick={() => setShowArchiveConfirm(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors text-left"
                  style={{ color: 'var(--text-heading)' }}>
                  <Archive className="h-4 w-4 text-amber-500" /> Archive Lead
                </button>
                <button type="button" onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors text-left text-red-600">
                  <Trash2 className="h-4 w-4" /> Delete Lead
                </button>
              </div>
            </div>

            {/* SCHEDULE FOLLOW-UP */}
            <div ref={followUpRef} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>SCHEDULE FOLLOW-UP</p>

              {lead.followUpDate && (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm mb-3"
                  style={{ background: 'var(--surface-muted)', borderLeft: '3px solid var(--text-gold)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-gold)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Current: <strong style={{ color: 'var(--text-heading)' }}>{fmtDate(lead.followUpDate)}</strong>
                    </span>
                  </div>
                  <button type="button" onClick={clearFollowUp} disabled={clearingFU}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                    style={{ color: 'var(--text-secondary)' }}>
                    <X className="h-3 w-3" />{clearingFU ? 'Clearing…' : 'Clear'}
                  </button>
                </div>
              )}

              {/* Quick buttons */}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {[{ label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }].map(({ label, days }) => (
                  <button key={label} type="button" className="btn-secondary px-2.5 py-1 text-xs rounded-lg"
                    onClick={() => { const d = new Date(); d.setDate(d.getDate() + days); setFollowUpDate(d.toISOString().split('T')[0]); }}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="studio-label block mb-1.5">Follow-up Date</label>
                  <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                    className="studio-input w-full text-sm" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="studio-label block mb-1.5">Notes (optional)</label>
                  <textarea value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                    placeholder="What to discuss…" rows={2} className="studio-input w-full text-sm resize-none" />
                </div>
                {followUpError && <p className="text-xs text-red-600">{followUpError}</p>}
                {fuSuccess && <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>Follow-up updated!</p>}
                <button type="button" onClick={scheduleFollowUp} disabled={!followUpDate || savingFU}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                  <Calendar className="h-4 w-4" />
                  {savingFU ? 'Saving…' : lead.followUpDate ? 'Update Follow-up' : 'Schedule Follow-up'}
                </button>
              </div>
            </div>

            {/* AI BRIEF */}
            <Section title="AI Brief" defaultOpen={false}>
              {brief ? (
                <div className="space-y-4">
                  {(() => {
                    const S = { hot: { bg: 'var(--danger-soft)', color: 'var(--danger)' }, warm: { bg: 'var(--warning-soft)', color: 'var(--warning)' }, cold: { bg: 'var(--accent-soft)', color: 'var(--accent-text)' }, lost: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' } };
                    const s = S[brief.sentiment];
                    return <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{brief.sentiment.toUpperCase()}</span>;
                  })()}
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)', lineHeight: '1.65' }}>{brief.summary}</p>
                  <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: 'var(--purple-soft)', border: '1px solid rgba(124,92,252,0.3)' }}>
                    <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--violet-primary)' }} />
                    <div>
                      <p className="text-[10px] font-bold mb-1 tracking-wider" style={{ color: 'var(--violet-primary)' }}>NEXT BEST ACTION</p>
                      <p className="text-sm" style={{ color: 'var(--text-heading)' }}>{brief.nextBestAction}</p>
                    </div>
                  </div>
                  {brief.riskFlags.length > 0 && (
                    <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-soft)' }}>
                      <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                      <div>
                        <p className="text-[10px] font-bold mb-1 tracking-wider" style={{ color: 'var(--danger)' }}>RISKS</p>
                        <ul className="space-y-0.5">
                          {brief.riskFlags.map(flag => <li key={flag} className="text-sm" style={{ color: 'var(--danger-text)' }}>· {flag}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={generateBrief} disabled={briefLoading} className="text-xs disabled:opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {briefLoading ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-5">
                  <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    AI analyses this lead&apos;s activities, budget, and WhatsApp history for next steps and risk flags.
                  </p>
                  {briefError && <p className="text-xs text-red-600 mb-3">{briefError}</p>}
                  <button type="button" onClick={generateBrief} disabled={briefLoading} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                    <Sparkles className="h-4 w-4" />{briefLoading ? 'Generating…' : 'Generate Brief'}
                  </button>
                </div>
              )}
            </Section>

            {/* LEAD SCORE — owner only */}
            {userRole === 'owner' && (lead.score ?? 0) > 0 && lead.scoreBreakdown && (
              <Section title="Lead Score" defaultOpen={false}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl font-bold" style={{ color: (lead.score ?? 0) >= 70 ? 'var(--success)' : (lead.score ?? 0) >= 40 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {lead.score}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>out of 100</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Updated automatically on activity</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {([
                    { label: 'Recency',       val: lead.scoreBreakdown.recency,      max: 30 },
                    { label: 'Project Value', val: lead.scoreBreakdown.value,        max: 25 },
                    { label: 'Completeness',  val: lead.scoreBreakdown.completeness, max: 20 },
                    { label: 'Source',        val: lead.scoreBreakdown.source,       max: 15 },
                    { label: 'Engagement',    val: lead.scoreBreakdown.engagement,   max: 10 },
                  ] as { label: string; val: number; max: number }[]).map(({ label, val, max }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                        <span>{label}</span>
                        <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{val}/{max}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-muted)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(val / max) * 100}%`, background: 'var(--violet-primary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

          </div>{/* end right sidebar */}
        </div>{/* end grid */}
      </div>

      {/* Mobile floating bar */}
      <div className="lg:hidden floating-action-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 gap-2"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-blue-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-600">Call</span>
        </a>
        <a href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer"
          className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-green-50">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <span className="text-[10px] font-medium text-green-600">WhatsApp</span>
        </a>
        <button type="button" onClick={scrollToFollowUp} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-amber-50">
          <Calendar className="h-5 w-5 text-amber-600" />
          <span className="text-[10px] font-medium text-amber-600">Follow-up</span>
        </button>
        <button type="button" onClick={() => setShowEditDialog(true)} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-violet-50">
          <Edit2 className="h-5 w-5" style={{ color: 'var(--violet-primary)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--violet-primary)' }}>Edit</span>
        </button>
        {linkedProject ? (
          <Link href={`/projects/${linkedProject.id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Project</span>
          </Link>
        ) : isWon ? (
          <Link href={`/projects?leadId=${id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Convert</span>
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ opacity: 0.35 }}>
            <FolderKanban className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Convert</span>
          </div>
        )}
      </div>
    </div>
  );
}
