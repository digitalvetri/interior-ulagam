'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, MessageCircle, Calendar,
  Users, MapPin, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ChevronDown, ChevronUp,
  Zap,
  Edit2, Trash2, Archive, MoreVertical,
  Upload, ExternalLink,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity } from '@/types/leads';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { ProjectDetailsDialog } from '@/components/leads/ProjectDetailsDialog';
import { ScheduleSiteVisitModal } from '@/components/leads/ScheduleSiteVisitModal';
import { MarkContactedModal } from '@/components/leads/MarkContactedModal';
import { QualifyLeadModal } from '@/components/leads/QualifyLeadModal';
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal';
import type { DocumentRow } from '@/types/documents';
import type { SiteVisit } from '@/types/site-visits';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DesignDeliverablesTab } from '@/components/leads/DesignDeliverablesTab';

type LeadDocument = DocumentRow & { downloadUrl: string | null };


interface LeadFollowUp {
  id: string;
  followUpDate: string | null;
  stage: string;
  clientStatus: string;
  comments: string | null;
  completedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  createdAt: string;
}

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  // Normalise to midnight local time — avoids IST/UTC offset false-positives.
  const dateStr = dateIso.length === 10 ? dateIso : dateIso.split('T')[0];
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}
function fmtFollowUpDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === tomorrow.getTime())  return 'Tomorrow';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtBudgetBand(band: string): string {
  if (!band) return '';
  const fmtNum = (s: string) =>
    s.replace(/(\d+(?:\.\d+)?)cr/i, '$1 Cr').replace(/(\d+(?:\.\d+)?)l/i, '$1L');
  if (band.startsWith('above_')) return `Above ${fmtNum(band.slice(6))}`;
  if (band.startsWith('below_')) return `Below ${fmtNum(band.slice(6))}`;
  const parts = band.split('_');
  if (parts.length === 2 && parts[0] && parts[1]) return `${fmtNum(parts[0])} – ${fmtNum(parts[1])}`;
  return band.replace(/_/g, ' ');
}
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral',
  website: 'Website', walk_in: 'Walk-in', other: 'Other',
};

const MOVE_STAGE_OPTIONS = [
  { value: 'new',  label: 'New'  },
  { value: 'won',  label: 'Won'  },
  { value: 'lost', label: 'Lost' },
] as const;



