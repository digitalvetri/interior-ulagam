'use client';

import { use, useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Tag, User, Calendar,
  Trash2, Save, Loader2, MessageCircle, StickyNote, Users,
  ArrowRightCircle, FolderOpen, CreditCard, Bell, Plus, Send,
  ChevronRight, IndianRupee, Sparkles, ShieldAlert, TrendingUp, X,
  Clock, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STAGE_LABEL } from '@/types/customers';
import type { Customer, CustomerActivity, CustomerActivityType, CustomerSource, CustomerStage, CustomerSummary } from '@/types/customers';
import type { CustomerHealthBrief } from '@/app/api/v1/customers/[id]/health-brief/route';

/* ── Constants ────────────────────────────────────────────────────────────── */

const STAGES: { value: CustomerStage; label: string }[] = [
  { value: 'lead',        label: 'Lead'        },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'client',      label: 'Client'      },
  { value: 'past_client', label: 'Past client' },
];
const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'referral',  label: 'Referral'  },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'website',   label: 'Website'   },
  { value: 'walk_in',   label: 'Walk-in'   },
  { value: 'imported',  label: 'Imported'  },
  { value: 'other',     label: 'Other'     },
];

const STAGE_STYLE: Record<CustomerStage, { bg: string; color: string; dot: string }> = {
  lead:        { bg: 'rgba(100,116,139,0.10)', color: '#475569', dot: '#94a3b8' },
  opportunity: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning-text)', dot: 'var(--warning)' },
  client:      { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)', dot: 'var(--success)' },
  past_client: { bg: 'rgba(148,163,184,0.12)', color: '#64748b', dot: '#cbd5e1' },
};

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead: 'Lead', opportunity: 'Opportunity', client: 'Client', past_client: 'Past client',
};

const ACTIVITY_META: Record<CustomerActivityType, { label: string; color: string; icon: React.ReactNode }> = {
  note:              { label: 'Note',             color: 'var(--warning)', icon: <StickyNote  className="h-3.5 w-3.5" /> },
  call:              { label: 'Call',             color: 'var(--accent-base)', icon: <Phone       className="h-3.5 w-3.5" /> },
  whatsapp:          { label: 'WhatsApp',         color: '#25d366', icon: <MessageCircle className="h-3.5 w-3.5" /> },
  meeting:           { label: 'Meeting',          color: 'var(--accent-base)', icon: <Users       className="h-3.5 w-3.5" /> },
  site_visit:        { label: 'Site visit',       color: 'var(--warning)', icon: <MapPin      className="h-3.5 w-3.5" /> },
  stage_change:      { label: 'Stage changed',    color: '#64748b', icon: <ArrowRightCircle className="h-3.5 w-3.5" /> },
  project_created:   { label: 'Project created',  color: '#6366f1', icon: <FolderOpen  className="h-3.5 w-3.5" /> },
  payment_received:  { label: 'Payment received', color: '#14b8a6', icon: <CreditCard  className="h-3.5 w-3.5" /> },
  quote_sent:        { label: 'Quote sent',       color: '#f97316', icon: <Send        className="h-3.5 w-3.5" /> },
  follow_up:         { label: 'Follow-up',        color: '#ec4899', icon: <Bell        className="h-3.5 w-3.5" /> },
};

const COMPOSER_TYPES: { type: CustomerActivityType; label: string }[] = [
  { type: 'note',     label: 'Note'     },
  { type: 'call',     label: 'Call'     },
  { type: 'whatsapp', label: 'WhatsApp' },
  { type: 'meeting',  label: 'Meeting'  },
  { type: 'follow_up', label: 'Follow-up' },
];

const LIFECYCLE_LABEL: Record<string, string> = {
  design_pending:      'Design pending',
  design_in_progress:  'Design in progress',
  design_approved:     'Design approved',
  procurement:         'Procurement',
  execution:           'Execution',
  snagging:            'Snagging',
  handover:            'Handover',
  complete:            'Complete',
};

const LIFECYCLE_PROGRESS: Record<string, number> = {
  design_pending:      10,
  design_in_progress:  25,
  design_approved:     40,
  procurement:         55,
  execution:           70,
  snagging:            85,
  handover:            95,
  complete:            100,
};

const LIFECYCLE_STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  design_pending:     { bg: 'rgba(100,116,139,0.10)', color: '#475569' },
  design_in_progress: { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5' },
  design_approved:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)' },
  procurement:        { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning-text)' },
  execution:          { bg: 'rgba(59,130,246,0.12)',  color: 'var(--accent-text)' },
  snagging:           { bg: 'rgba(249,115,22,0.12)',  color: '#c2410c' },
  handover:           { bg: 'rgba(168,85,247,0.12)',  color: '#7e22ce' },
  complete:           { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)' },
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function groupByDate(activities: CustomerActivity[]) {
  const groups: { label: string; items: CustomerActivity[] }[] = [];
  const map = new Map<string, CustomerActivity[]>();
  const now = new Date();

  for (const a of activities) {
    const d = new Date(a.createdAt);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    let key: string;
    if (diffDays === 0) key = 'Today';
    else if (diffDays === 1) key = 'Yesterday';
    else if (diffDays < 7) key = 'This week';
    else key = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }

  for (const [label, items] of map) {
    groups.push({ label, items });
  }
  return groups;
}

