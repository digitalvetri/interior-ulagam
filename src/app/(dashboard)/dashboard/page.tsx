'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FolderKanban, IndianRupee,
  Plus, Target, CheckCircle2, AlertCircle, Clock, ChevronRight,
  Calendar, MapPin, FileText, Home, PhoneCall,
  CheckSquare, Truck,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number; contacted: number; qualified: number;
  site_visit: number; measurement: number; quotation: number;
  negotiation: number; won: number; lost: number;
}
interface Project {
  id: string; name: string; lifecycleStage: string;
  totalContractPaise: number | null;
  customerFullName: string | null; leadContactName: string | null;
  expectedEndAt: string | null;
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
interface Task {
  id: string; title: string; dueAt: string | null; completedAt: string | null;
  relatedType: string | null;
}
interface PendingVendorDelivery {
  poNumber: string; vendorName: string | null; expectedDeliveryAt: string | null;
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

const FUNNEL_STAGES = [
  { key: 'new',       label: 'New Enquiry' },
  { key: 'contacted', label: 'Contacted'   },
  { key: 'qualified', label: 'Qualified'   },
  { key: 'won',       label: 'Won'         },
];
const FUNNEL_COLORS = ['#6366f1', '#a855f7', '#f59e0b', '#10b981'];

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
  label, value, sub, icon: Icon, accent = 'purple', loading, sparkline, href,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: keyof typeof KPI_ACCENTS; loading: boolean; sparkline?: number[]; href?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const inner = (
    <div
      className="premium-card p-5 group cursor-default"
      style={{ transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div
        className="stat-badge mb-3 transition-transform duration-200 group-hover:scale-110"
        style={{ backgroundColor: a.bg, width: '2.75rem', height: '2.75rem' }}
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
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ── Quick Action ───────────────────────────────────────────────────────── */
function QuickAction({
  href, label, icon: Icon, accent = 'purple', badge,
}: { href: string; label: string; icon: React.ElementType; accent?: keyof typeof KPI_ACCENTS; badge?: number }) {
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
      {badge && badge > 0 ? (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {badge}
        </span>
      ) : (
        <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
      )}
    </Link>
  );
}


/* ── Today visits widget ────────────────────────────────────────────────── */
function TodayVisitsWidget({ todayVisits, loading }: { todayVisits: SiteVisit[]; loading: boolean }) {
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <h3 className="section-title">Today&apos;s Site Visits</h3>
          {todayVisits.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              {todayVisits.length}
            </span>
          )}
        </div>
        <Link href="/site-visits" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
          All →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
        </div>
      ) : todayVisits.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--surface-muted)', border: '1px dashed var(--border-subtle)' }}>
          <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No site visits today</p>
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
                href={v.leadId ? `/leads/${v.leadId}` : '/site-visits'}
                className="group flex gap-3 rounded-xl border p-3 transition-colors hover:border-[var(--accent-base)]"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)', opacity: isDone ? 0.6 : 1 }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: isDone ? 'var(--success-soft)' : 'var(--accent-soft)' }}>
                  {isDone
                    ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success-text)' }} />
                    : <Clock       className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
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
  );
}

