'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FolderKanban, IndianRupee, TrendingUp,
  Plus, ChevronRight, AlertCircle, CheckCircle2, Clock, Target,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number; site_visit_scheduled: number; consultation_done: number;
  proposal_sent: number; negotiation: number; won: number; lost: number;
}
interface Project { id: string; name: string; lifecycleStage: string; totalContractPaise: number; }
interface Receivable { projectName: string; milestoneName: string; amountPaise: number; dueDays: number; id: string; }

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */
/* Attio pattern: label on top (small, quiet), then big tabular number,
   then sub. Icon lives inline with the label, not as a decorative badge. */
const KPI_ACCENTS = {
  purple: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  blue:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)' },
  orange: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)' },
  green:  { bg: 'var(--accent-green-bg)',  fg: 'var(--accent-green)' },
} as const;

function KpiCard({
  label, value, sub, icon: Icon, accent = 'purple', loading,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: keyof typeof KPI_ACCENTS; loading: boolean;
}) {
  const a = KPI_ACCENTS[accent];
  return (
    <div className="premium-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ backgroundColor: a.bg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: a.fg }} strokeWidth={2} />
        </span>
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-20 mb-1" />
      ) : (
        <p className="kpi-value">{value}</p>
      )}
      {sub && (
        <p className="mt-1.5 text-[12px] tnum" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Stage Badge ────────────────────────────────────────────────────────── */
function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    planning:     { label: 'Planning',     bg: 'var(--surface-app)', text: 'var(--teal)' },
    design:       { label: 'Design',       bg: 'var(--accent-orange-bg)', text: '#C2410C' },
    procurement:  { label: 'Procurement',  bg: 'var(--accent-blue-bg)', text: '#1D4ED8' },
    execution:    { label: 'Execution',    bg: 'var(--teal-soft)', text: 'var(--teal)' },
    complete:     { label: 'Complete',     bg: 'var(--accent-green-bg)',  text: '#15803D' },
  };
  const s = map[stage] ?? { label: stage, bg: 'var(--surface-muted)', text: 'var(--text-heading)' };
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
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
      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors duration-150"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-heading)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--border-subtle) 40%, ' + a.fg + ' 60%)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0"
        style={{ backgroundColor: a.bg }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: a.fg }} strokeWidth={2} />
      </div>
      <span className="text-[13px] font-medium">{label}</span>
      <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-60" />
    </Link>
  );
}