/* ── Avatar ────────────────────────────────────────────────────────────── */

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.3, backgroundColor: `hsl(${hue}, 55%, 45%)` }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

type Tab = 'overview' | 'activity' | 'projects' | 'finance' | 'whatsapp';

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  templateName: string | null;
  category: string | null;
  createdAt: string;
}

const HEALTH_STATUS_META: Record<CustomerHealthBrief['status'], { label: string; color: string; bg: string }> = {
  hot:      { label: '🔥 Hot',     color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  healthy:  { label: '✅ Healthy', color: 'var(--success)', bg: 'rgba(16,185,129,0.10)' },
  at_risk:  { label: '⚠️ At risk', color: 'var(--warning)', bg: 'rgba(245,158,11,0.10)' },
  inactive: { label: '💤 Inactive', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft]     = useState<Partial<Customer>>({});
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [notesDraft, setNotesDraft]   = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesErr, setNotesErr]       = useState<string | null>(null);

  const [activeTab, setActiveTab]   = useState<Tab>('overview');

  // Activity tab state
  const [activities, setActivities]     = useState<CustomerActivity[]>([]);
  const [activitiesLoaded, setActLoaded] = useState(false);
  const [activitiesLoading, setActLoading] = useState(false);
  const [composerType, setComposerType] = useState<CustomerActivityType>('note');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody]   = useState('');
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerErr, setComposerErr]     = useState<string | null>(null);

  // Projects tab state
  const [summary, setSummary]           = useState<CustomerSummary | null>(null);
  const [summaryLoaded, setSumLoaded]   = useState(false);
  const [summaryLoading, setSumLoading] = useState(false);

  // WhatsApp tab state
  const [messages, setMessages]           = useState<WaMessage[]>([]);
  const [messagesLoaded, setMsgLoaded]    = useState(false);
  const [messagesLoading, setMsgLoading]  = useState(false);
  const [waDraft, setWaDraft]             = useState('');
  const [waSending, setWaSending]         = useState(false);
  const [waError, setWaError]             = useState<string | null>(null);
  const waThreadRef = useRef<HTMLDivElement | null>(null);

  // AI health brief state
  const [health, setHealth]           = useState<CustomerHealthBrief | null>(null);
  const [healthLoading, setHlthLoading] = useState(false);
  const [healthError, setHlthError]   = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  /* ── Load customer ── */
  const load = useCallback(() => {
    fetch(`/api/v1/customers/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((res) => {
        if (!res) return;
        setCustomer(res.data);
        setNotesDraft(res.data?.notes ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* ── Lazy-load activities ── */
  const loadActivities = useCallback(() => {
    if (activitiesLoaded) return;
    setActLoading(true);
    fetch(`/api/v1/customers/${id}/activities`)
      .then((r) => r.json())
      .then(({ data }) => { setActivities(data ?? []); setActLoaded(true); })
      .catch(() => {})
      .finally(() => setActLoading(false));
  }, [id, activitiesLoaded]);

  /* ── Lazy-load summary ── */
  const loadSummary = useCallback(() => {
    if (summaryLoaded) return;
    setSumLoading(true);
    fetch(`/api/v1/customers/${id}/summary`)
      .then((r) => r.json())
      .then(({ data }) => { setSummary(data); setSumLoaded(true); })
      .catch(() => {})
      .finally(() => setSumLoading(false));
  }, [id, summaryLoaded]);

  /* ── Lazy-load WhatsApp messages ── */
  const loadMessages = useCallback(() => {
    if (messagesLoaded) return;
    setMsgLoading(true);
    fetch(`/api/v1/customers/${id}/messages`)
      .then((r) => r.json())
      .then(({ data }) => { setMessages(data ?? []); setMsgLoaded(true); })
      .catch(() => {})
      .finally(() => setMsgLoading(false));
  }, [id, messagesLoaded]);

  // Eagerly load summary + activities for the overview dashboard
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadActivities(); }, [loadActivities]);

  /* ── Send WhatsApp message ── */
  async function sendWaMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = waDraft.trim();
    if (!text || waSending) return;
    setWaSending(true);
    setWaError(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json() as { data?: WaMessage; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      if (json.data) setMessages((prev) => [json.data!, ...prev]);
      setWaDraft('');
      // Scroll to top of thread (newest first)
      waThreadRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setWaSending(false);
    }
  }

  /* ── Generate AI health brief ── */
  async function generateHealth() {
    setHlthLoading(true);
    setHlthError(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}/health-brief`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Failed to generate brief (${res.status})`);
      setHealth(body.data as CustomerHealthBrief);
    } catch (e) {
      setHlthError(e instanceof Error ? e.message : 'Failed to generate brief');
    } finally {
      setHlthLoading(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'activity' || tab === 'overview') loadActivities();
    if (tab === 'projects' || tab === 'finance' || tab === 'overview') loadSummary();
    if (tab === 'whatsapp') loadMessages();
  }

  /* ── Keyboard shortcut: N → focus activity composer ── */
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'n' && e.key !== 'N') return;
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      e.preventDefault();
      handleTabChange('activity');
      // defer focus so the tab renders first
      setTimeout(() => titleRef.current?.focus(), 60);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /* ── Quick follow-up from timeline ── */
  function startFollowUp(title: string) {
    handleTabChange('activity');
    setComposerType('follow_up');
    setComposerTitle(`Follow-up: ${title}`);
    setTimeout(() => titleRef.current?.focus(), 60);
  }

  /* ── Inline editing ── */
  const dirty = Object.keys(draft).length > 0;
  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function saveProps() {
    if (!dirty) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
      setDraft({});
      // If stage changed, reload activities to show the auto-logged entry
      if (draft.stage) {
        setActLoaded(false);
        if (activeTab === 'activity') loadActivities();
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!customer || notesDraft === (customer.notes ?? '')) return;
    setNotesSaving(true);
    setNotesErr(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  }

  /* ── Activity composer ── */
  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!composerTitle.trim()) return;
    setComposerSaving(true);
    setComposerErr(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: composerType, title: composerTitle.trim(), body: composerBody.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Failed to log activity');
      setActivities((prev) => [body.data, ...prev]);
      setComposerTitle('');
      setComposerBody('');
      // Update lastContactedAt locally for contact types
      const contactTypes = new Set(['call', 'whatsapp', 'note', 'meeting', 'site_visit']);
      if (contactTypes.has(composerType) && customer) {
        setCustomer({ ...customer, lastContactedAt: new Date().toISOString() });
      }
    } catch (e) {
      setComposerErr(e instanceof Error ? e.message : 'Failed to log activity');
    } finally {
      setComposerSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/customers';
  }

  /* ── Loading / not found states ── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--violet-primary)' }} />
      </div>
    );
  }
  if (notFound || !customer) {
    return (
      <div className="p-8">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)]">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <p className="mt-4 text-sm text-red-600">Customer not found.</p>
      </div>
    );
  }

  const displayed: Customer = { ...customer, ...(draft as Customer) };
  const stageSt = STAGE_STYLE[displayed.stage];
  const daysSinceContact = daysSince(customer.lastContactedAt);

  /* ── Render ── */
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--surface-page, #f8f9fb)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex flex-col"
        style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle, var(--border-subtle))' }}
      >
        {/* Main info row */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-4 pb-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/customers"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </Link>

            <Avatar name={displayed.fullName} size={52} />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
                  {displayed.fullName}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: stageSt.bg, color: stageSt.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageSt.dot }} />
                  {STAGE_LABEL[displayed.stage]}
                </span>
                {displayed.activeLeadId && displayed.activeLeadStage && (
                  <Link
                    href={`/leads/${displayed.activeLeadId}`}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.20)' }}
                    title="View lead"
                  >
                    <ChevronRight className="h-3 w-3" />
                    {LEAD_STAGE_LABEL[displayed.activeLeadStage] ?? displayed.activeLeadStage}
                  </Link>
                )}
              </div>
              {/* Contact meta row */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{displayed.phone}</span>
                {displayed.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{displayed.email}</span>}
                {displayed.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{displayed.company}</span>}
                {displayed.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{displayed.city}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Since {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {displayed.phone && (
              <a
                href={`https://wa.me/${displayed.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                style={{ background: '#25d366', color: '#fff' }}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
            {displayed.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${displayed.phone}`}><Phone className="h-4 w-4" /> Call</a>
              </Button>
            )}
            {displayed.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${displayed.email}`}><Mail className="h-4 w-4" /> Email</a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={remove}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="flex flex-wrap items-center gap-2 px-6 py-2.5"
          style={{ borderTop: '1px solid var(--border-subtle, var(--border-subtle))' }}
        >
          <button
            onClick={() => handleTabChange('projects')}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ background: 'rgba(99,102,241,0.09)', color: '#4f46e5' }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {summaryLoading && !summary ? '…' : `${summary?.projectCount ?? 0} project${(summary?.projectCount ?? 0) !== 1 ? 's' : ''}`}
          </button>

          {summary && summary.totalContractPaise > 0 && (
            <button
              onClick={() => handleTabChange('finance')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success-text)' }}
            >
              <IndianRupee className="h-3.5 w-3.5" />
              {formatRupees(summary.totalContractPaise)} contracted
            </button>
          )}

          {daysSinceContact !== null && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: daysSinceContact > 21 ? 'rgba(239,68,68,0.09)' : daysSinceContact > 7 ? 'rgba(245,158,11,0.09)' : 'rgba(100,116,139,0.09)',
                color: daysSinceContact > 21 ? 'var(--danger)' : daysSinceContact > 7 ? 'var(--warning-text)' : '#475569',
              }}
            >
              <Clock className="h-3.5 w-3.5" />
              {daysSinceContact === 0 ? 'Contacted today' : `Last contact ${daysSinceContact}d ago`}
            </span>
          )}

          {health && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: HEALTH_STATUS_META[health.status].bg, color: HEALTH_STATUS_META[health.status].color }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {HEALTH_STATUS_META[health.status].label}
            </span>
          )}
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 px-6 overflow-x-auto"
        style={{ background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-subtle, var(--border-subtle))' }}
      >
        {([
          { key: 'overview',  label: 'Overview'  },
          { key: 'activity',  label: 'Activity'  },
          { key: 'projects',  label: 'Projects'  },
          { key: 'finance',   label: 'Finance'   },
          { key: 'whatsapp',  label: 'WhatsApp'  },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className="relative flex-shrink-0 px-4 py-3.5 text-sm font-semibold transition-colors"
            style={{ color: activeTab === key ? 'var(--violet-primary, var(--accent-base))' : 'var(--text-secondary)' }}
          >
            {label}
            {activeTab === key && (
              <motion.span
                layoutId="detail-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: 'var(--violet-primary, var(--accent-base))' }}
                transition={{ type: 'spring', stiffness: 500, damping: 42 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">

            {/* Col 1: Contact details form */}
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Contact details
                  </h2>
                  {dirty && (
                    <button
                      onClick={saveProps}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--violet-primary)', color: '#fff' }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                  )}
                </div>
                <div className="space-y-3.5">
                  <InlineField label="Full name" icon={User}>
                    <Input value={displayed.fullName} onChange={(e) => set('fullName', e.target.value)} className="h-8 text-sm" />
                  </InlineField>
                  <InlineField label="Phone" icon={Phone}>
                    <Input value={displayed.phone} onChange={(e) => set('phone', e.target.value)} className="h-8 text-sm" />
                  </InlineField>
                  <InlineField label="Email" icon={Mail}>
                    <Input type="email" value={displayed.email ?? ''} onChange={(e) => set('email', (e.target.value || null) as Customer['email'])} placeholder="—" className="h-8 text-sm" />
                  </InlineField>
                  <InlineField label="Company" icon={Building2}>
                    <Input value={displayed.company ?? ''} onChange={(e) => set('company', (e.target.value || null) as Customer['company'])} placeholder="—" className="h-8 text-sm" />
                  </InlineField>
                  <InlineField label="City" icon={MapPin}>
                    <Input value={displayed.city ?? ''} onChange={(e) => set('city', (e.target.value || null) as Customer['city'])} placeholder="—" className="h-8 text-sm" />
                  </InlineField>
                  <InlineField label="Stage" icon={Tag}>
                    <Select value={displayed.stage} onValueChange={(v) => set('stage', v as CustomerStage)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </InlineField>
                  <InlineField label="Source" icon={Tag}>
                    <Select value={displayed.source} onValueChange={(v) => set('source', v as CustomerSource)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </InlineField>
                  <InlineField label="Tags" icon={Tag}>
                    <TagsChipEditor
                      tags={displayed.tags ?? []}
                      onChange={(tags) => set('tags', tags)}
                    />
                  </InlineField>
                  <InlineField label="Added" icon={Calendar}>
                    <p className="py-1 text-sm" style={{ color: 'var(--text-heading)' }}>
                      {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </InlineField>
                </div>
                {saveErr && <p className="mt-3 text-xs text-red-600">{saveErr}</p>}
              </div>
            </div>

            {/* Col 2: Notes + AI Health */}
            <div className="space-y-4">
              {/* Notes */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Notes</h2>
                  {notesDraft !== (customer.notes ?? '') && (
                    <button
                      onClick={saveNotes}
                      disabled={notesSaving}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--violet-primary)', color: '#fff' }}
                    >
                      {notesSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save notes
                    </button>
                  )}
                </div>
                <Textarea
                  rows={6}
                  placeholder="Log anything worth remembering — call summaries, preferences, follow-up plans…"
                  value={notesDraft}
                  onChange={(e) => { setNotesDraft(e.target.value); setNotesErr(null); }}
                  className="text-sm"
                />
                {notesErr && <p className="mt-1.5 text-xs text-red-600">{notesErr}</p>}
              </div>

              {/* AI Health Card */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
                    AI health brief
                  </h2>
                  <button
                    onClick={generateHealth}
                    disabled={healthLoading}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--violet-primary)', color: '#fff' }}
                  >
                    {healthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {healthLoading ? 'Generating…' : health ? 'Refresh' : 'Generate brief'}
                  </button>
                </div>

                {healthError && <p className="mb-2 text-xs text-red-600">{healthError}</p>}

                {health ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
                        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-subtle, var(--border-subtle))" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15" fill="none"
                            stroke={HEALTH_STATUS_META[health.status].color}
                            strokeWidth="3"
                            strokeDasharray={`${(health.healthScore / 100) * 94.2} 94.2`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                          {health.healthScore}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ background: HEALTH_STATUS_META[health.status].bg, color: HEALTH_STATUS_META[health.status].color }}
                        >
                          {HEALTH_STATUS_META[health.status].label}
                        </span>
                        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {health.summary}
                        </p>
                      </div>
                    </div>
                    {health.nudge && (
                      <div
                        className="flex items-start gap-2 rounded-xl p-3"
                        style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.15)' }}
                      >
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-base)' }} />
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-heading)' }}>{health.nudge}</p>
                      </div>
                    )}
                    {health.riskFlags && health.riskFlags.length > 0 && (
                      <div className="space-y-1.5">
                        {health.riskFlags.map((flag, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{flag}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : !healthLoading ? (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Generate an AI brief to get a health score, engagement summary, and suggested next action.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Col 3: Quick stats + Recent projects + Recent activity */}
            <div className="space-y-4">
              {/* 3 stat cards */}
              <div className="space-y-2.5">
                <SummaryCard
                  label="Projects"
                  value={summaryLoading && !summary ? '…' : (summary?.projectCount ?? 0)}
                  icon={<FolderOpen className="h-4 w-4" />}
                  color="#6366f1"
                  onClick={() => handleTabChange('projects')}
                />
                <SummaryCard
                  label="Contract value"
                  value={summaryLoading && !summary ? '…' : summary ? formatRupees(summary.totalContractPaise) : '₹0'}
                  icon={<IndianRupee className="h-4 w-4" />}
                  color="var(--success)"
                  onClick={() => handleTabChange('finance')}
                />
                <SummaryCard
                  label="Activities"
                  value={activitiesLoading && !activitiesLoaded ? '…' : activities.length}
                  icon={<Activity className="h-4 w-4" />}
                  color="var(--warning)"
                  onClick={() => handleTabChange('activity')}
                />
              </div>

              {/* Recent projects (top 2) */}
              {summary && summary.projects.length > 0 && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle, var(--border-subtle))' }}>
                    <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Recent projects
                    </h2>
                    <button
                      onClick={() => handleTabChange('projects')}
                      className="text-xs font-semibold transition-colors hover:opacity-70"
                      style={{ color: 'var(--violet-primary)' }}
                    >
                      View all →
                    </button>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {summary.projects.slice(0, 2).map((p) => {
                      const sc = LIFECYCLE_STAGE_COLOR[p.lifecycleStage] ?? { bg: 'rgba(100,116,139,0.10)', color: '#475569' };
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--surface-muted)]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                              {p.name || 'Untitled project'}
                            </p>
                            {p.siteAddress && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                <MapPin className="h-2.5 w-2.5 shrink-0" />{p.siteAddress}
                              </p>
                            )}
                          </div>
                          <span
                            className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: sc.bg, color: sc.color }}
                          >
                            {LIFECYCLE_LABEL[p.lifecycleStage] ?? p.lifecycleStage}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent activity (last 3) */}
              {activities.length > 0 && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle, var(--border-subtle))' }}>
                    <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Recent activity
                    </h2>
                    <button
                      onClick={() => handleTabChange('activity')}
                      className="text-xs font-semibold transition-colors hover:opacity-70"
                      style={{ color: 'var(--violet-primary)' }}
                    >
                      View all →
                    </button>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {activities.slice(0, 3).map((a) => {
                      const meta = ACTIVITY_META[a.type];
                      return (
                        <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                          <span
                            className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ background: `${meta.color}18`, color: meta.color }}
                          >
                            {meta.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium" style={{ color: 'var(--text-heading)' }}>{a.title}</p>
                            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                              {meta.label} · {relativeTime(a.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!summaryLoading && !activitiesLoading && (!summary || summary.projects.length === 0) && activities.length === 0 && (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{ background: 'var(--surface-card, #fff)', border: '1px dashed var(--border-subtle, var(--border-subtle))' }}
                >
                  <Users className="mx-auto mb-2 h-7 w-7" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No activity yet</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Log a call or create a project to get started.
                  </p>
                  <button
                    onClick={() => handleTabChange('activity')}
                    className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold transition-colors hover:opacity-90"
                    style={{ background: 'var(--violet-primary)', color: '#fff' }}
                  >
                    Log activity
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Activity tab ─────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
            {/* Left: Composer */}
            <div className="lg:col-span-1">
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Log activity
                </h2>
                <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                  N
                </span>
              </div>
              {/* Type pills */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {COMPOSER_TYPES.map((ct) => {
                  const meta = ACTIVITY_META[ct.type];
                  const active = composerType === ct.type;
                  return (
                    <button
                      key={ct.type}
                      onClick={() => setComposerType(ct.type)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                      style={{
                        background: active ? `${meta.color}18` : 'var(--surface-muted, var(--surface-muted))',
                        color: active ? meta.color : 'var(--text-secondary)',
                        border: active ? `1.5px solid ${meta.color}40` : '1.5px solid transparent',
                      }}
                    >
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      {ct.label}
                    </button>
                  );
                })}
              </div>
              <form onSubmit={submitActivity} className="space-y-2.5">
                <input
                  ref={titleRef}
                  value={composerTitle}
                  onChange={(e) => setComposerTitle(e.target.value)}
                  placeholder={`${ACTIVITY_META[composerType].label} summary…`}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow"
                  style={{
                    background: 'var(--surface-muted, var(--surface-muted))',
                    border: '1.5px solid transparent',
                    color: 'var(--text-heading)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--violet-primary, var(--accent-base))')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                />
                <Textarea
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder="Details (optional)…"
                  rows={2}
                  className="text-sm"
                />
                {composerErr && <p className="text-xs text-red-600">{composerErr}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={composerSaving || !composerTitle.trim()}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-40"
                    style={{ background: 'var(--violet-primary)', color: '#fff' }}
                  >
                    {composerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {composerSaving ? 'Saving…' : `Log ${ACTIVITY_META[composerType].label.toLowerCase()}`}
                  </button>
                </div>
              </form>
            </div>
            </div>{/* end left composer col */}

            {/* Right: Timeline */}
            <div className="lg:col-span-2">
            {activitiesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--violet-primary)' }} />
              </div>
            ) : activities.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{ background: 'var(--surface-card, #fff)', border: '1px dashed var(--border-subtle, var(--border-subtle))' }}
              >
                <StickyNote className="mx-auto mb-3 h-8 w-8" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No activities yet</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Log a call, note, or WhatsApp message above.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupByDate(activities).map((group, gIdx) => (
                  <div key={group.label}>
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((a, aIdx) => {
                        const meta = ACTIVITY_META[a.type];
                        const isLatest = gIdx === 0 && aIdx === 0;
                        return (
                          <div
                            key={a.id}
                            className="group flex gap-3 rounded-xl p-3.5 transition-shadow hover:shadow-sm"
                            style={{
                              background: 'var(--surface-card, #fff)',
                              border: '1px solid var(--border-subtle, var(--border-subtle))',
                              borderLeft: `3px solid ${meta.color}`,
                            }}
                          >
                            {/* Icon with pulse on latest */}
                            <span className="relative mt-0.5 flex-shrink-0">
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-full"
                                style={{ background: `${meta.color}18`, color: meta.color }}
                              >
                                {meta.icon}
                              </span>
                              {isLatest && (
                                <span
                                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white animate-pulse"
                                  style={{ background: meta.color }}
                                />
                              )}
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{a.title}</p>
                                <span className="flex-shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                  {relativeTime(a.createdAt)}
                                </span>
                              </div>
                              {a.body && (
                                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.body}</p>
                              )}
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                  {meta.label}
                                </span>
                                {/* Follow-up quick action */}
                                {a.type !== 'follow_up' && a.type !== 'stage_change' && (
                                  <button
                                    onClick={() => startFollowUp(a.title)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ background: 'rgba(124,92,252,0.08)', color: 'var(--violet-primary)' }}
                                  >
                                    <Bell className="h-2.5 w-2.5" />
                                    Follow-up
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>{/* end right timeline col */}
          </div>
        )}

        {/* ── Projects tab ─────────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <div className="p-6 space-y-4">
            {summaryLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--violet-primary)' }} />
              </div>
            ) : !summary || (summary.projects.length === 0 && summary.leads.length === 0) ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{ background: 'var(--surface-card, #fff)', border: '1px dashed var(--border-subtle, var(--border-subtle))' }}
              >
                <FolderOpen className="mx-auto mb-3 h-8 w-8" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No linked projects</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Projects linked to this customer will appear here.
                </p>
                <Link
                  href="/projects/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-colors"
                  style={{ background: 'var(--violet-primary)', color: '#fff' }}
                >
                  <Plus className="h-4 w-4" />
                  Create project
                </Link>
              </div>
            ) : (
              <>
                {/* Stats strip */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: 'rgba(99,102,241,0.09)', color: '#4f46e5' }}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {summary.projectCount} project{summary.projectCount !== 1 ? 's' : ''}
                  </span>
                  {summary.totalContractPaise > 0 && (
                    <span
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success-text)' }}
                    >
                      <IndianRupee className="h-3.5 w-3.5" />
                      {formatRupees(summary.totalContractPaise)} contracted
                    </span>
                  )}
                  {summary.leads.length > 0 && (
                    <span
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--warning-text)' }}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {summary.leads.length} active {summary.leads.length !== 1 ? 'enquiries' : 'enquiry'}
                    </span>
                  )}
                </div>

                {summary.projects.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {summary.projects.map((p) => {
                        const sc = LIFECYCLE_STAGE_COLOR[p.lifecycleStage] ?? { bg: 'rgba(100,116,139,0.10)', color: '#475569' };
                        return (
                          <Link
                            key={p.id}
                            href={`/projects/${p.id}`}
                            className="block rounded-xl p-4 transition-colors hover:bg-[var(--surface-muted)]"
                            style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                                  {p.name || 'Untitled project'}
                                </p>
                                {p.siteAddress && (
                                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {p.siteAddress}
                                  </p>
                                )}
                                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ background: sc.bg, color: sc.color }}
                                >
                                  {LIFECYCLE_LABEL[p.lifecycleStage] ?? p.lifecycleStage}
                                </span>
                                {p.totalContractPaise != null && (
                                  <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                    {formatRupees(p.totalContractPaise)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}

                {summary.leads.length > 0 && (
                  <div className={summary.projects.length > 0 ? 'mt-6' : ''}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Active enquiries
                    </p>
                    <div className="space-y-2">
                      {summary.leads.map((l) => (
                        <Link
                          key={l.id}
                          href={`/leads/${l.id}`}
                          className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-[var(--surface-muted)]"
                          style={{ background: 'var(--surface-muted, #f8f9fc)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                              {l.projectName || 'New enquiry'}
                            </p>
                            {l.projectLocation && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <MapPin className="h-3 w-3 shrink-0" />
                                {l.projectLocation}
                              </p>
                            )}
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning-text)' }}
                            >
                              {LEAD_STAGE_LABEL[l.stage] ?? l.stage}
                            </span>
                            <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Finance tab ──────────────────────────────────────────────── */}
        {activeTab === 'finance' && (
          <div className="p-6 space-y-5">
            {summaryLoading && !summary ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--violet-primary)' }} />
              </div>
            ) : (
              <>
                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}
                    >
                      <IndianRupee className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                      {summary ? formatRupees(summary.totalContractPaise) : '₹0'}
                    </p>
                    <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Total contracted
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
                    >
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                      {summary?.projectCount ?? 0}
                    </p>
                    <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {(summary?.projectCount ?? 0) === 1 ? 'Project' : 'Projects'}
                    </p>
                  </div>
                </div>

                {/* Per-project breakdown */}
                {summary && summary.projects.length > 0 && (
                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                  >
                    <div
                      className="px-5 py-3.5"
                      style={{ borderBottom: '1px solid var(--border-subtle, var(--border-subtle))' }}
                    >
                      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Project breakdown
                      </h2>
                    </div>
                    <div>
                      {summary.projects.map((p, idx) => {
                        const sc = LIFECYCLE_STAGE_COLOR[p.lifecycleStage] ?? { bg: 'rgba(100,116,139,0.10)', color: '#475569' };
                        const progress = LIFECYCLE_PROGRESS[p.lifecycleStage] ?? 0;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]"
                            style={idx > 0 ? { borderTop: '1px solid var(--border-subtle, var(--border-subtle))' } : undefined}
                          >
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/projects/${p.id}`}
                                className="text-sm font-semibold transition-colors hover:underline"
                                style={{ color: 'var(--text-heading)' }}
                              >
                                {p.name || 'Untitled project'}
                              </Link>
                              {p.siteAddress && (
                                <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  <MapPin className="h-3 w-3 shrink-0" />{p.siteAddress}
                                </p>
                              )}
                              {/* Progress bar */}
                              <div className="mt-2.5 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border-subtle, var(--border-subtle))' }}>
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${progress}%`, background: sc.color }}
                                  />
                                </div>
                                <span className="shrink-0 text-[10px] font-medium" style={{ color: sc.color }}>
                                  {progress}%
                                </span>
                              </div>
                            </div>
                            <div className="ml-5 shrink-0 text-right">
                              {p.totalContractPaise != null ? (
                                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                  {formatRupees(p.totalContractPaise)}
                                </p>
                              ) : (
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</p>
                              )}
                              <span
                                className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{ background: sc.bg, color: sc.color }}
                              >
                                {LIFECYCLE_LABEL[p.lifecycleStage] ?? p.lifecycleStage}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Info note */}
                <div
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
                >
                  <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: '#6366f1' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: '#4f46e5' }}>
                      Payment history &amp; invoices
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Invoices, payment milestones, receipts and outstanding balances are tracked inside each project&apos;s Finance section.
                    </p>
                    {summary && summary.projects.length > 0 && (
                      <Link
                        href={`/projects/${summary.projects[0].id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                        style={{ color: '#4f46e5' }}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Open project finance →
                      </Link>
                    )}
                  </div>
                </div>

                {!summary && (
                  <div
                    className="rounded-2xl p-10 text-center"
                    style={{ background: 'var(--surface-card, #fff)', border: '1px dashed var(--border-subtle, var(--border-subtle))' }}
                  >
                    <IndianRupee className="mx-auto mb-3 h-8 w-8" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No financial data yet</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Projects with contract values will appear here once created.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* ── WhatsApp tab ─────────────────────────────────────────────── */}
        {activeTab === 'whatsapp' && (
          <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">

            {/* Left: Info card + compose */}
            <div className="flex flex-col gap-4 lg:col-span-1">
              {/* Info card */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366' }}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>WhatsApp thread</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{customer.phone}</p>
                  </div>
                </div>
                {messagesLoaded && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Messages</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{messages.length}</span>
                    </div>
                    {messages.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Last message</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{relativeTime(messages[0].createdAt)}</span>
                      </div>
                    )}
                  </div>
                )}
                {customer.phone && (
                  <a
                    href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:opacity-90"
                    style={{ background: '#25d366', color: '#fff' }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Open in WhatsApp
                  </a>
                )}
              </div>

              {/* Compose bar */}
              {customer.phone && (
                <form
                  onSubmit={sendWaMessage}
                  className="flex flex-col gap-2 rounded-2xl p-4"
                  style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Send message</p>
                  <Textarea
                    value={waDraft}
                    onChange={(e) => setWaDraft(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendWaMessage(e as unknown as React.FormEvent); }
                    }}
                    placeholder="Type a message… (Enter to send)"
                    rows={4}
                    disabled={waSending}
                    className="resize-none text-sm"
                    style={{ color: 'var(--text-heading)' }}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!waDraft.trim() || waSending}
                      className="gap-1.5"
                      style={{ background: '#25d366', color: '#fff' }}
                    >
                      {waSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {waSending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                  {waError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{waError}</p>}
                </form>
              )}
            </div>

            {/* Right: Thread */}
            <div className="lg:col-span-2">
              <div
                ref={waThreadRef}
                className="h-full min-h-[400px] overflow-y-auto rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(240,242,245,0.6)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
              >
                {messagesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--violet-primary)' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl" style={{ background: 'var(--surface-card, #fff)' }}>
                    <MessageCircle className="mb-3 h-10 w-10" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>No messages yet</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Messages will appear here once sent or received.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className="max-w-[70%] px-4 py-2.5 shadow-sm"
                          style={{
                            background: isInbound ? '#fff' : 'rgba(124,92,252,0.12)',
                            border: isInbound ? '1px solid var(--border-subtle, var(--border-subtle))' : '1px solid rgba(124,92,252,0.22)',
                            borderRadius: isInbound ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                          }}
                        >
                          {msg.templateName && (
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                              {msg.templateName}
                            </p>
                          )}
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)' }}>
                            {msg.bodyPreview ?? '(no preview)'}
                          </p>
                          <p className="mt-1.5 text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {relativeTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function InlineField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {children}
    </div>
  );
}

/* ── TagsChipEditor ──────────────────────────────────────────────────────── */

const TAG_COLORS = [
  'var(--accent-base)', 'var(--accent-base)', 'var(--success)', 'var(--warning)',
  'var(--danger)', '#ec4899', '#06b6d4', 'var(--accent-base)',
];

function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

function TagsChipEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');

  function addTag(raw: string) {
    const val = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    if (!val || tags.includes(val) || tags.length >= 20) return;
    onChange([...tags, val]);
    setInput('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-xl border p-2 min-h-[36px] cursor-text"
      style={{ background: 'var(--surface-muted, var(--surface-muted))', border: '1.5px solid transparent' }}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: tagColor(tag) }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="opacity-70 hover:opacity-100 transition-opacity"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
        className="flex-1 min-w-[80px] bg-transparent text-xs outline-none"
        style={{ color: 'var(--text-heading)' }}
      />
    </div>
  );
}

function SummaryCard({
  label, value, icon, color, onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl p-4 text-left transition-all hover:shadow-md"
      style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--border-subtle, var(--border-subtle))' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </span>
        <div>
          <p className="text-base font-bold leading-none" style={{ color: 'var(--text-heading)' }}>{value}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        </div>
        <ChevronRight
          className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--text-secondary)' }}
        />
      </div>
    </button>
  );
}
