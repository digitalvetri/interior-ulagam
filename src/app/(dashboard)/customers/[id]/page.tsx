'use client';

import { use, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Tag, User, Calendar,
  Trash2, Save, Loader2, MessageCircle, StickyNote, Users,
  FolderOpen, Bell, Plus, Send, CreditCard, X,
  ChevronRight, IndianRupee, Clock, ArrowRightCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STAGE_LABEL } from '@/types/customers';
import type { Customer, CustomerActivity, CustomerActivityType, CustomerSource, CustomerStage, CustomerSummary } from '@/types/customers';

/* ── Constants ──────────────────────────────────────────────────────────────── */

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
  lead:        { bg: 'rgba(100,116,139,0.10)', color: '#475569',              dot: '#94a3b8'              },
  opportunity: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning-text)',  dot: 'var(--warning)'      },
  client:      { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)',  dot: 'var(--success)'      },
  past_client: { bg: 'rgba(148,163,184,0.12)', color: '#64748b',             dot: '#cbd5e1'             },
};

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead: 'Lead', opportunity: 'Opportunity', client: 'Client', past_client: 'Past client',
};

const ACTIVITY_META: Record<CustomerActivityType, { label: string; color: string; icon: React.ReactNode }> = {
  note:             { label: 'Note',             color: 'var(--warning)',      icon: <StickyNote        className="h-3.5 w-3.5" /> },
  call:             { label: 'Call',             color: 'var(--accent-base)', icon: <Phone             className="h-3.5 w-3.5" /> },
  whatsapp:         { label: 'WhatsApp',         color: '#25d366',            icon: <MessageCircle     className="h-3.5 w-3.5" /> },
  meeting:          { label: 'Meeting',          color: 'var(--accent-base)', icon: <Users             className="h-3.5 w-3.5" /> },
  site_visit:       { label: 'Site visit',       color: 'var(--warning)',      icon: <MapPin            className="h-3.5 w-3.5" /> },
  stage_change:     { label: 'Stage changed',    color: '#64748b',            icon: <ArrowRightCircle  className="h-3.5 w-3.5" /> },
  project_created:  { label: 'Project created',  color: '#6366f1',            icon: <FolderOpen        className="h-3.5 w-3.5" /> },
  payment_received: { label: 'Payment received', color: '#14b8a6',            icon: <CreditCard        className="h-3.5 w-3.5" /> },
  quote_sent:       { label: 'Quote sent',       color: '#f97316',            icon: <Send              className="h-3.5 w-3.5" /> },
  follow_up:        { label: 'Follow-up',        color: '#ec4899',            icon: <Bell              className="h-3.5 w-3.5" /> },
};

const COMPOSER_TYPES: { type: CustomerActivityType; label: string }[] = [
  { type: 'note',      label: 'Note'      },
  { type: 'call',      label: 'Call'      },
  { type: 'whatsapp',  label: 'WhatsApp'  },
  { type: 'meeting',   label: 'Meeting'   },
  { type: 'follow_up', label: 'Follow-up' },
];

const LIFECYCLE_LABEL: Record<string, string> = {
  design_pending:     'Design pending',
  design_in_progress: 'Design in progress',
  design_approved:    'Design approved',
  procurement:        'Procurement',
  execution:          'Execution',
  snagging:           'Snagging',
  handover:           'Handover',
  complete:           'Complete',
};

const LIFECYCLE_STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  design_pending:     { bg: 'rgba(100,116,139,0.10)', color: '#475569'              },
  design_in_progress: { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5'              },
  design_approved:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)'  },
  procurement:        { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning-text)'  },
  execution:          { bg: 'rgba(59,130,246,0.12)',  color: 'var(--accent-text)'   },
  snagging:           { bg: 'rgba(249,115,22,0.12)',  color: '#c2410c'              },
  handover:           { bg: 'rgba(168,85,247,0.12)',  color: '#7e22ce'              },
  complete:           { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success-text)'  },
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

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