/* ── Funnel ─────────────────────────────────────────────────────────────── */
const FUNNEL_STAGES: { key: keyof LeadStats; label: string }[] = [
  { key: 'new',                  label: 'New' },
  { key: 'site_visit_scheduled', label: 'Site Visit' },
  { key: 'consultation_done',    label: 'Consultation' },
  { key: 'proposal_sent',        label: 'Proposal Sent' },
  { key: 'negotiation',          label: 'Negotiation' },
  { key: 'won',                  label: 'Won' },
];

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [leadStats, setLeadStats]     = useState<LeadStats | null>(null);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ls, ps, rs] = await Promise.all([
          fetch('/api/v1/leads/stats').then(r => r.json()),
          fetch('/api/v1/projects').then(r => r.json()),
          fetch('/api/v1/accounts/receivables').then(r => r.json()),
        ]);
        if (ls.data) setLeadStats(ls.data);
        if (Array.isArray(ps.data)) setProjects(ps.data.slice(0, 5));
        // API returns { data: { items: [...], totalOutstandingPaise, totalOverduePaise } }
        if (Array.isArray(rs.data?.items)) {
          setReceivables(
            rs.data.items.slice(0, 5).map((item: {
              id: string; projectName: string; label: string;
              amountPaise: number; daysSinceCreation: number;
            }) => ({
              id: item.id,
              projectName: item.projectName,
              milestoneName: item.label,
              amountPaise: item.amountPaise,
              dueDays: item.daysSinceCreation,
            }))
          );
        }
      } catch {
        /* silent — empty state shown */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalLeads   = leadStats ? Object.values(leadStats).reduce((a, b) => a + b, 0) : 0;
  const activeLeads  = leadStats ? totalLeads - (leadStats.won + leadStats.lost) : 0;
  const activeProj   = projects.filter(p => p.lifecycleStage !== 'complete').length;
  const totalRec     = receivables.reduce((s, r) => s + r.amountPaise, 0);
  const conversionPct = leadStats && totalLeads > 0
    ? Math.round((leadStats.won / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Everything happening across your studio right now.</p>
        </div>
        <Link
          href="/leads"
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New lead
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active leads"        value={String(activeLeads)}  sub={`${totalLeads} total`}            icon={Users}        accent="purple" loading={loading} />
        <KpiCard label="Active projects"     value={String(activeProj)}   sub={`${projects.length} total`}       icon={FolderKanban} accent="blue"   loading={loading} />
        <KpiCard label="Pending receivables" value={fmt(totalRec)}        sub={`${receivables.length} invoices`} icon={IndianRupee}  accent="orange" loading={loading} />
        <KpiCard label="Conversion rate"     value={`${conversionPct}%`}  sub={`${leadStats?.won ?? 0} won`}     icon={TrendingUp}   accent="green"  loading={loading} />
      </div>

      {/* Lead funnel + Projects side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Lead Funnel */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Lead Funnel</h3>
            <Link href="/leads" className="text-[12px] font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--forest)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-9 w-full" />)}
            </div>
          ) : !leadStats || totalLeads === 0 ? (
            <EmptyState icon={Target} message="No leads in your funnel yet." action={{ href: '/leads', label: 'Add Lead' }} />
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 min-w-0 space-y-1.5">
                {FUNNEL_STAGES.map((s, i, arr) => {
                  const base = leadStats.new || Math.max(...arr.map(x => leadStats[x.key]), 1);
                  const pct = Math.min(100 - i * 2, Math.max(16, base > 0 ? (leadStats[s.key] / base) * 100 : 100 - i * 14));
                  return (
                    <div key={s.key} className="h-9 flex items-center">
                      <div
                        className="h-9"
                        style={{
                          width: `${pct}%`,
                          background: 'var(--teal)',
                          opacity: 1 - i * 0.11,
                          clipPath: 'polygon(6% 0%, 94% 0%, 100% 100%, 0% 100%)',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex-shrink-0 space-y-1.5">
                {FUNNEL_STAGES.map(s => (
                  <div key={s.key} className="h-9 flex items-center justify-between gap-4 min-w-[9rem]">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{leadStats[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Active Projects</h3>
            <Link href="/projects" className="text-[12px] font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--forest)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState icon={FolderKanban} message="No active projects" detail="Create a new project to get started." action={{ href: '/projects', label: 'New Project' }} large />
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--surface-muted)' }}>
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(p.totalContractPaise ?? 0)}
                    </p>
                  </div>
                  <StageBadge stage={p.lifecycleStage} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Receivables + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Pending Receivables */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Pending Payments</h3>
            <Link href="/accounts" className="text-[12px] font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--forest)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
            </div>
          ) : receivables.length === 0 ? (
            <div
              className="flex items-center gap-4 rounded-xl p-5"
              style={{ backgroundColor: 'var(--accent-green-bg)' }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FFFFFF' }}>
                <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--accent-green)' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#15803D' }}>All payments up to date.</p>
                <p className="text-xs mt-0.5" style={{ color: '#166534' }}>Great job! No pending payments.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--surface-muted)' }}>
              {receivables.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.dueDays > 7
                      ? <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                      : <Clock className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-orange)' }} />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.projectName}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.milestoneName}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: 'var(--accent-orange)' }}>{fmt(r.amountPaise)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="premium-card p-5">
          <h3 className="section-title mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction href="/leads"           label="Add New Lead"         icon={Users}        accent="purple" />
            <QuickAction href="/quotes"          label="Create Quotation"    icon={Plus}         accent="orange" />
            <QuickAction href="/projects"        label="Create Project"      icon={FolderKanban} accent="blue" />
            <QuickAction href="/analytics/designers" label="View Reports"    icon={TrendingUp}   accent="green" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty State helper ─────────────────────────────────────────────────── */
function EmptyState({
  icon: Icon, message, detail, action, large = false,
}: {
  icon: React.ElementType;
  message: string;
  detail?: string;
  action?: { href: string; label: string };
  large?: boolean;
}) {
  if (large) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="relative mb-4" style={{ width: 72, height: 72 }}>
          <div className="absolute inset-0 rounded-2xl rotate-6" style={{ backgroundColor: 'var(--teal-soft)' }} />
          <div className="absolute inset-0 rounded-2xl -rotate-3 flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
            <Icon className="h-7 w-7" style={{ color: 'var(--teal)' }} />
          </div>
        </div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{message}</p>
        {detail && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{detail}</p>}
        {action && (
          <Link
            href={action.href}
            className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--surface-app)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
          style={{ backgroundColor: 'var(--teal-soft)' }}
        >
          <Icon className="h-4 w-4" style={{ color: 'var(--teal)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{message}</p>
          {detail && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{detail}</p>}
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="btn-primary flex-shrink-0 px-3 py-1.5 text-xs rounded-lg"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
