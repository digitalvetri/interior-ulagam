'use client';

import { use, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Tag, User,
  Trash2, Save, Loader2, MessageCircle, StickyNote, Users,
  FolderOpen, Bell, Plus, Send, CreditCard, X, FileText,
  ChevronRight, ArrowRightCircle,
  Pencil, Activity, LayoutGrid, Heart, TrendingUp, Wallet,
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
  lead:        { bg: 'rgba(100,116,139,0.12)', color: '#475569', dot: '#94a3b8' },
  opportunity: { bg: 'rgba(245,158,11,0.14)',  color: '#b45309', dot: '#f59e0b' },
  client:      { bg: 'rgba(16,185,129,0.14)',  color: '#065f46', dot: '#10b981' },
  past_client: { bg: 'rgba(148,163,184,0.14)', color: '#64748b', dot: '#cbd5e1' },
};

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead: 'Lead', opportunity: 'Opportunity', client: 'Client', past_client: 'Past client',
};

const HEALTH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  hot:      { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'Hot'      },
  healthy:  { bg: 'rgba(16,185,129,0.12)',  color: '#059669', label: 'Healthy'  },
  at_risk:  { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', label: 'At risk'  },
  inactive: { bg: 'rgba(100,116,139,0.12)', color: '#475569', label: 'Inactive' },
};

