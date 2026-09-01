'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FolderKanban, IndianRupee, TrendingUp,
  Plus, Target, CheckCircle2, AlertCircle, Clock, ChevronRight,
  Calendar, MapPin, FileText,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number; site_visit_scheduled: number; consultation_done: number;
  proposal_sent: number; negotiation: number; won: number; lost: number;
}
interface Project {
  id: string; name: string; lifecycleStage: string;
  totalContractPaise: number | null; customerFullName: string | null;
  leadContactName: string | null; expectedEndAt: string | null;
}
interface ReceivableItem {
  id: string; projectName: string; label: string; amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue'; daysSinceCreation: number;
}
interface ReceivablesData {
  items: ReceivableItem[]; totalOutstandingPaise: number; totalOverduePaise: number;
}
interface SiteVisit {
  id: string; leadId: string | null;
  scheduledAt: string; completedAt: string | null;
  locationJson: { address?: string } | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`;
  if (r >= 100_000)    return `₹${(r / 100_000).toFixed(1)}L`;
  if (r >= 1_000)      return `₹${(r / 1_000).toFixed(0)}K`;
  return `₹${Math.round(r)}`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ── Stage config ───────────────────────────────────────────────────────── */
const STAGE_PROGRESS: Record<string, number> = {
  design_pending: 10, design_in_progress: 30, design_approved: 45,
  procurement: 55, execution: 70, snagging: 85, handover: 93, complete: 100,
};
const STAGE_META: Record<string, { label: string; bg: string; text: string }> = {
  design_pending:     { label: 'Design Pending',  bg: 'var(--surface-muted)', text: 'var(--text-secondary)' },
  design_in_progress: { label: 'Designing',       bg: 'var(--accent-soft)',   text: 'var(--accent-text)'   },
  design_approved:    { label: 'Design ✓',        bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
  procurement:        { label: 'Procurement',      bg: 'var(--warning-soft)',  text: 'var(--warning-text)'  },
  execution:          { label: 'Execution',        bg: 'var(--accent-soft)',   text: 'var(--accent-text)'   },
  snagging:           { label: 'Snagging',         bg: 'var(--warning-soft)',  text: 'var(--warning-text)'  },
  handover:           { label: 'Handover',         bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
  complete:           { label: 'Complete',         bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
};
const FUNNEL_STAGES: { key: keyof LeadStats; label: string }[] = [
  { key: 'new',                  label: 'New Enquiry'  },
  { key: 'site_visit_scheduled', label: 'Site Visit'   },
  { key: 'consultation_done',    label: 'Consultation' },
  { key: 'proposal_sent',        label: 'Proposal'     },
  { key: 'negotiation',          label: 'Negotiation'  },
  { key: 'won',                  label: 'Won'          },
];
const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#f97316', '#10b981'];

/* ── Accent map ─────────────────────────────────────────────────────────── */
const KPI_ACCENTS = {
  purple: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  blue:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)'   },
  orange: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)' },
  green:  { bg: 'var(--accent-green-bg)',  fg: 'var(--accent-green)'  },
} as const;

/* ── Sparkline ──────────────────────────────────────────────────────────── */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 52, H = 18;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={W} height={H} style={{ flexShrink: 0, overflow: 'visible' }}>
      <polyline fill="none" stroke={isUp ? 'var(--success)' : 'var(--danger)'}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, accent = 'purple', loading, sparkline,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: keyof typeof KPI_ACCENTS; loading: boolean; sparkline?: number[];
}) {
  const a = KPI_ACCENTS[accent];
  return (
    <div
      className="premium-card p-4 group cursor-default"
      style={{ transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div
        className="stat-badge mb-3 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
        style={{ backgroundColor: a.bg, width: '2.25rem', height: '2.25rem' }}
      >
        <Icon className="h-4 w-4" style={{ color: a.fg }} strokeWidth={2} />
      </div>
      {loading
        ? <div className="skeleton h-7 w-20 mb-1" />
        : (
          <div className="flex items-end gap-2 mb-1">
            <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-heading)' }}>{value}</p>
            {sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} />}
          </div>
        )
      }
      <p className="mt-1.5 text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{label}</p>
      {loading
        ? <div className="skeleton h-3.5 w-24 mt-1" />
        : sub && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
      }
    </div>
  );
}

/* ── Quick Action ───────────────────────────────────────────────────────── */
function QuickAction({
  href, label, icon: Icon, accent = 'purple',
}: { href: string; label: string; icon: React.ElementType; accent?: keyof typeof KPI_ACCENTS }) {
  const a = KPI_ACCENTS[accent];
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border p-3.5 transition-colors"
      style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = a.fg)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: a.bg }}>
        <Icon className="h-3.5 w-3.5" style={{ color: a.fg }} />
      </div>
      <span className="text-sm font-semibold flex-1">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
    </Link>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [firstName, setFirstName]           = useState('');
  const [leadStats, setLeadStats]           = useState<LeadStats | null>(null);
  const [leadBudgets, setLeadBudgets]       = useState<Record<string, number>>({});
  const [allProjects, setAllProjects]       = useState<Project[]>([]);
  const [receivables, setReceivables]       = useState<ReceivablesData>({
    items: [], totalOutstandingPaise: 0, totalOverduePaise: 0,
  });
  const [todayVisits, setTodayVisits]       = useState<SiteVisit[]>([]);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [trendData, setTrendData]           = useState<number[]>([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [me, ls, ps, rs, sv, qs, ao] = await Promise.all([
          fetch('/api/v1/me').then(r => r.json()),
          fetch('/api/v1/leads/stats').then(r => r.json()),
          fetch('/api/v1/projects').then(r => r.json()),
          fetch('/api/v1/accounts/receivables').then(r => r.json()),
          fetch('/api/v1/site-visits').then(r => r.json()),
          fetch('/api/v1/quotes?status=sent').then(r => r.json()),
          fetch('/api/v1/analytics/overview').then(r => r.json()),
        ]);
        if (me?.data?.fullName) setFirstName(me.data.fullName.split(' ')[0]);
        if (ls?.data?.counts) setLeadStats(ls.data.counts);
        if (ls?.data?.budgets) setLeadBudgets(ls.data.budgets);
        if (Array.isArray(ps?.data)) setAllProjects(ps.data);
        if (rs?.data) {
          setReceivables({
            items: Array.isArray(rs.data.items) ? rs.data.items : [],
            totalOutstandingPaise: rs.data.totalOutstandingPaise ?? 0,
            totalOverduePaise: rs.data.totalOverduePaise ?? 0,
          });
        }
        const allVisits: SiteVisit[] = Array.isArray(sv?.data) ? sv.data : [];
        setTodayVisits(
          allVisits
            .filter(v => isToday(v.scheduledAt))
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
        );
        setPendingQuotesCount(Array.isArray(qs?.data) ? qs.data.length : 0);
        if (Array.isArray(ao?.data?.trend30d)) {
          setTrendData(ao.data.trend30d.map((d: { amountPaise: number }) => d.amountPaise));
        }
      } catch { /* silent */ } finally { setLoading(false); }
    }
    load();
  }, []);

  /* ── Derived ──────────────────────────────────────────────────────── */
  const totalLeads     = leadStats ? Object.values(leadStats).reduce((a, b) => a + b, 0) : 0;
  const activeLeads    = leadStats ? totalLeads - (leadStats.won + leadStats.lost) : 0;
  const activeProjects = allProjects.filter(p => p.lifecycleStage !== 'complete');
  const conversionPct  = leadStats && totalLeads > 0 ? Math.round((leadStats.won / totalLeads) * 100) : 0;
  const overdueCount   = receivables.items.filter(r => r.paymentStatus === 'overdue').length;
  const overdueProjects = new Set(
    receivables.items.filter(r => r.paymentStatus === 'overdue').map(r => r.projectName),
  );
  const nowMs = new Date().getTime();

  /* ── (derived state only, no dynamic quickActions array needed) ───── */

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Greeting + New Lead ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Dashboard
          </p>
          <h1
            className="text-xl font-bold leading-tight"
            style={{ color: 'var(--text-heading)' }}
            suppressHydrationWarning
          >
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }} suppressHydrationWarning>
            {todayLabel()}
          </p>
        </div>
        <Link
          href="/leads?new=1"
          className="btn-primary flex items-center gap-2 flex-shrink-0 px-4 py-2 text-sm rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New lead
        </Link>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active Leads"        value={String(activeLeads)}           sub={`${totalLeads} total · ${leadStats?.won ?? 0} won`}                                                                          icon={Users}        accent="purple" loading={loading} />
        <KpiCard label="Active Projects"     value={String(activeProjects.length)} sub={`${allProjects.length} total`}                                                                                               icon={FolderKanban} accent="blue"   loading={loading} />
        <KpiCard label="Pending Receivables" value={`₹${((receivables.totalOutstandingPaise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub={`${receivables.items.length} invoice${receivables.items.length !== 1 ? 's' : ''}`} icon={IndianRupee} accent="orange" loading={loading} sparkline={trendData} />
        <KpiCard label="Conversion Rate"     value={`${conversionPct}%`}           sub={`${leadStats?.won ?? 0} won of ${totalLeads} leads`}                                                                         icon={TrendingUp}   accent="green"  loading={loading} />
      </div>

      {/* ── Today's Schedule ──────────────────────────────────────── */}
      <div className="premium-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            <h3 className="section-title">Today&apos;s Schedule</h3>
          </div>
          <Link href="/calendar" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
            All Schedules →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : todayVisits.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
            <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No site visits today</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Scheduled visits will appear here.</p>
            </div>
            <Link
              href="/leads"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-base)', color: '#fff' }}
            >
              <Plus className="h-3 w-3" />
              Schedule Visit
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayVisits.map(v => {
              const time = new Date(v.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const address = v.locationJson?.address;
              const isDone = !!v.completedAt;
              return (
                <Link
                  key={v.id}
                  href={v.leadId ? `/leads/${v.leadId}` : '/leads'}
                  className="group flex gap-3 rounded-xl border p-3 transition-colors hover:border-[var(--accent-base)]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--surface-app)',
                    opacity: isDone ? 0.6 : 1,
                  }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: isDone ? 'var(--success-soft)' : 'var(--accent-soft)' }}
                  >
                    {isDone
                      ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success-text)' }} />
                      : <Clock className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{time}</p>
                    {address && (
                      <div className="flex items-start gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{address}</p>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lead Funnel + Active Projects ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Lead Funnel */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Lead Funnel</h3>
            <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-9 w-full rounded" />)}
            </div>
          ) : !leadStats || totalLeads === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
                <Target className="h-6 w-6" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No leads yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Add your first lead to see the pipeline.</p>
              <Link href="/leads?new=1" className="btn-primary mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg">
                <Plus className="h-3 w-3" /> Add Lead
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {FUNNEL_STAGES.map((s, i) => {
                const count = leadStats[s.key];
                const pct = activeLeads > 0 && count > 0 ? Math.round((count / activeLeads) * 100) : 0;
                const color = FUNNEL_COLORS[i];
                const budget = leadBudgets[s.key] ?? 0;
                return (
                  <div key={s.key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span className="text-[11px] font-bold flex-shrink-0 min-w-[22px] text-center rounded-full px-1.5 py-0.5" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-heading)' }}>{count}</span>
                      {budget > 0 && (
                        <span className="text-[10px] flex-shrink-0 w-11 text-right" style={{ color: 'var(--text-tertiary)' }}>
                          {fmtCompact(budget)}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {leadStats && totalLeads > 0 && (
            <div className="mt-4 flex items-center gap-5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Won: <strong style={{ color: 'var(--text-heading)' }}>{leadStats.won}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lost: <strong style={{ color: 'var(--text-heading)' }}>{leadStats.lost}</strong></span>
              </div>
              <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>{conversionPct}% conversion</span>
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Active Projects</h3>
            <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
                <FolderKanban className="h-6 w-6" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No active projects</p>
              <p className="mt-1 text-xs max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>Win a lead to kick off your first project.</p>
              <Link href="/projects" className="btn-primary mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg">
                <Plus className="h-3 w-3" /> New Project
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeProjects.slice(0, 3).map(p => {
                const pct = STAGE_PROGRESS[p.lifecycleStage] ?? 0;
                const s = STAGE_META[p.lifecycleStage] ?? { label: p.lifecycleStage, bg: 'var(--surface-muted)', text: 'var(--text-secondary)' };
                const client = p.customerFullName || p.leadContactName;
                const hasOverdue = overdueProjects.has(p.name);
                const daysLeft = p.expectedEndAt
                  ? Math.ceil((new Date(p.expectedEndAt).getTime() - nowMs) / 86_400_000)
                  : null;
                const showDaysBadge = daysLeft !== null && daysLeft <= 30;
                const daysBadgeStyle = daysLeft !== null && daysLeft < 7
                  ? { bg: 'var(--danger-soft)', text: 'var(--danger-text)' }
                  : { bg: 'var(--warning-soft)', text: 'var(--warning-text)' };
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block rounded-xl border p-2.5 transition-colors hover:border-[var(--accent-base)]"
                    style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasOverdue && (
                          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--danger)' }} title="Payment overdue" />
                        )}
                        {showDaysBadge && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ backgroundColor: daysBadgeStyle.bg, color: daysBadgeStyle.text }}>
                            {daysLeft! < 0 ? `${Math.abs(daysLeft!)}d over` : `${daysLeft}d left`}
                          </span>
                        )}
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.text }}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                    {client && <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{client}</p>}
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-base)', transition: 'width 0.5s ease' }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Pending Payments + Quick Actions ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Pending Payments */}
        <div className="premium-card p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Pending Payments</h3>
            <Link href="/accounts" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-11 w-full rounded-lg" />)}
            </div>
          ) : receivables.items.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-4" style={{ backgroundColor: 'var(--success-soft)' }}>
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--success-text)' }}>All payments up to date</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--success-text)' }}>No pending or overdue invoices.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {receivables.items.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.paymentStatus === 'overdue'
                      ? <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                      : <Clock className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.projectName}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{r.label}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: r.paymentStatus === 'overdue' ? 'var(--danger-text)' : 'var(--warning-text)' }}>
                    {fmt(r.amountPaise)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="premium-card p-5 h-full flex flex-col">
          <h3 className="section-title mb-4">Quick Actions</h3>

          {/* Alert strip */}
          {(overdueCount > 0 || pendingQuotesCount > 0) && (
            <div className="mb-3 space-y-1.5">
              {overdueCount > 0 && (
                <Link
                  href="/accounts"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--danger-soft)' }}
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--danger-text)' }} />
                  <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--danger-text)' }}>
                    {overdueCount} payment{overdueCount > 1 ? 's' : ''} overdue
                  </span>
                  <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--danger-text)' }} />
                </Link>
              )}
              {pendingQuotesCount > 0 && (
                <Link
                  href="/quotes"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--warning-soft)' }}
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
                  <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--warning-text)' }}>
                    {pendingQuotesCount} quote{pendingQuotesCount > 1 ? 's' : ''} awaiting approval
                  </span>
                  <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
                </Link>
              )}
            </div>
          )}

          {/* Static action buttons */}
          <div className="grid grid-cols-1 gap-2">
            <QuickAction href="/projects"  label="New Project"      icon={FolderKanban} accent="blue"  />
            <QuickAction href="/quotes"    label="Create Quotation" icon={FileText}     accent="green" />
          </div>
        </div>
      </div>
    </div>
  );
}
