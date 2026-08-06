'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MessageCircle, Calendar, FileText, Home,
  IndianRupee, User, MapPin, Clock, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ChevronDown, ChevronUp,
  Sparkles, Zap, ShieldAlert, Mic, MicOff,
  Edit2, Trash2, Archive, MoreVertical, Mail, Hash,
  Upload, ExternalLink, X,
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

/* ── Collapsible Section ─────────────────────────────────────────────────── */
function Section({ title, defaultOpen = true, action, children }: {
  title: string; defaultOpen?: boolean; action?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setOpen(v => !v)}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</span>
          {open
            ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
          }
        </button>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ── Info row ─────────────────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ElementType; label: string; value: string; href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--surface-muted)' }}>
        <Icon className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
      </div>
      <div>
        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        {href
          ? <a href={href} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-heading)' }}>{value}</a>
          : <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{value}</p>
        }
      </div>
    </div>
  );
}

/* ── Confirm Dialog ───────────────────────────────────────────────────────── */
function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            style={{ background: danger ? 'var(--danger)' : 'var(--violet-primary)', color: '#fff' }}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Mark as Lost Dialog ─────────────────────────────────────────────────── */
function MarkLostDialog({ open, value, onChange, onConfirm, onCancel, loading }: {
  open: boolean; value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
          Mark Lead as Lost
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Provide a reason to help improve the team&apos;s close rate.
        </p>
        <textarea
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'var(--surface-muted)',
            color: 'var(--text-heading)',
          }}
          placeholder="e.g. Budget exceeded, chose a competitor, project postponed…"
          value={value}
          onChange={e => onChange(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        <div className="flex gap-2 justify-end mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !value.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            {loading ? 'Marking Lost…' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
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

  // Quotations + Documents
  const [leadQuotes, setLeadQuotes]       = useState<Quote[]>([]);
  const [leadDocs, setLeadDocs]           = useState<LeadDocument[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [uploadingDoc, setUploadingDoc]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Note
  const [noteText, setNoteText]     = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError]   = useState<string | null>(null);

  // Follow-up
  const [followUpDate, setFollowUpDate]   = useState('');
  const [followUpNote, setFollowUpNote]   = useState('');
  const [followUpError, setFUError]       = useState<string | null>(null);
  const [savingFU, setSavingFU]           = useState(false);
  const [clearingFU, setClearingFU]       = useState(false);
  const [fuSuccess, setFUSuccess]         = useState(false);

  // Actions
  const [showActionsMenu, setShowActionsMenu]     = useState(false);
  const [showEditDialog, setShowEditDialog]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Stage transitions
  const [markingWon, setMarkingWon]               = useState(false);
  const [markingLost, setMarkingLost]             = useState(false);
  const [reopening, setReopening]                 = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false);
  const [lostReasonInput, setLostReasonInput]     = useState('');
  const [stageError, setStageError]               = useState<string | null>(null);

  // AI Brief
  type BriefData = { summary: string; nextBestAction: string; riskFlags: string[]; sentiment: 'hot' | 'warm' | 'cold' | 'lost' };
  const [brief, setBrief]               = useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError]     = useState<string | null>(null);

  // Voice note
  const [recording, setRecording]       = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // Close menu on outside click
  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
      fetch(`/api/v1/leads/${id}/quotes`).catch(() => null),
      fetch(`/api/v1/leads/${id}/documents`).catch(() => null),
    ]).then(async ([leadRes, actRes, quotesRes, docsRes]) => {
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
    setFUSuccess(false);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);

      // Log a follow_up activity when the user added a note
      if (followUpNote.trim()) {
        const dueDateLabel = new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        const actRes = await fetch(`/api/v1/leads/${id}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'follow_up',
            title: `Follow-up — ${dueDateLabel}`,
            description: followUpNote.trim(),
            scheduledAt: new Date(followUpDate + 'T00:00:00').toISOString(),
            status: 'pending',
          }),
        });
        if (actRes.ok) {
          const actJson = await actRes.json() as { data?: LeadActivity };
          if (actJson.data) setActivities(prev => [actJson.data!, ...prev]);
        }
      }

      setFollowUpDate('');
      setFollowUpNote('');
      setFUSuccess(true);
      setTimeout(() => setFUSuccess(false), 3000);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule follow-up');
    } finally {
      setSavingFU(false);
    }
  }

  async function clearFollowUp() {
    setClearingFU(true);
    setFUError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: null }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to clear follow-up');
    } finally {
      setClearingFU(false);
    }
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
    } finally {
      setDeleting(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const body = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Archive failed');
      router.push('/leads');
    } catch (e) {
      setShowArchiveConfirm(false);
      alert(e instanceof Error ? e.message : 'Archive failed');
    } finally {
      setArchiving(false);
    }
  }

  async function changeStage(targetStage: string, lostReason?: string) {
    const isWonTarget  = targetStage === 'won';
    const isLostTarget = targetStage === 'lost';

    if (isWonTarget)  setMarkingWon(true);
    else if (isLostTarget) setMarkingLost(true);
    else setReopening(true);

    setStageError(null);

    try {
      const res = await fetch(`/api/v1/leads/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: targetStage,
          ...(lostReason ? { lostReason } : {}),
        }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);

      setLead(json.data!);
      setShowMarkLostDialog(false);
      setLostReasonInput('');

      // Refresh linked project after won (project is created server-side)
      if (isWonTarget) {
        const refreshRes = await fetch(`/api/v1/leads/${id}`);
        if (refreshRes.ok) {
          const { data } = await refreshRes.json() as {
            data: Lead & { linkedProject?: { id: string; name: string; lifecycleStage: string } | null };
          };
          if (data.linkedProject) setLinkedProject(data.linkedProject);
        }
      }
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Stage change failed');
    } finally {
      setMarkingWon(false);
      setMarkingLost(false);
      setReopening(false);
    }
  }

  async function generateBrief() {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/brief`, { method: 'POST' });
      const json = await res.json() as { data?: BriefData; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setBrief(json.data!);
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : 'Unable to generate brief');
    } finally {
      setBriefLoading(false);
    }
  }

  async function startRecording() {
    setNoteError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNoteError('Microphone access denied. Allow mic permission in your browser settings and try again.');
      return;
    }

    // Try MIME types in order of broad browser support
    const mimeType = (
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
      MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' :
      null
    );

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      setNoteError(e instanceof Error ? e.message : 'Your browser does not support audio recording. Try Chrome or Edge.');
      return;
    }

    audioChunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const ext = (mimeType ?? '').includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType ?? 'audio/webm' });
      if (blob.size === 0) {
        setNoteError('Recording was empty. Please try again.');
        return;
      }
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', blob, `voice-note.${ext}`);
        const res = await fetch(`/api/v1/leads/${id}/voice-note`, { method: 'POST', body: form });
        const json = await res.json() as { data?: { transcript: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
        setNoteText(prev => (prev ? prev + '\n' : '') + json.data!.transcript);
      } catch (e) {
        setNoteError(e instanceof Error ? e.message : 'Transcription failed');
      } finally {
        setTranscribing(false);
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function createQuote() {
    setCreatingQuote(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}/quotes`, { method: 'POST' });
      const json = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create quote');
      router.push(`/quotes/${json.data!.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create quotation');
      setCreatingQuote(false);
    }
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('leadId', id);
      const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: form });
      const json = await res.json() as { data?: LeadDocument; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setLeadDocs(prev => [{ ...json.data!, downloadUrl: null }, ...prev]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Lead not found.</p>
        <button type="button" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-4 w-4" />Back to Pipeline
        </button>
      </div>
    );
  }

  const priorityCfg  = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon        = lead.stage === 'won';
  const isLost       = lead.stage === 'lost';
  const isTerminal   = isWon || isLost;
  const initials     = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const fuUrgency    = lead.followUpDate ? followUpUrgency(lead.followUpDate) : null;
  const siteVisits          = activities.filter(a => a.type === 'site_visit');
  const noteActivities      = activities.filter(a => a.type === 'note' || a.type === 'follow_up');
  const stageChangeActivities = activities.filter(a => a.type === 'stage_change');

  const followUpStyle = {
    overdue:  { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Overdue' },
    today:    { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Today'   },
    upcoming: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: ''        },
  };

  const hasContactInfo = lead.alternatePhone || lead.contactEmail || lead.contactCity || lead.pincode || lead.projectLocation;

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

      {/* Confirmations */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete lead?"
        message={`"${lead.contactName}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive lead?"
        message={`"${lead.contactName}" will be moved to the archive and hidden from the active pipeline.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Edit Dialog */}
      {showEditDialog && (
        <EditLeadDialog
          lead={lead}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={updated => { setLead(updated); setShowEditDialog(false); }}
        />
      )}

      {/* Mark as Lost Dialog */}
      <MarkLostDialog
        open={showMarkLostDialog}
        value={lostReasonInput}
        onChange={setLostReasonInput}
        loading={markingLost}
        onCancel={() => { setShowMarkLostDialog(false); setLostReasonInput(''); }}
        onConfirm={() => changeStage('lost', lostReasonInput)}
      />

      <div className="px-6 pt-5 pb-8">

        {/* ── Back link ───────────────────────────────────────────────── */}
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to Pipeline
        </Link>

        {/* ── Two-column grid ─────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-4">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

          {/* Won / Lost banner */}
          {isTerminal && (
            <div
              className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: isWon ? 'var(--success-soft)' : 'var(--surface-muted)',
                border: `1px solid ${isWon ? '#86EFAC' : 'var(--border-strong)'}`,
                color:  isWon ? 'var(--success-text)' : 'var(--text-primary)',
              }}
            >
              {isWon
                ? <><CheckCircle2 className="h-4 w-4" /> Lead WON — ready to create a project</>
                : <><AlertCircle  className="h-4 w-4" /> Lead Lost{lead.lostReason ? `: ${lead.lostReason}` : ''}</>
              }
            </div>
          )}

          {/* Avatar row + action menu */}
          <div className="flex items-start gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #5B3FDD 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
                  {lead.contactName}
                </h1>
                {/* Action dropdown */}
                <div className="relative flex-shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setShowActionsMenu(v => !v)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  >
                    <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showActionsMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 overflow-hidden"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
                    >
                      <button
                        type="button"
                        onClick={() => { setShowActionsMenu(false); setShowEditDialog(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Edit2 className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
                        Edit Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowActionsMenu(false); setShowArchiveConfirm(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--text-heading)' }}
                      >
                        <Archive className="h-4 w-4 text-amber-500" />
                        Archive Lead
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
                          onClick={() => { setShowActionsMenu(false); setShowDeleteConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-red-50 transition-colors text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Lead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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

          {/* Stage action buttons */}
          {!isTerminal && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={() => changeStage('won')}
                disabled={markingWon || markingLost}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
                style={{ background: 'var(--success)', color: '#fff' }}
              >
                <CheckCircle2 className="h-4 w-4" />
                {markingWon ? 'Marking Won…' : 'Mark as Won'}
              </button>
              <button
                type="button"
                onClick={() => setShowMarkLostDialog(true)}
                disabled={markingWon || markingLost}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border transition-opacity disabled:opacity-60"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
              >
                <AlertCircle className="h-4 w-4" />
                Mark as Lost
              </button>
            </div>
          )}
          {isLost && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => changeStage('negotiation')}
                disabled={reopening}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
                style={{ background: 'var(--violet-primary)', color: '#fff' }}
              >
                <Zap className="h-4 w-4" />
                {reopening ? 'Reopening…' : 'Reopen Lead'}
              </button>
            </div>
          )}
          {stageError && (
            <p className="mt-2 text-xs text-red-600">{stageError}</p>
          )}

          {/* Linked records chips */}
          {(customerId || linkedProject) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customerId && (
                <Link
                  href={`/customers/${customerId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success-text)', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <User className="h-3 w-3" /> Customer Profile
                </Link>
              )}
              {linkedProject && (
                <Link
                  href={`/projects/${linkedProject.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  <FolderKanban className="h-3 w-3" /> {linkedProject.name || 'View Project'}
                </Link>
              )}
            </div>
          )}

          {/* Follow-up badge */}
          {lead.followUpDate && (
            <div className="mt-3">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: followUpStyle[fuUrgency!].bg, color: followUpStyle[fuUrgency!].color }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Follow-up: {fmtDate(lead.followUpDate)}
                {fuUrgency !== 'upcoming' && (
                  <span className="font-bold">({followUpStyle[fuUrgency!].label})</span>
                )}
              </div>
            </div>
          )}

          {/* Project link — only when won or already converted */}
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

        {/* ── Contact Information ────────────────────────────────────────── */}
        <Section title="Contact Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={Phone} label="Mobile Number" value={lead.contactPhone} href={`tel:${lead.contactPhone}`} />
            {lead.alternatePhone && (
              <InfoRow icon={Phone} label="Alternate Mobile" value={lead.alternatePhone} href={`tel:${lead.alternatePhone}`} />
            )}
            {lead.contactEmail && (
              <InfoRow icon={Mail} label="Email Address" value={lead.contactEmail} href={`mailto:${lead.contactEmail}`} />
            )}
            {lead.contactCity && (
              <InfoRow icon={MapPin} label="City" value={lead.contactCity} />
            )}
            {lead.pincode && (
              <InfoRow icon={Hash} label="Pincode" value={lead.pincode} />
            )}
            {lead.projectLocation && (
              <div className="sm:col-span-2">
                <InfoRow icon={MapPin} label="Site Address" value={lead.projectLocation} />
              </div>
            )}
            {!hasContactInfo && (
              <p className="text-sm col-span-2" style={{ color: 'var(--text-secondary)' }}>
                No additional contact details.{' '}
                <button type="button" onClick={() => setShowEditDialog(true)} className="underline" style={{ color: 'var(--violet-primary)' }}>
                  Edit lead
                </button>{' '}to add them.
              </p>
            )}
          </div>
        </Section>

        {/* ── Project Details ───────────────────────────────────────────── */}
        <Section
          title="Project Details"
          action={
            <button
              type="button"
              onClick={() => setShowEditDialog(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-75"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          }
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="sm:col-span-2 flex items-start gap-2">
              <FolderKanban className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Project Name</dt>
                <dd className="font-medium" style={{ color: lead.projectName ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
                  {lead.projectName || '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Project Type</dt>
                <dd style={{ color: lead.propertyType ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
                  {lead.propertyType || '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <IndianRupee className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Budget Range</dt>
                <dd style={{ color: lead.budgetBand ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
                  {lead.budgetBand || '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <IndianRupee className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-gold)' }} />
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Final Price</dt>
                <dd className="font-semibold" style={{ color: (lead.projectValuePaise ?? 0) > 0 ? 'var(--text-gold)' : 'var(--text-secondary)' }}>
                  {(lead.projectValuePaise ?? 0) > 0 ? fmt(lead.projectValuePaise!) : '—'}
                </dd>
              </div>
            </div>
            {lead.designerName && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
                <div>
                  <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Assigned Designer</dt>
                  <dd style={{ color: 'var(--text-heading)' }}>{lead.designerName}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              <div>
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lead Source · Added</dt>
                <dd style={{ color: 'var(--text-heading)' }}>
                  {lead.source.replace('_', ' ')} · {fmtDate(lead.createdAt)}
                </dd>
              </div>
            </div>
          </dl>
          {lead.notes && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</p>
              <p className="text-sm" style={{ color: 'var(--text-heading)', lineHeight: '1.6' }}>{lead.notes}</p>
            </div>
          )}
        </Section>

        {/* ── Add Note ─────────────────────────────────────────────────── */}
        <Section title="Add Note">
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={noteText}
                onChange={e => { setNoteText(e.target.value); setNoteError(null); }}
                placeholder="E.g. Client prefers modern style, called to confirm site visit…"
                rows={3}
                className="studio-input w-full text-sm resize-none pr-10"
              />
              <button
                type="button"
                title={recording ? 'Stop recording' : 'Record voice note'}
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: recording ? 'var(--danger-soft)' : transcribing ? 'var(--surface-muted)' : 'var(--purple-soft)',
                  color: recording ? 'var(--danger)' : transcribing ? 'var(--text-secondary)' : 'var(--violet-primary)',
                }}
              >
                {recording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            </div>
            {recording && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Recording — tap the mic to stop
              </p>
            )}
            {transcribing && <p className="text-xs" style={{ color: 'var(--violet-primary)' }}>Transcribing voice note…</p>}
            {noteError && <p className="text-xs text-red-600">{noteError}</p>}
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
          {noteActivities.length > 0 && (
            <div className="mt-4 space-y-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>SAVED NOTES</p>
              {noteActivities.map(n => (
                <div key={n.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                  {n.type === 'follow_up' && (
                    <p className="text-[10px] font-bold mb-1 tracking-wider flex items-center gap-1" style={{ color: 'var(--text-gold)' }}>
                      <Calendar className="h-3 w-3" /> {n.title}
                    </p>
                  )}
                  <p className="text-sm" style={{ color: 'var(--text-heading)', lineHeight: '1.5' }}>{n.description}</p>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                <div key={sv.id} className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--purple-soft)' }}>
                      <Home className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{sv.title}</p>
                      {sv.description && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sv.description}</p>}
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>{fmtDate(sv.createdAt)} · {fmtTime(sv.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}


        {/* ── Stage History ─────────────────────────────────────────── */}
        {stageChangeActivities.length > 0 && (
          <Section title={`Stage History (${stageChangeActivities.length})`} defaultOpen={false}>
            <div className="space-y-2">
              {stageChangeActivities.map(a => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--purple-soft)' }}>
                    <Zap className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{a.title}</p>
                    {a.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>}
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{fmtDate(a.createdAt)} · {fmtTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Quotations ────────────────────────────────────────────── */}
        <Section
          title={`Quotations${leadQuotes.length > 0 ? ` (${leadQuotes.length})` : ''}`}
          defaultOpen={true}
          action={
            <button
              type="button"
              onClick={createQuote}
              disabled={creatingQuote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingQuote ? 'Creating…' : 'Create Quotation'}
            </button>
          }
        >
          {leadQuotes.length > 0 ? (
            <div className="space-y-2">
              {leadQuotes.map(q => (
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-xs font-mono font-semibold" style={{ color: 'var(--text-heading)' }}>
                      QUO-{q.id.slice(-6).toUpperCase()} · v{q.version}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          background: q.status === 'approved' ? 'var(--success-soft)' : q.status === 'sent' ? 'var(--accent-soft)' : 'var(--surface-muted)',
                          color: q.status === 'approved' ? 'var(--success-text)' : q.status === 'sent' ? 'var(--accent-text)' : 'var(--text-secondary)',
                        }}
                      >
                        {q.status.toUpperCase()}
                      </span>
                      {q.totalPaise > 0 && (
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-gold)' }}>
                          ₹{(q.totalPaise / 100).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <FileText className="h-7 w-7 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Click &quot;Create Quotation&quot; to draft a pre-sale estimate for this lead.</p>
            </div>
          )}
        </Section>

        {/* ── Documents ─────────────────────────────────────────────── */}
        <Section
          title={`Documents${leadDocs.length > 0 ? ` (${leadDocs.length})` : ''}`}
          defaultOpen={true}
          action={
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingDoc ? 'Uploading…' : 'Upload Document'}
            </button>
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(f); }}
          />
          {leadDocs.length > 0 ? (
            <div className="space-y-2">
              {leadDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{doc.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB · ` : ''}
                      {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {doc.downloadUrl && (
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
                      title="Download"
                    >
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

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────── */}
        <div className="space-y-4 self-start lg:sticky lg:top-6">

          {/* Quick Actions */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[11px] font-semibold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>QUICK ACTIONS</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors hover:bg-blue-50">
                <Phone className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Call</span>
              </a>
              <a
                href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '').slice(-10)}`}
                target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors hover:bg-green-50"
              >
                <MessageCircle className="h-5 w-5 text-green-600" />
                <span className="text-xs font-medium text-green-600">WhatsApp</span>
              </a>
              <Link href={`/leads/${id}/site-visit`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors hover:bg-violet-50">
                <Home className="h-5 w-5" style={{ color: 'var(--violet-primary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--violet-primary)' }}>Site Visit</span>
              </Link>
              {linkedProject ? (
                <Link href={`/projects/${linkedProject.id}`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors" style={{ background: 'var(--violet-primary)' }}>
                  <FolderKanban className="h-5 w-5 text-white" />
                  <span className="text-xs font-medium text-white">Project</span>
                </Link>
              ) : isWon ? (
                <Link href={`/projects?leadId=${id}`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors" style={{ background: 'var(--violet-primary)' }}>
                  <FolderKanban className="h-5 w-5 text-white" />
                  <span className="text-xs font-medium text-white">Convert</span>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl" title="Win this lead first" style={{ opacity: 0.35 }}>
                  <FolderKanban className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Convert</span>
                </div>
              )}
            </div>
          </div>

          {/* Manage Lead */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[11px] font-semibold mb-3 tracking-wider" style={{ color: 'var(--text-secondary)' }}>MANAGE LEAD</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowEditDialog(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-violet-50 text-left"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <Edit2 className="h-4 w-4" style={{ color: 'var(--violet-primary)' }} />
                <span style={{ color: 'var(--text-heading)' }}>Edit Lead</span>
              </button>
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-amber-50 text-left"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <Archive className="h-4 w-4 text-amber-500" />
                <span style={{ color: 'var(--text-heading)' }}>Archive Lead</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 text-left text-red-600"
                style={{ border: '1px solid var(--danger-soft)' }}
              >
                <Trash2 className="h-4 w-4" />
                Delete Lead
              </button>
            </div>
          </div>

          {/* Schedule Follow-up */}
          <div ref={followUpRef}>
          <Section title="Schedule Follow-up">
            {lead.followUpDate && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm mb-4"
                style={{ background: 'var(--surface-muted)', borderLeft: '3px solid var(--text-gold)' }}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-gold)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Current: <strong style={{ color: 'var(--text-heading)' }}>{fmtDate(lead.followUpDate)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearFollowUp}
                  disabled={clearingFU}
                  title="Clear follow-up"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X className="h-3 w-3" />
                  {clearingFU ? 'Clearing…' : 'Clear'}
                </button>
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
                  placeholder="What to discuss…"
                  rows={2}
                  className="studio-input w-full text-sm resize-none"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Quick:</p>
                {[{ label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }].map(({ label, days }) => (
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
              {followUpError && <p className="text-xs text-red-600">{followUpError}</p>}
              {fuSuccess && <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>Follow-up updated!</p>}
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
          </div>

          {/* AI Brief */}
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
                  <Sparkles className="h-4 w-4" />
                  {briefLoading ? 'Generating…' : 'Generate Brief'}
                </button>
              </div>
            )}
          </Section>

          {/* Lead Score */}
          {(lead.score ?? 0) > 0 && lead.scoreBreakdown && (
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

      {/* ── Mobile floating bar ──────────────────────────────────────── */}
      <div
        className="lg:hidden floating-action-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 gap-2"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors hover:bg-blue-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-600">Call</span>
        </a>
        <a href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer"
          className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors hover:bg-green-50">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <span className="text-[10px] font-medium text-green-600">WhatsApp</span>
        </a>
        <button type="button" onClick={scrollToFollowUp} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors hover:bg-amber-50">
          <Calendar className="h-5 w-5 text-amber-600" />
          <span className="text-[10px] font-medium text-amber-600">Follow-up</span>
        </button>
        <button type="button" onClick={() => setShowEditDialog(true)} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors hover:bg-violet-50">
          <Edit2 className="h-5 w-5" style={{ color: 'var(--violet-primary)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--violet-primary)' }}>Edit</span>
        </button>
        {linkedProject ? (
          <Link href={`/projects/${linkedProject.id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Project</span>
          </Link>
        ) : isWon ? (
          <Link href={`/projects?leadId=${id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors" style={{ background: 'var(--violet-primary)' }}>
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