const ACTIVITY_META: Record<CustomerActivityType, { label: string; color: string; icon: React.ReactNode }> = {
  note:             { label: 'Note',             color: '#f59e0b',            icon: <StickyNote       className="h-3.5 w-3.5" /> },
  call:             { label: 'Call',             color: 'var(--accent-base)', icon: <Phone            className="h-3.5 w-3.5" /> },
  whatsapp:         { label: 'WhatsApp',         color: '#25d366',            icon: <MessageCircle    className="h-3.5 w-3.5" /> },
  meeting:          { label: 'Meeting',          color: 'var(--accent-base)', icon: <Users            className="h-3.5 w-3.5" /> },
  site_visit:       { label: 'Site visit',       color: '#f59e0b',            icon: <MapPin           className="h-3.5 w-3.5" /> },
  stage_change:     { label: 'Stage changed',    color: '#64748b',            icon: <ArrowRightCircle className="h-3.5 w-3.5" /> },
  project_created:  { label: 'Project created',  color: '#6366f1',            icon: <FolderOpen       className="h-3.5 w-3.5" /> },
  payment_received: { label: 'Payment received', color: '#14b8a6',            icon: <CreditCard       className="h-3.5 w-3.5" /> },
  quote_sent:       { label: 'Quote sent',       color: '#f97316',            icon: <Send             className="h-3.5 w-3.5" /> },
  follow_up:        { label: 'Follow-up',        color: '#ec4899',            icon: <Bell             className="h-3.5 w-3.5" /> },
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
  design_pending:     { bg: 'rgba(100,116,139,0.10)', color: '#475569' },
  design_in_progress: { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5' },
  design_approved:    { bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
  procurement:        { bg: 'rgba(245,158,11,0.12)',  color: '#b45309' },
  execution:          { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb' },
  snagging:           { bg: 'rgba(249,115,22,0.12)',  color: '#c2410c' },
  handover:           { bg: 'rgba(168,85,247,0.12)',  color: '#7e22ce' },
  complete:           { bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
};

type Tab = 'overview' | 'ledger' | 'activity';

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


function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatRupeesShort(paise: number): string {
  const amt = paise / 100;
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
  if (amt >= 100000)   return `₹${(amt / 100000).toFixed(1)}L`;
  if (amt >= 1000)     return `₹${(amt / 1000).toFixed(0)}K`;
  return `₹${amt.toLocaleString('en-IN')}`;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#3b82f6', '#10b981', '#f97316',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft]       = useState<Partial<Customer>>({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  const [notesDraft, setNotesDraft]   = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesErr, setNotesErr]       = useState<string | null>(null);

  const [activities, setActivities]        = useState<CustomerActivity[]>([]);
  const [activitiesLoading, setActLoading] = useState(false);
  const [activityPage, setActivityPage]    = useState(1);
  const ACTIVITY_PAGE_SIZE = 10;

  const [composerType, setComposerType]     = useState<CustomerActivityType>('note');
  const [composerTitle, setComposerTitle]   = useState('');
  const [composerBody, setComposerBody]     = useState('');
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerErr, setComposerErr]       = useState<string | null>(null);

  const [summary, setSummary]          = useState<CustomerSummary | null>(null);
  const [summaryLoading, setSumLoading] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');

  const titleRef = useRef<HTMLInputElement>(null);

  /* ── Load ── */
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

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ── Edit ── */
  const dirty = Object.keys(draft).length > 0;

  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function cancelEdit() {
    setDraft({});
    setSaveErr(null);
    setEditMode(false);
  }

  async function saveProps() {
    if (!dirty) { setEditMode(false); return; }
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
      setEditMode(false);
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

  /* ── Activity ── */
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
      <div className="px-8 py-8">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
        <p className="mt-4 text-sm text-red-600">Client not found.</p>
      </div>
    );
  }

  const displayed: Customer = { ...customer, ...(draft as Customer) };
  const stageSt = STAGE_STYLE[displayed.stage];
  const avatarBg = avatarColor(displayed.fullName);
  const healthSt = customer.healthStatus ? HEALTH_STYLE[customer.healthStatus] : null;

  const totalContractPaise  = summary?.totalContractPaise  ?? 0;
  const totalInvoicedPaise  = summary?.totalInvoicedPaise  ?? 0;
  const totalReceivedPaise  = summary?.totalReceivedPaise  ?? 0;
  const outstandingPaise    = Math.max(0, totalInvoicedPaise - totalReceivedPaise);
  const collectedPct        = totalInvoicedPaise > 0 ? Math.round((totalReceivedPaise / totalInvoicedPaise) * 100) : 0;

  // Build ledger: interleave invoices (debit) + payments (credit) sorted by date
  type LedgerRow =
    | { kind: 'invoice'; date: string; number: string; particulars: string; debitPaise: number; creditPaise: 0 }
    | { kind: 'payment'; date: string; number: string; particulars: string; debitPaise: 0;    creditPaise: number };

  const ledgerRows: LedgerRow[] = [
    ...(summary?.invoices ?? []).map(inv => ({
      kind: 'invoice' as const,
      date: inv.invoiceDate,
      number: inv.invoiceNumber,
      particulars: summary?.projects.find(p => p.id === inv.projectId)?.name ?? 'Invoice',
      debitPaise: inv.totalPaise,
      creditPaise: 0 as const,
    })),
    ...(summary?.payments ?? []).map(pay => {
      const inv = summary?.invoices.find(i => i.id === pay.invoiceId);
      return {
        kind: 'payment' as const,
        date: pay.createdAt.slice(0, 10),
        number: `PAY-${pay.id.slice(0, 8).toUpperCase()}`,
        particulars: inv ? `Against ${inv.invoiceNumber}` : 'Payment received',
        debitPaise: 0 as const,
        creditPaise: pay.amountPaise,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Running balance for ledger
  let runningBalance = 0;
  const ledgerWithBalance = ledgerRows.map(row => {
    runningBalance += row.debitPaise - row.creditPaise;
    return { ...row, balancePaise: runningBalance };
  });

  const visibleActivities = activities.slice(0, activityPage * ACTIVITY_PAGE_SIZE);
  const hasMoreActivities = activities.length > activityPage * ACTIVITY_PAGE_SIZE;

  /* ── Render ── */
  return (
    <div className="min-h-full" style={{ background: 'var(--surface-bg)' }}>
      <div className="px-8 py-6">

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/customers"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All clients
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Avatar + identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white text-[15px] font-bold shadow-sm"
                style={{ background: avatarBg }}
              >
                {initials(displayed.fullName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[18px] font-bold leading-tight truncate" style={{ color: 'var(--text-heading)' }}>
                    {displayed.fullName}
                  </h1>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                    style={{ background: stageSt.bg, color: stageSt.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: stageSt.dot }} />
                    {STAGE_LABEL[displayed.stage]}
                  </span>
                  {healthSt && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                      style={{ background: healthSt.bg, color: healthSt.color }}
                    >
                      <Heart className="h-3 w-3" />
                      {healthSt.label}
                      {customer.healthScore != null && <span className="opacity-70">· {customer.healthScore}</span>}
                    </span>
                  )}
                  {displayed.activeLeadId && displayed.activeLeadStage && (
                    <Link
                      href={`/leads/${displayed.activeLeadId}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold hover:opacity-75 transition-opacity"
                      style={{ background: 'rgba(99,102,241,0.10)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.20)' }}
                    >
                      <ChevronRight className="h-3 w-3" />
                      {LEAD_STAGE_LABEL[displayed.activeLeadStage] ?? displayed.activeLeadStage}
                    </Link>
                  )}
                </div>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Added {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {displayed.company && <> · {displayed.company}</>}
                  {displayed.city && <> · {displayed.city}</>}
                </p>
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={remove}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-colors hover:border-red-200 hover:bg-red-50"
              style={{ color: '#dc2626', borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}
              title="Delete client"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── FINANCIAL KPI CARDS ─────────────────────────────────────── */}
        {!summaryLoading && (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: 'TOTAL INVOICED',
                value: totalInvoicedPaise > 0 ? formatRupees(totalInvoicedPaise) : '₹0',
                sub: `${summary?.invoices.length ?? 0} invoice${(summary?.invoices.length ?? 0) !== 1 ? 's' : ''}`,
                icon: <FileText className="h-5 w-5" />,
                color: '#6366f1', bg: 'rgba(99,102,241,0.08)',
              },
              {
                label: 'RECEIVED',
                value: totalReceivedPaise > 0 ? formatRupees(totalReceivedPaise) : '₹0',
                sub: `${summary?.payments.length ?? 0} payment${(summary?.payments.length ?? 0) !== 1 ? 's' : ''}`,
                icon: <CreditCard className="h-5 w-5" />,
                color: '#059669', bg: 'rgba(16,185,129,0.08)',
              },
              {
                label: 'OUTSTANDING',
                value: outstandingPaise > 0 ? formatRupees(outstandingPaise) : '₹0',
                sub: outstandingPaise > 0 ? 'awaiting payment' : 'fully settled',
                icon: <TrendingUp className="h-5 w-5" />,
                color: outstandingPaise > 0 ? '#dc2626' : '#059669',
                bg: outstandingPaise > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              },
              {
                label: 'CONTRACT VALUE',
                value: totalContractPaise > 0 ? formatRupeesShort(totalContractPaise) : '₹0',
                sub: `${summary?.projectCount ?? 0} project${(summary?.projectCount ?? 0) !== 1 ? 's' : ''}`,
                icon: <FolderOpen className="h-5 w-5" />,
                color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
              },
            ].map((kpi, i) => (
              <div
                key={i}
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: kpi.bg, color: kpi.color }}>
                  {kpi.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{kpi.label}</p>
                  <p className="text-[18px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: i === 2 && outstandingPaise > 0 ? '#dc2626' : 'var(--text-heading)' }}>{kpi.value}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{kpi.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TWO-COLUMN BODY ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">

          {/* ══ LEFT: Primary content ══════════════════════════════════ */}
          <div className="flex flex-col gap-5">

            {/* Client Info Card */}
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                  Client details
                </p>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={cancelEdit} className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={saveProps}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                      style={{ background: 'var(--accent-base)', color: '#fff' }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* View mode — 2-col grid */}
              {!editMode && (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <ViewField label="Mobile" icon={Phone}>
                      <a href={`tel:${displayed.phone}`} className="hover:opacity-70" style={{ color: 'var(--text-heading)' }}>
                        {displayed.phone}
                      </a>
                    </ViewField>
                    <ViewField label="Email" icon={Mail}>
                      {displayed.email
                        ? <a href={`mailto:${displayed.email}`} className="hover:opacity-70 truncate block" style={{ color: 'var(--text-heading)' }}>{displayed.email}</a>
                        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </ViewField>
                    <ViewField label="City" icon={MapPin}>
                      <span style={{ color: displayed.city ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                        {displayed.city ?? '—'}
                      </span>
                    </ViewField>
                    <ViewField label="Company" icon={Building2}>
                      <span style={{ color: displayed.company ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
                        {displayed.company ?? '—'}
                      </span>
                    </ViewField>
                    <ViewField label="Source" icon={Tag}>
                      <span className="capitalize" style={{ color: 'var(--text-heading)' }}>
                        {SOURCES.find(s => s.value === displayed.source)?.label ?? displayed.source}
                      </span>
                    </ViewField>
                  </div>
                  {(displayed.tags ?? []).length > 0 && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(displayed.tags ?? []).map(tag => (
                          <span key={tag} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: tagColor(tag) }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Edit mode */}
              {editMode && (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <InlineField label="Full name" icon={User}>
                        <Input value={displayed.fullName} onChange={(e) => set('fullName', e.target.value)} className="h-9 text-sm" />
                      </InlineField>
                    </div>
                    <InlineField label="Mobile" icon={Phone}>
                      <Input value={displayed.phone} onChange={(e) => set('phone', e.target.value)} className="h-9 text-sm" />
                    </InlineField>
                    <InlineField label="Email" icon={Mail}>
                      <Input type="email" value={displayed.email ?? ''} onChange={(e) => set('email', (e.target.value || null) as Customer['email'])} placeholder="—" className="h-9 text-sm" />
                    </InlineField>
                    <InlineField label="City" icon={MapPin}>
                      <Input value={displayed.city ?? ''} onChange={(e) => set('city', (e.target.value || null) as Customer['city'])} placeholder="—" className="h-9 text-sm" />
                    </InlineField>
                    <InlineField label="Company" icon={Building2}>
                      <Input value={displayed.company ?? ''} onChange={(e) => set('company', (e.target.value || null) as Customer['company'])} placeholder="—" className="h-9 text-sm" />
                    </InlineField>
                    <InlineField label="Stage" icon={Tag}>
                      <Select value={displayed.stage} onValueChange={(v) => set('stage', v as CustomerStage)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </InlineField>
                    <InlineField label="Source" icon={Tag}>
                      <Select value={displayed.source} onValueChange={(v) => set('source', v as CustomerSource)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </InlineField>
                    <div className="col-span-2">
                      <InlineField label="Tags" icon={Tag}>
                        <TagsChipEditor tags={displayed.tags ?? []} onChange={(tags) => set('tags', tags)} />
                      </InlineField>
                    </div>
                  </div>
                  {saveErr && <p className="mt-3 text-xs text-red-600">{saveErr}</p>}
                </div>
              )}
            </section>

            {/* Tabbed panel */}
            <section className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              {/* Tab bar */}
              <div
                className="flex items-center"
                style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                {([
                  { key: 'overview' as Tab, label: 'Overview', icon: <LayoutGrid  className="h-3.5 w-3.5" /> },
                  { key: 'ledger'   as Tab, label: 'Ledger',   icon: <Wallet      className="h-3.5 w-3.5" /> },
                  { key: 'activity' as Tab, label: 'Activity',  icon: <Activity   className="h-3.5 w-3.5" /> },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-all"
                    style={{
                      borderColor: tab === t.key ? 'var(--accent-base)' : 'transparent',
                      color:       tab === t.key ? 'var(--accent-base)' : 'var(--text-secondary)',
                      background:  tab === t.key ? 'var(--surface-card)' : 'var(--surface-muted)',
                    }}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {tab === 'overview' && (
                <div style={{ background: 'var(--surface-card)' }}>
                  <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Projects</p>
                    <Link href="/projects/new" className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-70" style={{ color: 'var(--accent-base)' }}>
                      <Plus className="h-3.5 w-3.5" /> New project
                    </Link>
                  </div>

                  {summaryLoading && !summary ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
                  ) : !summary || (summary.projects.length === 0 && summary.leads.length === 0) ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
                        <FolderOpen className="h-6 w-6" style={{ color: '#6366f1' }} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>No projects yet</p>
                        <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Projects linked to this client will appear here</p>
                      </div>
                      <Link href="/projects/new" className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold" style={{ background: 'var(--accent-base)', color: '#fff' }}>
                        <Plus className="h-4 w-4" /> Create first project
                      </Link>
                    </div>
                  ) : (
                    <>
                      {summary.projects.length > 0 && (
                        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                          {summary.projects.slice(0, 5).map((p) => {
                            const sc = LIFECYCLE_STAGE_COLOR[p.lifecycleStage] ?? { bg: 'rgba(100,116,139,0.10)', color: '#475569' };
                            return (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                className="flex items-center justify-between px-5 py-3.5 transition-colors"
                                style={{ background: 'var(--surface-card)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}>
                                    <FolderOpen className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{p.name || 'Untitled project'}</p>
                                    {p.siteAddress && (
                                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />{p.siteAddress}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-4 flex shrink-0 items-center gap-3">
                                  {p.totalContractPaise != null && p.totalContractPaise > 0 && (
                                    <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                      {formatRupees(p.totalContractPaise)}
                                    </span>
                                  )}
                                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: sc.bg, color: sc.color }}>
                                    {LIFECYCLE_LABEL[p.lifecycleStage] ?? p.lifecycleStage}
                                  </span>
                                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      {summary.projects.length > 5 && (
                        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <Link href="/projects" className="text-[12px] font-semibold hover:opacity-70" style={{ color: 'var(--accent-base)' }}>
                            View all {summary.projects.length} projects →
                          </Link>
                        </div>
                      )}

                      {summary.leads.length > 0 && (
                        <>
                          <div className="px-5 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Active enquiries</p>
                          </div>
                          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                            {summary.leads.map((l) => (
                              <Link
                                key={l.id}
                                href={`/leads/${l.id}`}
                                className="flex items-center justify-between px-5 py-3.5 transition-colors"
                                style={{ background: 'var(--surface-card)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-card)')}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{l.projectName || 'New enquiry'}</p>
                                  {l.projectLocation && (
                                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />{l.projectLocation}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-3 flex shrink-0 items-center gap-2">
                                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                                    {LEAD_STAGE_LABEL[l.stage] ?? l.stage}
                                  </span>
                                  <ChevronRight className="h-4 w-4 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                                </div>
                              </Link>
                            ))}
                          </div>
                        </>
                      )}

                    </>
                  )}
                </div>
              )}

              {/* Ledger tab */}
              {tab === 'ledger' && (
                <div style={{ background: 'var(--surface-card)' }}>
                  {/* Header row */}
                  <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      Running account — invoices raised (debit) against payments received (credit).
                    </p>
                  </div>

                  {ledgerWithBalance.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-14 text-center">
                      <Wallet className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>No transactions yet</p>
                        <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Invoices and payments will appear here once raised.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                            {['DATE', 'TYPE', 'PARTICULARS', 'DEBIT', 'CREDIT', 'BALANCE'].map((h, i) => (
                              <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${i >= 3 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-tertiary)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                          {ledgerWithBalance.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[var(--surface-muted)] transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                                  style={row.kind === 'payment'
                                    ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.30)' }
                                    : { background: 'rgba(99,102,241,0.10)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.25)' }
                                  }
                                >
                                  {row.kind === 'payment' ? 'Received' : 'Sent'}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{row.number}</p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{row.particulars}</p>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                {row.debitPaise > 0 ? formatRupees(row.debitPaise) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#059669' }}>
                                {row.creditPaise > 0 ? formatRupees(row.creditPaise) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: row.balancePaise > 0 ? '#dc2626' : '#059669' }}>
                                {row.balancePaise !== 0
                                  ? `${row.balancePaise < 0 ? '-' : ''}${formatRupees(Math.abs(row.balancePaise))}`
                                  : '₹0'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Closing balance */}
                        <tfoot>
                          <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                            <td colSpan={3} className="px-4 py-3 text-right text-[12px] font-bold" style={{ color: 'var(--text-heading)' }}>
                              Closing balance
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-[12px]" style={{ color: 'var(--text-heading)' }}>
                              {totalInvoicedPaise > 0 ? formatRupees(totalInvoicedPaise) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-[12px]" style={{ color: '#059669' }}>
                              {totalReceivedPaise > 0 ? formatRupees(totalReceivedPaise) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-[12px]" style={{ color: outstandingPaise > 0 ? '#dc2626' : '#059669' }}>
                              {formatRupees(outstandingPaise)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Activity tab */}
              {tab === 'activity' && (
                <div style={{ background: 'var(--surface-card)' }}>
                  {/* Composer */}
                  <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Log activity</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {COMPOSER_TYPES.map((ct) => {
                        const meta = ACTIVITY_META[ct.type];
                        const active = composerType === ct.type;
                        return (
                          <button
                            key={ct.type}
                            type="button"
                            onClick={() => setComposerType(ct.type)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-all"
                            style={{
                              background: active ? `${meta.color}18` : 'var(--surface-muted)',
                              color:      active ? meta.color : 'var(--text-secondary)',
                              border:     active ? `1.5px solid ${meta.color}40` : '1.5px solid transparent',
                            }}
                          >
                            <span style={{ color: meta.color }}>{meta.icon}</span>
                            {ct.label}
                          </button>
                        );
                      })}
                    </div>
                    <form onSubmit={submitActivity} className="space-y-2">
                      <input
                        ref={titleRef}
                        value={composerTitle}
                        onChange={(e) => setComposerTitle(e.target.value)}
                        placeholder={`${ACTIVITY_META[composerType].label} summary…`}
                        className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all"
                        style={{ background: 'var(--surface-muted)', border: '1.5px solid transparent', color: 'var(--text-heading)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-base)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                      />
                      <Textarea
                        value={composerBody}
                        onChange={(e) => setComposerBody(e.target.value)}
                        placeholder="Details (optional)…"
                        rows={2}
                        className="text-[13px] resize-none"
                      />
                      {composerErr && <p className="text-xs text-red-600">{composerErr}</p>}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={composerSaving || !composerTitle.trim()}
                          className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
                          style={{ background: 'var(--accent-base)', color: '#fff' }}
                        >
                          {composerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          {composerSaving ? 'Saving…' : `Log ${ACTIVITY_META[composerType].label.toLowerCase()}`}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Timeline */}
                  {activitiesLoading && activities.length === 0 ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <StickyNote className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No activity yet — log the first interaction above</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {visibleActivities.map((a) => {
                          const meta = ACTIVITY_META[a.type];
                          return (
                            <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
                                {meta.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>{a.title}</p>
                                  <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{relativeTime(a.createdAt)}</span>
                                </div>
                                {a.body && <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.body}</p>}
                                <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${meta.color}14`, color: meta.color }}>
                                  {meta.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hasMoreActivities && (
                        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button
                            onClick={() => setActivityPage(p => p + 1)}
                            className="w-full rounded-lg py-2.5 text-[13px] font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                          >
                            Load more ({activities.length - visibleActivities.length} remaining)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ══ RIGHT: Secondary sidebar ════════════════════════════════ */}
          <div className="sticky top-6 self-start flex flex-col gap-4">

            {/* Quick contact card */}
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Contact</p>
              </div>
              <div className="p-4 space-y-2">
                {displayed.phone && (
                  <a
                    href={`https://wa.me/${displayed.phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-semibold transition-opacity hover:opacity-85"
                    style={{ background: '#25d366', color: '#fff' }}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {displayed.phone && (
                    <a
                      href={`tel:${displayed.phone}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                  {displayed.email && (
                    <a
                      href={`mailto:${displayed.email}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Financial Summary card */}
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Financial Summary</p>
                <button onClick={() => setTab('ledger')} className="text-[11px] font-semibold hover:opacity-70" style={{ color: 'var(--accent-base)' }}>
                  Ledger →
                </button>
              </div>

              <div className="divide-y px-4" style={{ borderColor: 'var(--border-subtle)' }}>
                {[
                  { label: 'Total project value',  value: totalContractPaise,  color: 'var(--text-heading)', bold: false },
                  { label: 'Quotations',            value: null, text: String(summary?.quoteCount ?? 0), color: 'var(--text-heading)', bold: false },
                  { label: 'Invoiced to date',      value: totalInvoicedPaise,  color: 'var(--text-heading)', bold: false },
                  { label: 'Payments received',     value: totalReceivedPaise,  color: '#059669', bold: false },
                  { label: 'Outstanding balance',   value: outstandingPaise,   color: outstandingPaise > 0 ? '#dc2626' : '#059669', bold: true },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <span className={`text-[12px] ${row.bold ? 'font-bold' : ''}`} style={{ color: row.bold ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
                      {row.label}
                    </span>
                    <span className={`text-[13px] tabular-nums ${row.bold ? 'font-bold' : 'font-medium'}`} style={{ color: row.color }}>
                      {row.text ?? (row.value != null && row.value > 0 ? formatRupees(row.value) : (row.value === 0 && i > 0 ? '₹0' : '—'))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {totalInvoicedPaise > 0 && (
                <div className="px-4 pb-4 pt-2">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${collectedPct}%`, background: '#10b981' }} />
                  </div>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {collectedPct}% collected of invoiced amount
                  </p>
                </div>
              )}
            </section>

            {/* Quick stats card */}
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Activity</p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {[
                  { label: 'Site visits', value: summaryLoading ? '…' : String(summary?.siteVisitCount ?? 0), icon: <MapPin className="h-3.5 w-3.5" />, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
                  { label: 'Activities',  value: activitiesLoading ? '…' : String(activities.length), icon: <Activity className="h-3.5 w-3.5" />, color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
                ].map((kpi, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: kpi.bg, color: kpi.color }}>
                        {kpi.icon}
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</span>
                    </div>
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{kpi.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Notes card */}
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Notes</p>
                {notesDraft !== (customer.notes ?? '') && (
                  <button
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                    style={{ background: 'var(--accent-base)', color: '#fff' }}
                  >
                    {notesSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </button>
                )}
              </div>
              <div className="p-4">
                <Textarea
                  rows={5}
                  placeholder="Preferences, follow-up notes…"
                  value={notesDraft}
                  onChange={(e) => { setNotesDraft(e.target.value); setNotesErr(null); }}
                  onBlur={saveNotes}
                  className="text-sm resize-none"
                />
                {notesErr && <p className="mt-1.5 text-xs text-red-600">{notesErr}</p>}
                {notesDraft === (customer.notes ?? '') && notesDraft && (
                  <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Auto-saves on blur</p>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function ViewField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="text-[13px] font-medium">{children}</div>
    </div>
  );
}

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
    <div className="space-y-1.5">
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
  'var(--accent-base)', 'var(--success)', '#f59e0b',
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
      className="flex min-h-[38px] cursor-text flex-wrap gap-1.5 rounded-xl p-2"
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