/* ── Page ───────────────────────────────────────────────────────────────────── */

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

  const [activities, setActivities]       = useState<CustomerActivity[]>([]);
  const [activitiesLoading, setActLoading] = useState(false);

  const [composerType, setComposerType]     = useState<CustomerActivityType>('note');
  const [composerTitle, setComposerTitle]   = useState('');
  const [composerBody, setComposerBody]     = useState('');
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerErr, setComposerErr]       = useState<string | null>(null);

  const [summary, setSummary]         = useState<CustomerSummary | null>(null);
  const [summaryLoading, setSumLoading] = useState(false);

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

  /* ── Eagerly load summary + activities ── */
  useEffect(() => {
    setSumLoading(true);
    fetch(`/api/v1/customers/${id}/summary`)
      .then((r) => r.json())
      .then(({ data }) => setSummary(data as CustomerSummary))
      .catch(() => {})
      .finally(() => setSumLoading(false));
  }, [id]);

  useEffect(() => {
    setActLoading(true);
    fetch(`/api/v1/customers/${id}/activities`)
      .then((r) => r.json())
      .then(({ data }) => setActivities(data ?? []))
      .catch(() => {})
      .finally(() => setActLoading(false));
  }, [id]);

  /* ── Inline edit ── */
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
      if (!res.ok) throw new Error((body as { error?: string })?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
      setDraft({});
      if (draft.stage) {
        fetch(`/api/v1/customers/${id}/activities`)
          .then((r) => r.json())
          .then(({ data }) => setActivities(data ?? []))
          .catch(() => {});
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
      if (!res.ok) throw new Error((body as { error?: string })?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  }

  /* ── Log activity ── */
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
      if (!res.ok) throw new Error((body as { error?: string })?.error ?? 'Failed to log activity');
      setActivities((prev) => [body.data as CustomerActivity, ...prev]);
      setComposerTitle('');
      setComposerBody('');
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
    if (!confirm('Delete this client? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/customers';
  }

  /* ── Loading / not found ── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-base)' }} />
      </div>
    );
  }
  if (notFound || !customer) {
    return (
      <div className="p-8">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
        <p className="mt-4 text-sm text-red-600">Client not found.</p>
      </div>
    );
  }

  const displayed: Customer = { ...customer, ...(draft as Customer) };
  const stageSt = STAGE_STYLE[displayed.stage];
  const daysSinceContact = daysSince(customer.lastContactedAt);

  /* ── Render ── */
  return (
    <div className="space-y-5">

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">

          {/* Back + name + contact meta */}
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/customers"
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
              aria-label="Back to clients"
            >
              <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </Link>

            <div className="min-w-0">
              {/* Name + badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.125rem] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
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
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-75"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.20)' }}
                  >
                    <ChevronRight className="h-3 w-3" />
                    {LEAD_STAGE_LABEL[displayed.activeLeadStage] ?? displayed.activeLeadStage}
                  </Link>
                )}
              </div>

              {/* Contact meta */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />{displayed.phone}
                </span>
                {displayed.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />{displayed.email}
                  </span>
                )}
                {displayed.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{displayed.city}
                  </span>
                )}
                {displayed.company && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />{displayed.company}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {displayed.phone && (
              <a
                href={`https://wa.me/${displayed.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-85"
                style={{ background: '#25d366', color: '#fff' }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {displayed.phone && (
              <a
                href={`tel:${displayed.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}
            {displayed.email && (
              <a
                href={`mailto:${displayed.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-muted)]"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
            <button
              onClick={remove}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:border-red-200 hover:bg-red-50"
              style={{ color: '#dc2626', borderColor: 'var(--border-subtle)' }}
              title="Delete client"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ── Left column: details + notes ───────────────────────────────── */}
        <div className="space-y-5 lg:col-span-1">

          {/* Client details */}
          <section
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Client details
              </h2>
              {dirty && (
                <button
                  onClick={saveProps}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ background: 'var(--accent-base)', color: '#fff' }}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              )}
            </div>

            <div className="space-y-3.5">
              <InlineField label="Full name" icon={User}>
                <Input
                  value={displayed.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  className="h-8 text-sm"
                />
              </InlineField>
              <InlineField label="Mobile" icon={Phone}>
                <Input
                  value={displayed.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="h-8 text-sm"
                />
              </InlineField>
              <InlineField label="Email" icon={Mail}>
                <Input
                  type="email"
                  value={displayed.email ?? ''}
                  onChange={(e) => set('email', (e.target.value || null) as Customer['email'])}
                  placeholder="—"
                  className="h-8 text-sm"
                />
              </InlineField>
              <InlineField label="City" icon={MapPin}>
                <Input
                  value={displayed.city ?? ''}
                  onChange={(e) => set('city', (e.target.value || null) as Customer['city'])}
                  placeholder="—"
                  className="h-8 text-sm"
                />
              </InlineField>
              <InlineField label="Company" icon={Building2}>
                <Input
                  value={displayed.company ?? ''}
                  onChange={(e) => set('company', (e.target.value || null) as Customer['company'])}
                  placeholder="—"
                  className="h-8 text-sm"
                />
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
          </section>

          {/* Notes */}
          <section
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Notes</h2>
              {notesDraft !== (customer.notes ?? '') && (
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ background: 'var(--accent-base)', color: '#fff' }}
                >
                  {notesSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              )}
            </div>
            <Textarea
              rows={6}
              placeholder="Preferences, call summaries, follow-up plans…"
              value={notesDraft}
              onChange={(e) => { setNotesDraft(e.target.value); setNotesErr(null); }}
              className="text-sm"
            />
            {notesErr && <p className="mt-1.5 text-xs text-red-600">{notesErr}</p>}
          </section>

        </div>

        {/* ── Right column: summary + projects + activity ─────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Business summary strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(99,102,241,0.09)', color: '#4f46e5' }}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {summaryLoading && !summary
                ? '…'
                : `${summary?.projectCount ?? 0} project${(summary?.projectCount ?? 0) !== 1 ? 's' : ''}`}
            </span>

            {summary && summary.totalContractPaise > 0 && (
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success-text)' }}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                {formatRupees(summary.totalContractPaise)} contracted
              </span>
            )}

            {daysSinceContact !== null && (
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: daysSinceContact > 21
                    ? 'rgba(239,68,68,0.09)'
                    : daysSinceContact > 7
                    ? 'rgba(245,158,11,0.09)'
                    : 'rgba(100,116,139,0.09)',
                  color: daysSinceContact > 21
                    ? 'var(--danger)'
                    : daysSinceContact > 7
                    ? 'var(--warning-text)'
                    : '#475569',
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                {daysSinceContact === 0 ? 'Contacted today' : `Last contact ${daysSinceContact}d ago`}
              </span>
            )}
          </div>

          {/* Projects */}
          <section
            className="overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Projects
              </h2>
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent-base)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </Link>
            </div>

            {summaryLoading && !summary ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-secondary)' }} />
              </div>
            ) : !summary || (summary.projects.length === 0 && summary.leads.length === 0) ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FolderOpen className="h-8 w-8" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No projects yet</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Projects linked to this client will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Project rows */}
                {summary.projects.length > 0 && (
                  <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {summary.projects.slice(0, 5).map((p) => {
                      const sc = LIFECYCLE_STAGE_COLOR[p.lifecycleStage] ?? { bg: 'rgba(100,116,139,0.10)', color: '#475569' };
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
                              {p.name || 'Untitled project'}
                            </p>
                            {p.siteAddress && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <MapPin className="h-2.5 w-2.5 shrink-0" />{p.siteAddress}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-3">
                            {p.totalContractPaise != null && (
                              <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                {formatRupees(p.totalContractPaise)}
                              </span>
                            )}
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                              style={{ background: sc.bg, color: sc.color }}
                            >
                              {LIFECYCLE_LABEL[p.lifecycleStage] ?? p.lifecycleStage}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {summary.projects.length > 5 && (
                  <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Link
                      href="/projects"
                      className="text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent-base)' }}
                    >
                      View all {summary.projects.length} projects →
                    </Link>
                  </div>
                )}

                {/* Active enquiries (leads) */}
                {summary.leads.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p
                      className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Active enquiries
                    </p>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {summary.leads.map((l) => (
                        <Link
                          key={l.id}
                          href={`/leads/${l.id}`}
                          className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[var(--surface-muted)]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
                              {l.projectName || 'New enquiry'}
                            </p>
                            {l.projectLocation && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <MapPin className="h-2.5 w-2.5 shrink-0" />{l.projectLocation}
                              </p>
                            )}
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
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
          </section>

          {/* Log activity */}
          <section
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Log activity
            </h2>

            {/* Type pills */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {COMPOSER_TYPES.map((ct) => {
                const meta = ACTIVITY_META[ct.type];
                const active = composerType === ct.type;
                return (
                  <button
                    key={ct.type}
                    type="button"
                    onClick={() => setComposerType(ct.type)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                    style={{
                      background: active ? `${meta.color}18` : 'var(--surface-muted)',
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
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1.5px solid transparent',
                  color: 'var(--text-heading)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-base)')}
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
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
                  style={{ background: 'var(--accent-base)', color: '#fff' }}
                >
                  {composerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {composerSaving ? 'Saving…' : `Log ${ACTIVITY_META[composerType].label.toLowerCase()}`}
                </button>
              </div>
            </form>
          </section>

          {/* Recent activity */}
          <section
            className="overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Recent activity
              </h2>
            </div>

            {activitiesLoading && activities.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-secondary)' }} />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <StickyNote className="h-7 w-7" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  No activity yet — log the first interaction above.
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {activities.slice(0, 8).map((a) => {
                  const meta = ACTIVITY_META[a.type];
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                      <span
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
                            {a.title}
                          </p>
                          <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {relativeTime(a.createdAt)}
                          </span>
                        </div>
                        {a.body && (
                          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {a.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {meta.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

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
      <Label
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {children}
    </div>
  );
}

/* ── TagsChipEditor ─────────────────────────────────────────────────────────── */

const TAG_COLORS = [
  'var(--accent-base)', 'var(--success)', 'var(--warning)',
  'var(--danger)', '#ec4899', '#06b6d4',
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
      className="flex min-h-[36px] cursor-text flex-wrap gap-1.5 rounded-xl p-2"
      style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent' }}
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
            className="opacity-70 transition-opacity hover:opacity-100"
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
        className="min-w-[80px] flex-1 bg-transparent text-xs outline-none"
        style={{ color: 'var(--text-heading)' }}
      />
    </div>
  );
}