/* â”€â”€ MarkLostDialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
/* â”€â”€ Shared micro-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function DetailField({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-heading)' }}>{value}</p>
    </div>
  );
}
function SidebarRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[12px] font-semibold text-right" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  );
}


/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;
  const followUpRef  = useRef<HTMLDivElement>(null);
  const menuRef      = useRef<HTMLDivElement>(null);
  const stageMenuRef = useRef<HTMLDivElement>(null);

  const scrollToFollowUp = useCallback(() => {
    followUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const [lead, setLead]                   = useState<Lead | null>(null);
  const [activities, setActivities]       = useState<LeadActivity[]>([]);
  const [customerId, setCustomerId]       = useState<string | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; lifecycleStage: string } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);

  const [leadDocs, setLeadDocs]           = useState<LeadDocument[]>([]);
  const [uploadingDoc, setUploadingDoc]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOwnerRole, setIsOwnerRole] = useState(false);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpError, setFUError]     = useState<string | null>(null);
  const [savingFU, setSavingFU]         = useState(false);
  const [fuSuccess, setFUSuccess]       = useState(false);
  const [markingDoneId, setMarkingDoneId]           = useState<string | null>(null);
  const [reschedulingFuId, setReschedulingFuId]     = useState<string | null>(null);
  const [rescheduleInput, setRescheduleInput]       = useState('');
  const [followUpActionError, setFollowUpActionError] = useState<string | null>(null);
  const [quotedAmountInput, setQuotedAmountInput] = useState('');
  const [savingQuotedAmount, setSavingQuotedAmount] = useState(false);
  const [quotedAmountSaved, setQuotedAmountSaved] = useState(false);
  const [editingQuotedAmount, setEditingQuotedAmount] = useState(false);

  // Menus / dialogs
  const [showActionsMenu, setShowActionsMenu]       = useState(false);
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showProjectDialog, setShowProjectDialog]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Stage actions
  const [markingWon, setMarkingWon]                   = useState(false);
  const [markingLost, setMarkingLost]                 = useState(false);
  const [reopening, setReopening]                     = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog]   = useState(false);
  const [lostReasonInput, setLostReasonInput]         = useState('');
  const [stageError, setStageError]                   = useState<string | null>(null);
  const [showStageMenu, setShowStageMenu]             = useState(false);

  // Site visit modal
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);

  // Stage-action modals
  const [showMarkContactedModal, setShowMarkContactedModal] = useState(false);
  const [showQualifyModal, setShowQualifyModal]             = useState(false);
  const [showWonFlowModal, setShowWonFlowModal]             = useState(false);

  // Tabs — overview and followups are now inline; only detail tabs remain
  const [siteVisitsData, setSiteVisitsData] = useState<SiteVisit[]>([]);
  const [followUps, setFollowUps]           = useState<LeadFollowUp[]>([]);
  const [followUpsLoaded, setFollowUpsLoaded] = useState(false);


  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowActionsMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  useEffect(() => {
    if (!showStageMenu) return;
    function handleClick(e: MouseEvent) {
      if (stageMenuRef.current && !stageMenuRef.current.contains(e.target as Node)) setShowStageMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showStageMenu]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
      fetch(`/api/v1/leads/${id}/documents`).catch(() => null),
      fetch(`/api/v1/site-visits?leadId=${id}`).catch(() => null),
    ]).then(async ([leadRes, actRes, docsRes, svRes]) => {
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
      if (leadData.projectValuePaise) setQuotedAmountInput(String(Math.round(leadData.projectValuePaise / 100)));
      if (actRes?.ok) {
        const { data: actData } = await actRes.json() as { data: LeadActivity[] };
        setActivities(actData ?? []);
      }
      if (docsRes?.ok) {
        const { data: dData } = await docsRes.json() as { data: LeadDocument[] };
        setLeadDocs(dData ?? []);
      }
      if (svRes?.ok) {
        const svJson = await svRes.json() as { data: SiteVisit[] };
        setSiteVisitsData(svJson.data ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Load follow-ups on mount (shown inline, not behind a tab)
  useEffect(() => {
    if (followUpsLoaded || !id) return;
    fetch(`/api/v1/leads/${id}/follow-ups`)
      .then(r => r.json())
      .then((res: { data?: LeadFollowUp[] }) => {
        setFollowUps(res.data ?? []);
        setFollowUpsLoaded(true);
      })
      .catch(() => setFollowUpsLoaded(true));
  }, [followUpsLoaded, id]);

  // Load lead tasks + current user role
  useEffect(() => {
    if (!id) return;
    fetch('/api/v1/me').then(r => r.ok ? r.json() : null).catch(() => null).then(meRes => {
      if (meRes?.data) setIsOwnerRole(meRes.data.role === 'owner' || meRes.data.isAdmin === true);
    });
  }, [id]);

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    setSavingFU(true); setFUError(null); setFUSuccess(false);
    try {
      const followUpDateISO = new Date(followUpDate + 'T00:00:00').toISOString();

      // Map lead stage to a value accepted by the follow-ups endpoint
      // CX-5: measured and booked are valid active stages for follow-ups
      const validFUStages = new Set(['new','contacted','qualified','site_visit','measurement','measured','booked','quotation','negotiation','won','lost','site_visit_scheduled','consultation_done','proposal_sent']);
      const fuStage = validFUStages.has(lead?.stage ?? '') ? (lead?.stage ?? 'new') : 'contacted';

      // 1. Create follow-up row (also updates lead.followUpDate + lastActivityAt via DB transaction)
      const fuRes = await fetch(`/api/v1/leads/${id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpDate: followUpDateISO,
          stage: fuStage,
          clientStatus: 'callback',
          comments: followUpNote.trim() || null,
          addToCalendar: true,
        }),
      });
      // B-3: Use the activity returned by the API (created atomically server-side)
      const fuJson = await fuRes.json().catch(() => ({})) as { success?: boolean; activity?: LeadActivity; error?: string };
      if (!fuRes.ok) throw new Error(fuJson.error ?? `Failed (${fuRes.status})`);
      if (fuJson.activity) setActivities(prev => [fuJson.activity!, ...prev]);

      // 2. Refresh lead so At a Glance reflects the new followUpDate
      const leadRes = await fetch(`/api/v1/leads/${id}`);
      if (leadRes.ok) {
        const { data: leadData } = await leadRes.json() as { data: Lead };
        setLead(leadData);
      }

      // 3. Refresh follow-up history list from DB
      const fuListRes = await fetch(`/api/v1/leads/${id}/follow-ups`);
      if (fuListRes.ok) {
        const fuListData = await fuListRes.json() as { data?: LeadFollowUp[] };
        setFollowUps(fuListData.data ?? []);
      }

      setFollowUpDate(''); setFollowUpNote('');
      setFUSuccess(true); setTimeout(() => setFUSuccess(false), 3000);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule');
    } finally { setSavingFU(false); }
  }

  async function markFollowUpDone(fu: LeadFollowUp) {
    setMarkingDoneId(fu.id);
    setFollowUpActionError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/follow-ups/${fu.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_done' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setFollowUpActionError(j.error ?? 'Failed to mark follow-up done');
        return;
      }
      const now = new Date().toISOString();
      // Find the next pending follow-up before updating state, so we preserve its date
      const nextPending = followUps.find(f => f.id !== fu.id && !f.completedAt);
      setFollowUps(prev => prev.map(f => f.id === fu.id ? { ...f, completedAt: now } : f));
      setLead(prev => prev ? { ...prev, followUpDate: nextPending?.followUpDate ?? null, lastActivityAt: now } : prev);
    } catch (e) {
      setFollowUpActionError(e instanceof Error ? e.message : 'Failed to mark follow-up done');
    } finally {
      setMarkingDoneId(null);
    }
  }

  async function rescheduleFollowUp(fu: LeadFollowUp) {
    if (!rescheduleInput) return;
    const followUpDate = new Date(rescheduleInput + 'T00:00:00').toISOString();
    setFollowUpActionError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/follow-ups/${fu.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', followUpDate }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setFollowUpActionError(j.error ?? 'Failed to reschedule follow-up');
        return;
      }
      setFollowUps(prev => prev.map(f =>
        f.id === fu.id ? { ...f, followUpDate: rescheduleInput, completedAt: null } : f
      ));
      setReschedulingFuId(null);
      setRescheduleInput('');
      const now = new Date().toISOString();
      setLead(prev => prev ? { ...prev, followUpDate, lastActivityAt: now } : prev);
    } catch (e) {
      setFollowUpActionError(e instanceof Error ? e.message : 'Failed to reschedule follow-up');
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

  // Terminal transitions (won / lost / reopen). Uses the /stage endpoint.
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

  /* Loading / not-found */
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
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

  /* â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const priorityCfg  = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon        = lead.stage === 'won';
  const isLost       = lead.stage === 'lost';
  const isTerminal   = isWon || isLost;
  const initials     = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const quickDates = [
    { label: 'Tomorrow', days: 1 },
    { label: '3 days',   days: 3 },
    { label: '1 week',   days: 7 },
  ];
  function applyQuickDate(days: number) {
    const d = new Date(); d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split('T')[0]);
  }

  const stageActionsDisabled = markingWon || markingLost || reopening;
  const waPhone = lead.contactPhone.replace(/\D/g, '').slice(-10);

  async function handleSiteVisitSuccess() {
    // Refresh site visits so At a Glance shows the new scheduled date
    const svRes = await fetch(`/api/v1/site-visits?leadId=${id}`).catch(() => null);
    if (svRes?.ok) {
      const svJson = await svRes.json() as { data: SiteVisit[] };
      setSiteVisitsData(svJson.data ?? []);
    }
    // Refresh lead — API auto-advances stage to site_visit
    const leadRes = await fetch(`/api/v1/leads/${id}`).catch(() => null);
    if (leadRes?.ok) {
      const { data } = await leadRes.json() as { data: Lead & { customerId?: string | null; linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
      setLead(data);
      setCustomerId(data.customerId ?? null);
      if (data.linkedProject) setLinkedProject(data.linkedProject);
    }
    const actRes = await fetch(`/api/v1/leads/${id}/activities`).catch(() => null);
    if (actRes?.ok) {
      const { data: actData } = await actRes.json() as { data: LeadActivity[] };
      setActivities(actData ?? []);
    }
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

      {/* â”€â”€ Dialogs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
      <NewLeadDialog
        editLead={lead}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={updated => { setLead(updated); setShowEditDialog(false); }}
      />
      {showProjectDialog && (
        <ProjectDetailsDialog
          lead={lead} open={showProjectDialog} onOpenChange={setShowProjectDialog}
          onSuccess={updated => { setLead(updated); setShowProjectDialog(false); }}
        />
      )}
      <MarkLostDialog
        open={showMarkLostDialog} value={lostReasonInput} onChange={setLostReasonInput}
        loading={markingLost}
        onCancel={() => { setShowMarkLostDialog(false); setLostReasonInput(''); }}
        onConfirm={() => changeStage('lost', lostReasonInput)}
      />
      <ScheduleSiteVisitModal
        leadId={id}
        open={showSiteVisitModal}
        onOpenChange={setShowSiteVisitModal}
        defaultAddress={lead.projectLocation || [lead.contactCity, lead.pincode].filter(Boolean).join(', ')}
        defaultDesignerId={lead.ownerId ?? ''}
        onSuccess={(visit) => {
          setSiteVisitsData(prev => [visit as SiteVisit, ...prev]);
          void handleSiteVisitSuccess();
        }}
      />
      <MarkContactedModal
        leadId={id}
        contactName={lead.contactName}
        open={showMarkContactedModal}
        onClose={() => setShowMarkContactedModal(false)}
        onSuccess={(updatedLead, newActivity) => {
          setLead(updatedLead);
          setActivities(prev => [newActivity, ...prev]);
          setShowMarkContactedModal(false);
        }}
      />
      <QualifyLeadModal
        leadId={id}
        lead={lead}
        open={showQualifyModal}
        onClose={() => setShowQualifyModal(false)}
        onSuccess={(updatedLead) => {
          setLead(updatedLead);
          setShowQualifyModal(false);
        }}
      />
      <ConvertLeadModal
        lead={lead}
        open={showWonFlowModal}
        onClose={() => setShowWonFlowModal(false)}
      />

      <div className="p-6 lg:p-8 pb-24 space-y-5">

        {/* Back nav */}
        <Link
          href={customerId ? `/leads/customer/${customerId}` : '/leads'}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-75"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {customerId ? 'Back to Customer' : 'Back to Leads'}
        </Link>

        <div className="space-y-5">

          {/* â”€â”€ HEADER CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            {isTerminal && (
              <div className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium" style={{
                background: isWon ? 'var(--success-soft)' : '#FEF2F2',
                borderBottom: `1px solid ${isWon ? '#86EFAC' : '#FCA5A5'}`,
                color: isWon ? 'var(--success-text)' : '#DC2626',
              }}>
                {isWon
                  ? <><CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Lead Won</>
                  : <><AlertCircle  className="h-4 w-4 flex-shrink-0" /> Lead Lost{lead.lostReason ? ` — ${lead.lostReason}` : ''}</>}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--violet-primary) 0%, #9B8AFB 100%)' }}>
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                        {lead.contactName}
                      </h1>
                      {priorityCfg && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: priorityCfg.bg, color: priorityCfg.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                          {priorityCfg.label.toUpperCase()}
                        </span>
                      )}
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
                        {STAGE_LABELS[lead.stage]}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {[lead.propertyType, lead.contactCity, lead.source ? `via ${SOURCE_LABELS[lead.source] ?? lead.source}` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={`tel:${lead.contactPhone}`}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }} title={lead.contactPhone}>
                    <Phone className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </a>
                  <a href={`https://wa.me/${lead.contactPhone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }} title="WhatsApp">
                    <MessageCircle className="h-3.5 w-3.5" style={{ color: '#25D366' }} />
                  </a>
                  {lead.contactEmail && (
                    <a href={`mailto:${lead.contactEmail}`}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }} title={lead.contactEmail}>
                      <Mail className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </a>
                  )}
                  <button type="button" onClick={() => setShowEditDialog(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <div className="relative" ref={menuRef}>
                    <button type="button" onClick={() => setShowActionsMenu(v => !v)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    {showActionsMenu && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 overflow-hidden"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={() => { setShowActionsMenu(false); setShowArchiveConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)]"
                          style={{ color: 'var(--text-heading)' }}>
                          <Archive className="h-4 w-4 text-amber-500" /> Archive Lead
                        </button>
                        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button type="button" onClick={() => { setShowActionsMenu(false); setShowDeleteConfirm(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-red-50 text-red-600">
                            <Trash2 className="h-4 w-4" /> Delete Lead
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {linkedProject && (
                <div className="mt-4 flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <FolderKanban className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--success-text)' }}>Linked Project</p>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{linkedProject.name}</p>
                  </div>
                  <Link href={`/projects/${linkedProject.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{ background: 'var(--success)', color: '#fff' }}>
                    View Project <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* â”€â”€ ACTION BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="flex items-center gap-2 flex-wrap">
            {customerId && (
              <Link href={`/customers/${customerId}`}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--success-text)' }}>
                <CheckCircle2 className="h-4 w-4" /> View Client
              </Link>
            )}
            {isLost && (
              <button type="button" onClick={() => changeStage('contacted')} disabled={stageActionsDisabled}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)', color: 'var(--violet-primary)' }}>
                <Zap className="h-4 w-4" />{reopening ? 'Reopening…' : 'Reopen Lead'}
              </button>
            )}
            {!isTerminal && (
              <div className="ml-auto flex items-center gap-2">
                {/* Move Stage dropdown */}
                <div className="relative" ref={stageMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowStageMenu(v => !v)}
                    disabled={stageActionsDisabled}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}
                  >
                    Move Stage <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {showStageMenu && (
                    <div className="absolute left-0 top-full mt-1 w-36 rounded-xl shadow-xl z-30 overflow-hidden"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      {MOVE_STAGE_OPTIONS.filter(s => s.value !== lead.stage).map(s => {
                        const isWon  = s.value === 'won';
                        const isLost = s.value === 'lost';
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => {
                              setShowStageMenu(false);
                              if (isWon)       setShowWonFlowModal(true);
                              else if (isLost) setShowMarkLostDialog(true);
                              else             void changeStage(s.value);
                            }}
                            className="w-full flex items-center px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)] transition-colors font-medium"
                            style={{ color: isWon ? 'var(--success-text)' : isLost ? '#DC2626' : 'var(--text-heading)' }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(() => {
                  const now = new Date();
                  const upcoming = siteVisitsData.find(
                    v => v.status === 'scheduled' && new Date(v.scheduledAt) >= now,
                  );
                  return upcoming ? (
                    <span
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border"
                      style={{ borderColor: 'rgba(99,102,241,0.3)', color: 'var(--accent-base)', background: 'var(--accent-soft)' }}>
                      <Calendar className="h-4 w-4" /> Visit {fmtDate(upcoming.scheduledAt)}
                    </span>
                  ) : (
                    <button type="button" onClick={() => setShowSiteVisitModal(true)} disabled={stageActionsDisabled}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
                      <Calendar className="h-4 w-4" /> Schedule Site Visit
                    </button>
                  );
                })()}

                <button type="button" onClick={() => setShowWonFlowModal(true)} disabled={stageActionsDisabled}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: 'rgba(16,185,129,0.4)', color: 'var(--success-text)', background: 'var(--success-soft)' }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {markingWon ? 'Converting…' : customerId ? 'Convert & Create Project' : 'Convert to Client'}
                </button>
              </div>
            )}
          </div>
          {stageError && <p className="text-xs text-red-600 -mt-3">{stageError}</p>}

          {/* â”€â”€ TWO COLUMN LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

            {/* LEFT — Contact details + Tabs + Follow-up */}
            <div className="space-y-3">

              {/* Contact & Project card */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Contact & Project</p>
                  <button type="button" onClick={() => setShowEditDialog(true)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <DetailField label="Mobile" value={
                    <a href={`tel:${lead.contactPhone}`} className="hover:underline">{lead.contactPhone}</a>
                  } />
                  {lead.contactEmail
                    ? <DetailField label="Email" value={<a href={`mailto:${lead.contactEmail}`} className="hover:underline truncate block">{lead.contactEmail}</a>} />
                    : <div />}
                  <DetailField label="Source" value={SOURCE_LABELS[lead.source] ?? lead.source} />
                  {lead.budgetBand
                    ? <DetailField label="Estimated Budget" value={fmtBudgetBand(lead.budgetBand)} />
                    : <div />}
                  {lead.propertyType && <DetailField label="Project Type" value={lead.propertyType} />}
                  {lead.contactCity && (
                    <DetailField label="City" value={lead.contactCity + (lead.pincode ? ` – ${lead.pincode}` : '')} />
                  )}
                </div>
                {lead.projectLocation && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <DetailField label="Site Address" value={lead.projectLocation} />
                  </div>
                )}
                {lead.notes && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <DetailField label="Requirement" value={<span className="leading-relaxed">{lead.notes}</span>} />
                  </div>
                )}
              </div>


              {/* Inline follow-up scheduler */}
              <div ref={followUpRef} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>New Follow-up</p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Due</p>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      className="studio-input text-sm h-9" min={new Date().toISOString().split('T')[0]}
                      suppressHydrationWarning />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Note</p>
                    <input type="text" value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                      placeholder="What to talk about?" className="studio-input w-full text-sm h-9" />
                  </div>
                  <button type="button" onClick={scheduleFollowUp} disabled={!followUpDate || savingFU}
                    className="btn-primary h-9 px-5 text-sm font-semibold disabled:opacity-50 flex-shrink-0">
                    {savingFU ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {quickDates.map(({ label, days }) => (
                    <button key={label} type="button" onClick={() => applyQuickDate(days)}
                      className="px-2.5 py-1 text-xs rounded-lg transition-colors"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {followUpError && <p className="mt-2 text-xs text-red-600">{followUpError}</p>}
                {fuSuccess && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--success)' }}>Follow-up scheduled!</p>}
              </div>

              {/* Follow-up history */}
              {followUpsLoaded && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold px-1" style={{ color: 'var(--text-heading)' }}>
                    Follow-up History {followUps.length > 0 && <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>({followUps.length})</span>}
                  </p>
                  {followUpActionError && (
                    <p className="text-xs text-red-600 px-1">{followUpActionError}</p>
                  )}
                  {followUps.length === 0 && (
                    <div className="rounded-xl px-4 py-4 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No follow-ups scheduled yet</p>
                    </div>
                  )}
                  {followUps.map(fu => {
                    const isCompleted = !!fu.completedAt;
                    const urgency = (!isCompleted && fu.followUpDate) ? followUpUrgency(fu.followUpDate) : null;
                    const badgeCfg =
                      isCompleted                ? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)',  label: 'Done'    } :
                      urgency === 'overdue'      ? { bg: 'var(--danger-soft)',   color: 'var(--danger)',          label: 'Overdue' } :
                      urgency === 'today'        ? { bg: 'var(--warning-soft)',  color: 'var(--warning)',         label: 'Today'   } :
                      urgency === 'upcoming'     ? { bg: 'var(--success-soft)',  color: 'var(--success-text)',    label: 'Pending' } :
                                                  { bg: 'var(--surface-muted)', color: 'var(--text-secondary)',  label: 'Done'    };
                    const isRescheduling = reschedulingFuId === fu.id;
                    const isMarkingDone  = markingDoneId === fu.id;
                    return (
                      <div key={fu.id} className="rounded-xl px-4 py-3.5"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5"
                            style={{ color: isCompleted ? 'var(--text-tertiary)' : urgency === 'overdue' ? 'var(--danger)' : 'var(--accent-base)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                                {fu.followUpDate ? fmtFollowUpDate(fu.followUpDate.split('T')[0]) : fmtDate(fu.createdAt)}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: badgeCfg.bg, color: badgeCfg.color }}>
                                {badgeCfg.label}
                              </span>
                              <span className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>
                                {fu.clientStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {fu.comments && (
                              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{fu.comments}</p>
                            )}
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                              {fu.createdByName ? `by ${fu.createdByName} · ` : ''}{fmtDate(fu.createdAt)}
                            </p>
                            {/* Action buttons — only on pending follow-ups */}
                            {!isCompleted && !isRescheduling && (
                              <div className="flex items-center gap-2 mt-2.5">
                                <button
                                  onClick={() => markFollowUpDone(fu)}
                                  disabled={isMarkingDone}
                                  className="px-2.5 py-1 text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
                                  style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                                  {isMarkingDone ? '…' : '✓ Mark Done'}
                                </button>
                                <button
                                  onClick={() => { setReschedulingFuId(fu.id); setRescheduleInput(''); }}
                                  className="px-2.5 py-1 text-xs rounded-lg font-medium transition-colors"
                                  style={{ background: 'var(--surface-muted)', color: 'var(--text-heading)', border: '1px solid var(--border-subtle)' }}>
                                  Reschedule
                                </button>
                              </div>
                            )}
                            {!isCompleted && isRescheduling && (
                              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                <input
                                  type="date"
                                  value={rescheduleInput}
                                  onChange={e => setRescheduleInput(e.target.value)}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="studio-input h-8 text-xs px-2 w-36"
                                />
                                <button
                                  onClick={() => rescheduleFollowUp(fu)}
                                  disabled={!rescheduleInput}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                                  style={{ background: 'var(--accent-base)', color: '#fff' }}>
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setReschedulingFuId(null)}
                                  className="px-2 py-1.5 text-xs rounded-lg"
                                  style={{ color: 'var(--text-secondary)' }}>
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>{/* end left column */}


            {/* RIGHT SIDEBAR — AT A GLANCE + Quotations mini */}
            <div className="space-y-3">

              {/* AT A GLANCE */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>At a Glance</p>
                <SidebarRow label="Stage" value={STAGE_LABELS[lead.stage] ?? '—'} />
                <SidebarRow label="Assigned To" value={lead.designerName ?? '—'} />
                <SidebarRow label="Next Follow-up" value={lead.followUpDate ? fmtDate(lead.followUpDate) : '—'} />
                {(() => {
                  const now = new Date();
                  const nextVisit = siteVisitsData
                    .filter(v => v.status === 'scheduled' && new Date(v.scheduledAt) >= now)
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
                  const lastVisit = siteVisitsData
                    .filter(v => v.status === 'completed')
                    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];
                  const displayVisit = nextVisit ?? lastVisit;
                  return (
                    <SidebarRow
                      label="Site Visit"
                      value={displayVisit ? fmtDate(displayVisit.scheduledAt) : '—'}
                    />
                  );
                })()}
                <SidebarRow label="Last Activity" value={relDate(lead.lastActivityAt) ?? '—'} />
              </div>

              {/* AMOUNT QUOTED */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Amount Quoted</p>
                {lead.projectValuePaise && !editingQuotedAmount ? (
                  /* Read-only view — amount already saved */
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                      ₹{(lead.projectValuePaise / 100).toLocaleString('en-IN')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuotedAmountInput(String(lead.projectValuePaise! / 100));
                        setEditingQuotedAmount(true);
                      }}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: 'var(--accent-base)' }}>
                      Edit
                    </button>
                  </div>
                ) : (
                  /* Edit view — no amount yet, or user clicked Edit */
                  <div>
                    {!lead.projectValuePaise && (
                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>No amount entered yet</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none" style={{ color: 'var(--text-secondary)' }}>₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={quotedAmountInput}
                          onChange={e => setQuotedAmountInput(e.target.value)}
                          className="studio-input w-full text-sm h-9"
                          style={{ paddingLeft: '1.75rem' }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingQuotedAmount || !quotedAmountInput}
                        onClick={async () => {
                          setSavingQuotedAmount(true);
                          try {
                            const paise = Math.round(parseFloat(quotedAmountInput) * 100);
                            const prevPaise = lead.projectValuePaise;
                            const res = await fetch(`/api/v1/leads/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ projectValuePaise: paise }),
                            });
                            const json = await res.json().catch(() => ({})) as { data?: Lead };
                            if (res.ok && json.data) {
                              setLead(json.data);
                              setQuotedAmountSaved(true);
                              setEditingQuotedAmount(false);
                              setTimeout(() => setQuotedAmountSaved(false), 2000);
                              if (prevPaise !== paise) {
                                const prevStr = prevPaise ? `₹${(prevPaise / 100).toLocaleString('en-IN')}` : 'none';
                                const newStr = `₹${(paise / 100).toLocaleString('en-IN')}`;
                                await fetch(`/api/v1/leads/${id}/activities`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ type: 'note', title: `Amount quoted updated: ${prevStr} â†’ ${newStr}` }),
                                }).catch(() => {});
                              }
                            }
                          } finally { setSavingQuotedAmount(false); }
                        }}
                        className="btn-primary h-9 px-4 text-sm font-semibold disabled:opacity-50 flex-shrink-0">
                        {savingQuotedAmount ? 'Saving…' : 'Save'}
                      </button>
                      {editingQuotedAmount && (
                        <button
                          type="button"
                          onClick={() => setEditingQuotedAmount(false)}
                          className="h-9 px-3 text-sm rounded-lg border flex-shrink-0"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {quotedAmountSaved && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--success)' }}>Saved!</p>}
              </div>

              {/* RECENT ACTIVITY */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Recent Activity</p>
                </div>
                {activities.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
                  </div>
                ) : (
                  <div>
                    {activities.slice(0, 5).map((act, i) => (
                      <div key={act.id}
                        className="flex items-start gap-2.5 px-4 py-3"
                        style={{ borderBottom: i < Math.min(activities.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div className="h-1.5 w-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--accent-base)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--text-heading)' }}>{act.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{relDate(act.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>{/* end right sidebar */}

          </div>{/* end two-column */}

        </div>{/* end space-y-5 */}
      </div>{/* end p-6 */}

      {/* Mobile floating bar */}
      <div className="lg:hidden floating-action-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 gap-2"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-blue-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-600">Call</span>
        </a>
        <a href={`https://wa.me/91${waPhone}`} target="_blank" rel="noreferrer"
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
        ) : !isTerminal ? (
          <button type="button"
            onClick={() => setShowWonFlowModal(true)}
            disabled={stageActionsDisabled}
            className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--violet-primary)' }}>
            <CheckCircle2 className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Won</span>
          </button>
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