/* ── Follow-ups widget ──────────────────────────────────────────────────── */
interface FollowUpCounts { overdue: number; dueToday: number; upcoming: number; total: number; }
function FollowUpsWidget({ counts, loading }: { counts: FollowUpCounts | null; loading: boolean }) {
  const rows = [
    { label: 'Overdue',   value: counts?.overdue  ?? 0, color: 'var(--danger)',  href: '/leads?followup=overdue'  },
    { label: 'Due today', value: counts?.dueToday ?? 0, color: 'var(--warning)', href: '/leads?followup=today'    },
    { label: 'Upcoming',  value: counts?.upcoming  ?? 0, color: 'var(--accent-base)', href: '/leads?followup=upcoming' },
  ];
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <h3 className="section-title">Today&apos;s Follow-ups</h3>
        </div>
        <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
          All leads →
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(r => (
              <Link key={r.label} href={r.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-muted)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: r.value > 0 ? r.color : 'var(--text-tertiary)' }}>
                  {r.value}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total open</span>
            <Link href="/leads" className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              {counts?.total ?? 0} →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ── My tasks widget ────────────────────────────────────────────────────── */
function MyTasksWidget({ myTasks, loading }: { myTasks: Task[]; loading: boolean }) {
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <h3 className="section-title">My Tasks</h3>
          {myTasks.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              {myTasks.length}
            </span>
          )}
        </div>
        <Link href="/tasks" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
          All →
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
      ) : myTasks.length === 0 ? (
        <p className="text-sm py-3" style={{ color: 'var(--text-secondary)' }}>No pending tasks assigned to you.</p>
      ) : (
        <div className="space-y-1.5">
          {myTasks.slice(0, 5).map(t => {
            const overdue = t.dueAt && new Date(t.dueAt) < new Date();
            return (
              <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                style={{ backgroundColor: 'var(--surface-muted)' }}>
                <Clock className="h-3.5 w-3.5 flex-shrink-0"
                  style={{ color: overdue ? 'var(--danger)' : 'var(--text-tertiary)' }} />
                <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{t.title}</span>
                {t.dueAt && (
                  <span className="text-[10px] flex-shrink-0"
                    style={{ color: overdue ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                    {new Date(t.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [firstName,  setFirstName]  = useState('');
  const [isAdmin,    setIsAdmin]    = useState(true);

  // Admin state
  const [leadStats,    setLeadStats]    = useState<LeadStats | null>(null);
  const [leadBudgets,  setLeadBudgets]  = useState<Record<string, number>>({});
  const [allProjects,  setAllProjects]  = useState<Project[]>([]);
  const [receivables,  setReceivables]  = useState<ReceivablesData>({
    items: [], totalOutstandingPaise: 0, totalOverduePaise: 0,
  });
  const [trendData,    setTrendData]    = useState<number[]>([]);
  const [pendingQs,    setPendingQs]    = useState(0);
  const [upcomingPOs,  setUpcomingPOs]  = useState<PendingVendorDelivery[]>([]);

  // Shared state
  const [todayVisits,  setTodayVisits]  = useState<SiteVisit[]>([]);
  const [myTasks,      setMyTasks]      = useState<Task[]>([]);
  const [myProjects,   setMyProjects]   = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUpCounts | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [me, sv, ts] = await Promise.all([
          fetch('/api/v1/me').then(r => r.json()),
          fetch('/api/v1/site-visits').then(r => r.json()),
          fetch('/api/v1/tasks?assigned=me&status=pending&limit=10').then(r => r.json()),
        ]);

        const admin = !!(me?.data?.isAdmin || me?.data?.role === 'owner');
        setIsAdmin(admin);
        if (me?.data?.fullName) setFirstName(me.data.fullName.split(' ')[0]);

        const allVisits: SiteVisit[] = Array.isArray(sv?.data) ? sv.data : [];
        setTodayVisits(
          allVisits
            .filter(v => isToday(v.scheduledAt))
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
        );
        if (Array.isArray(ts?.data)) setMyTasks(ts.data);

        // Follow-ups (both admin and employee)
        fetch('/api/v1/dashboard/follow-ups')
          .then(r => r.ok ? r.json() : null)
          .then(j => j?.data && setFollowUps(j.data))
          .catch(() => {});

        if (admin) {
          // Admin-specific data
          const [ls, ps, rs, qs, ao, pos] = await Promise.all([
            fetch('/api/v1/leads/stats').then(r => r.json()),
            fetch('/api/v1/projects').then(r => r.json()),
            fetch('/api/v1/accounts/receivables').then(r => r.json()),
            fetch('/api/v1/quotes?status=sent').then(r => r.json()),
            fetch('/api/v1/analytics/overview').then(r => r.json()),
            fetch('/api/v1/purchase-orders?status=sent&limit=20').then(r => r.json()),
          ]);
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
          setPendingQs(Array.isArray(qs?.data) ? qs.data.length : 0);
          if (Array.isArray(ao?.data?.trend30d)) {
            setTrendData(ao.data.trend30d.map((d: { amountPaise: number }) => d.amountPaise));
          }
          if (Array.isArray(pos?.data)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const soon = new Date(today.getTime() + 7 * 86400_000);
            setUpcomingPOs(pos.data
              .filter((po: { expectedDeliveryAt: string | null }) =>
                po.expectedDeliveryAt && new Date(po.expectedDeliveryAt) <= soon)
              .slice(0, 5));
          }
        } else {
          // Employee: only load my projects
          const ps = await fetch('/api/v1/projects?limit=20').then(r => r.json());
          if (Array.isArray(ps?.data)) {
            setMyProjects(ps.data.filter((p: Project) => p.lifecycleStage !== 'complete').slice(0, 5));
          }
        }
      } catch { /* silent */ } finally { setLoading(false); }
    }
    load();
  }, []);

  /* ── Derived ──────────────────────────────────────────────────────── */
  function funnelCount(key: string): number {
    if (!leadStats) return 0;
    if (key === 'qualified') {
      return (leadStats.qualified ?? 0)
        + (leadStats.site_visit ?? 0)
        + (leadStats.measurement ?? 0)
        + (leadStats.quotation ?? 0)
        + (leadStats.negotiation ?? 0);
    }
    return leadStats[key as keyof LeadStats] ?? 0;
  }
  function funnelBudget(key: string): number {
    if (key === 'qualified') {
      return (leadBudgets['qualified'] ?? 0)
        + (leadBudgets['site_visit'] ?? 0)
        + (leadBudgets['measurement'] ?? 0)
        + (leadBudgets['quotation'] ?? 0)
        + (leadBudgets['negotiation'] ?? 0);
    }
    return leadBudgets[key] ?? 0;
  }

  const totalLeads     = leadStats
    ? leadStats.new + leadStats.contacted + leadStats.qualified
      + leadStats.site_visit + leadStats.measurement
      + leadStats.quotation + leadStats.negotiation
      + leadStats.won + leadStats.lost
    : 0;
  const activeLeads    = leadStats ? totalLeads - (leadStats.won + leadStats.lost) : 0;
  const activeProjects = allProjects.filter(p => p.lifecycleStage !== 'complete');
  const conversionPct  = leadStats && totalLeads > 0
    ? Math.round((leadStats.won / totalLeads) * 100) : 0;
  const overdueCount   = receivables.items.filter(r => r.paymentStatus === 'overdue').length;
  const overdueProjects = new Set(
    receivables.items.filter(r => r.paymentStatus === 'overdue').map(r => r.projectName),
  );
  /* ══════════════════════════════════════════════════════════════════════
     ADMIN VIEW
     ══════════════════════════════════════════════════════════════════════ */
  if (isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in p-6 lg:p-8">

        {/* Page heading */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}>
              Studio at a glance
            </p>
            <h1 className="text-4xl font-bold leading-none"
              style={{ color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
              Dashboard
            </h1>
          </div>
          <Link href="/leads?new=1"
            className="btn-primary flex items-center gap-2 flex-shrink-0 px-4 py-2.5 text-sm rounded-xl">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} /> New Lead
          </Link>
        </div>

        {/* Hero banner */}
        <div className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: '#cbd5e1' }} suppressHydrationWarning>{todayLabel()}</span>
          </div>
          <p className="text-sm mb-1" style={{ color: '#94a3b8' }} suppressHydrationWarning>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </p>
          {loading ? (
            <div className="h-7 w-72 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
          ) : (
            <h2 className="text-2xl font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
              {activeLeads > 0
                ? `${activeLeads} active lead${activeLeads !== 1 ? 's' : ''} in your pipeline.`
                : pendingQs > 0
                  ? `${pendingQs} quotation${pendingQs !== 1 ? 's' : ''} awaiting acceptance.`
                  : overdueCount > 0
                    ? `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''} to follow up.`
                    : 'All caught up. Great work!'}
            </h2>
          )}
          {!loading && (
            <div className="flex flex-wrap gap-2">
              {activeLeads > 0 && (
                <Link href="/leads"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <Users className="h-3 w-3" />{activeLeads} active lead{activeLeads !== 1 ? 's' : ''}
                </Link>
              )}
              {pendingQs > 0 && (
                <Link href="/quotes"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <FileText className="h-3 w-3" />{pendingQs} pending quote{pendingQs !== 1 ? 's' : ''}
                </Link>
              )}
              {overdueCount > 0 && (
                <Link href="/finance"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }}>
                  <AlertCircle className="h-3 w-3" />{overdueCount} overdue
                </Link>
              )}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Active Leads"
            value={String(activeLeads)}
            sub={`${totalLeads} total · ${leadStats?.won ?? 0} won`}
            icon={Users} accent="purple" loading={loading} href="/leads"
          />
          <KpiCard
            label="Quotations Pending"
            value={String(pendingQs)}
            sub={`Sent, awaiting acceptance`}
            icon={FileText} accent="blue" loading={loading} href="/quotes"
          />
          <KpiCard
            label="Active Projects"
            value={String(activeProjects.length)}
            sub={`${allProjects.length} total`}
            icon={FolderKanban} accent="orange" loading={loading} href="/projects"
          />
          <KpiCard
            label="Outstanding"
            value={fmtCompact(receivables.totalOutstandingPaise)}
            sub={overdueCount > 0 ? `${overdueCount} overdue` : 'No overdue'}
            icon={IndianRupee} accent="green" loading={loading} sparkline={trendData} href="/finance"
          />
        </div>

        {/* Follow-ups + Payment alerts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <FollowUpsWidget counts={followUps} loading={loading} />
          {/* Payment alerts */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--danger)' }} />
                <h3 className="section-title">Payment Alerts</h3>
              </div>
              <Link href="/finance" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                Finance →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
            ) : (
              <div className="space-y-2">
                <Link href="/finance"
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-muted)]">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Overdue</span>
                  <span className="text-sm font-bold" style={{ color: overdueCount > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                    {overdueCount > 0 ? fmt(receivables.totalOverduePaise) : '—'}
                  </span>
                </Link>
                <Link href="/quotes"
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-muted)]">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Quotes pending</span>
                  <span className="text-sm font-bold" style={{ color: pendingQs > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                    {pendingQs > 0 ? `${pendingQs}` : '—'}
                  </span>
                </Link>
                <Link href="/finance"
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-muted)]">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Due this week</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                    {(() => {
                      const dueThisWeek = receivables.items
                        .filter(r => (r.paymentStatus === 'pending' || r.paymentStatus === 'link_sent') && r.daysSinceCreation <= 7)
                        .reduce((s, r) => s + r.amountPaise, 0);
                      return dueThisWeek > 0 ? fmt(dueThisWeek) : '—';
                    })()}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Today's Site Visits */}
        <TodayVisitsWidget todayVisits={todayVisits} loading={loading} />

        {/* Lead Funnel + Active Projects */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
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
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-9 w-full rounded" />)}
              </div>
            ) : !leadStats || totalLeads === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Target className="h-10 w-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No leads yet</p>
                <Link href="/leads?new=1" className="btn-primary mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg">
                  <Plus className="h-3 w-3" /> Add Enquiry
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {FUNNEL_STAGES.map((s, i) => {
                  const count  = funnelCount(s.key);
                  const budget = funnelBudget(s.key);
                  const pct    = activeLeads > 0 && count > 0 ? Math.round((count / activeLeads) * 100) : 0;
                  const color  = FUNNEL_COLORS[i];
                  return (
                    <div key={s.key}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                        <span className="text-[11px] font-bold flex-shrink-0 min-w-[22px] text-center rounded-full px-1.5 py-0.5"
                          style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-heading)' }}>
                          {count}
                        </span>
                        {budget > 0 && (
                          <span className="text-[10px] flex-shrink-0 w-12 text-right" style={{ color: 'var(--text-tertiary)' }}>
                            {fmtCompact(budget)}
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }} />
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
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Won: <strong style={{ color: 'var(--text-heading)' }}>{leadStats.won}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Lost: <strong style={{ color: 'var(--text-heading)' }}>{leadStats.lost}</strong>
                  </span>
                </div>
                <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>
                  {conversionPct}% conversion
                </span>
              </div>
            )}
          </div>

          {/* Active Projects by Stage */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Projects by Stage</h3>
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
                <FolderKanban className="h-10 w-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No active projects</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeProjects.slice(0, 4).map(p => {
                  const pct = STAGE_PROGRESS[p.lifecycleStage] ?? 0;
                  const s   = STAGE_META[p.lifecycleStage] ?? { label: p.lifecycleStage, bg: 'var(--surface-muted)', text: 'var(--text-secondary)' };
                  const client = p.customerFullName || p.leadContactName;
                  const hasOverdue = overdueProjects.has(p.name);
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="block rounded-xl border p-2.5 transition-colors hover:border-[var(--accent-base)]"
                      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {hasOverdue && (
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} title="Payment overdue" />
                          )}
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                            style={{ backgroundColor: s.bg, color: s.text }}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                      {client && (
                        <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{client}</p>
                      )}
                      <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-base)' }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Overdue Payments + Vendor Deliveries Due */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Overdue Payments */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Overdue Payments</h3>
              <Link href="/finance" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                Finance →
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
                  <p className="text-sm font-bold" style={{ color: 'var(--success-text)' }}>All clear</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--success-text)' }}>No pending or overdue invoices.</p>
                </div>
              </div>
            ) : (
              <>
                {overdueCount > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--danger-soft)' }}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                    <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                      {overdueCount} overdue
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--danger)' }}>
                      {fmt(receivables.totalOverduePaise)}
                    </span>
                  </div>
                )}
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {receivables.items.filter(r => r.paymentStatus === 'overdue').slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.projectName}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{r.label}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: 'var(--danger-text)' }}>
                        {fmt(r.amountPaise)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Vendor Deliveries Due */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">Vendor Deliveries Due</h3>
              </div>
              <Link href="/purchase-orders" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                All POs →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : upcomingPOs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                style={{ backgroundColor: 'var(--surface-muted)', border: '1px dashed var(--border-subtle)' }}>
                <Truck className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No deliveries due this week</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingPOs.map((po, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: 'var(--surface-muted)' }}>
                    <Truck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-base)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {po.vendorName ?? 'Unknown vendor'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{po.poNumber}</p>
                    </div>
                    {po.expectedDeliveryAt && (
                      <span className="text-[10px] font-semibold flex-shrink-0"
                        style={{ color: 'var(--warning-text)' }}>
                        {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     EMPLOYEE VIEW
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-fade-in p-6 lg:p-8">

      {/* Page heading */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--text-tertiary)' }}>
          My Workspace
        </p>
        <h1 className="text-4xl font-bold leading-none"
          style={{ color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
          Dashboard
        </h1>
      </div>

      {/* Hero banner */}
      <div className="rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
          <span className="text-xs font-medium" style={{ color: '#cbd5e1' }} suppressHydrationWarning>{todayLabel()}</span>
        </div>
        <p className="text-sm mb-1" style={{ color: '#94a3b8' }} suppressHydrationWarning>
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </p>
        <h2 className="text-2xl font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
          {myTasks.length > 0
            ? `${myTasks.length} task${myTasks.length !== 1 ? 's' : ''} pending today.`
            : 'All caught up. Have a great day!'}
        </h2>
        {myTasks.length > 0 && (
          <Link href="/tasks"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <CheckSquare className="h-3 w-3" />{myTasks.length} task{myTasks.length !== 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {/* My tasks + Today's visits */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyTasksWidget myTasks={myTasks} loading={loading} />
        <TodayVisitsWidget todayVisits={todayVisits} loading={loading} />
      </div>

      {/* My Projects */}
      <div className="premium-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            <h3 className="section-title">My Projects</h3>
          </div>
          <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
            All →
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : myProjects.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
            No active projects assigned to you.
          </p>
        ) : (
          <div className="space-y-1.5">
            {myProjects.map(p => {
              const pct = STAGE_PROGRESS[p.lifecycleStage] ?? 0;
              const s   = STAGE_META[p.lifecycleStage] ?? { label: p.lifecycleStage, bg: 'var(--surface-muted)', text: 'var(--text-secondary)' };
              const client = p.customerFullName || p.leadContactName;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="block rounded-xl border p-2.5 transition-colors hover:border-[var(--accent-base)]"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: s.bg, color: s.text }}>
                      {s.label}
                    </span>
                  </div>
                  {client && (
                    <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{client}</p>
                  )}
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-base)' }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="premium-card p-5">
        <h3 className="section-title mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-2">
          <QuickAction href="/tasks"       label="My Tasks"         icon={CheckSquare}  accent="purple" badge={myTasks.length} />
          <QuickAction href="/site-visits" label="Site Visits"      icon={Home}         accent="blue"   />
          <QuickAction href="/projects"    label="My Projects"      icon={FolderKanban} accent="orange" />
          <QuickAction href="/quotes"      label="Quotations"       icon={FileText}     accent="green"  />
        </div>

        <div className="mt-4 pt-4 flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <a href="tel:+919894331115"
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color: 'var(--text-secondary)' }}>
            <PhoneCall className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
            +91 98943 31115
          </a>
        </div>
      </div>
    </div>
  );
}
