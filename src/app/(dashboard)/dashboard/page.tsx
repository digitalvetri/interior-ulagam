'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FolderKanban, IndianRupee, TrendingUp,
  Plus, ArrowRight, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number; site_visit_scheduled: number; consultation_done: number;
  proposal_sent: number; negotiation: number; won: number; lost: number;
}
interface Project { id: string; name: string; lifecycleStage: string; totalContractPaise: number; }
interface Receivable { projectName: string; milestoneName: string; amountPaise: number; dueDays: number; }

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, gold = false, loading,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; gold?: boolean; loading: boolean;
}) {
  return (
    <div className="premium-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: gold ? 'rgba(200,155,60,0.12)' : 'rgba(111,78,55,0.10)' }}
        >
          <Icon className="h-5 w-5" style={{ color: gold ? '#C89B3C' : '#6F4E37' }} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24 mb-1" />
      ) : (
        <p className="kpi-value" style={gold ? { color: '#C89B3C' } : {}}>{value}</p>
      )}
      <p className="mt-1 text-sm font-medium" style={{ color: '#3D2314' }}>{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: '#6B6B6B' }}>{sub}</p>}
    </div>
  );
}

/* ── Stage Badge ────────────────────────────────────────────────────────── */
function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    planning:     { label: 'Planning',     bg: '#F8F5F2', text: '#6F4E37' },
    design:       { label: 'Design',       bg: 'rgba(200,155,60,0.12)', text: '#C89B3C' },
    procurement:  { label: 'Procurement',  bg: 'rgba(111,78,55,0.10)', text: '#5A3E2B' },
    execution:    { label: 'Execution',    bg: 'rgba(200,155,60,0.18)', text: '#6F4E37' },
    complete:     { label: 'Complete',     bg: 'rgba(34,197,94,0.10)',  text: '#15803D' },
  };
  const s = map[stage] ?? { label: stage, bg: '#E9DFD3', text: '#6F4E37' };
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
function QuickAction({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#C8B7A6',
        boxShadow: '0 1px 4px rgba(75,46,43,0.06)',
        color: '#3D2314',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
        style={{ backgroundColor: 'rgba(111,78,55,0.10)' }}
      >
        <Icon className="h-4 w-4" style={{ color: '#6F4E37' }} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <ArrowRight className="ml-auto h-4 w-4 opacity-40" />
    </Link>
  );
}

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
        if (ls.data)  setLeadStats(ls.data);
        if (ps.data)  setProjects(ps.data.slice(0, 5));
        if (rs.data)  setReceivables(rs.data.slice(0, 5));
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>
            Complete overview of The Interior Studio
          </p>
        </div>
        <Link
          href="/leads"
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
        >
          <Plus className="h-4 w-4" />
          New Lead
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Leads"    value={String(activeLeads)}  sub={`${totalLeads} total`}          icon={Users}        loading={loading} />
        <KpiCard label="Active Projects" value={String(activeProj)}   sub={`${projects.length} total`}     icon={FolderKanban} loading={loading} />
        <KpiCard label="Pending Receivables" value={fmt(totalRec)}    sub={`${receivables.length} invoices`} icon={IndianRupee} gold loading={loading} />
        <KpiCard label="Conversion Rate" value={`${conversionPct}%`}  sub={`${leadStats?.won ?? 0} won`}   icon={TrendingUp}   gold loading={loading} />
      </div>

      {/* Lead funnel + Projects side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Lead Funnel */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Lead Funnel</h3>
            <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: '#6F4E37' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-7 w-full" />)}
            </div>
          ) : !leadStats || totalLeads === 0 ? (
            <EmptyState icon={Users} message="No leads yet." action={{ href: '/leads', label: 'Add your first lead' }} />
          ) : (
            <div className="space-y-2">
              {([
                ['New',               leadStats.new],
                ['Site Visit',        leadStats.site_visit_scheduled],
                ['Consultation Done', leadStats.consultation_done],
                ['Proposal Sent',     leadStats.proposal_sent],
                ['Negotiation',       leadStats.negotiation],
                ['Won',               leadStats.won],
                ['Lost',              leadStats.lost],
              ] as [string, number][]).map(([label, count]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-32 text-xs" style={{ color: '#6B6B6B' }}>{label}</span>
                  <div className="flex-1 progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: totalLeads > 0 ? `${(count / totalLeads) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold" style={{ color: '#3D2314' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Active Projects</h3>
            <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: '#6F4E37' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState icon={FolderKanban} message="No projects yet." action={{ href: '/projects', label: 'Start a project' }} />
          ) : (
            <div className="divide-y" style={{ borderColor: '#E9DFD3' }}>
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1C1C1C' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B6B6B' }}>
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
            <Link href="/accounts" className="text-xs font-semibold hover:underline" style={{ color: '#6F4E37' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
            </div>
          ) : receivables.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="All payments up to date." />
          ) : (
            <div className="divide-y" style={{ borderColor: '#E9DFD3' }}>
              {receivables.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.dueDays > 7
                      ? <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                      : <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#C89B3C' }} />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1C1C' }}>
                        {r.projectName}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#6B6B6B' }}>{r.milestoneName}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold ml-3 flex-shrink-0 kpi-gold">{fmt(r.amountPaise)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="premium-card p-5">
          <h3 className="section-title mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <QuickAction href="/leads"           label="Add New Lead"       icon={Users} />
            <QuickAction href="/projects"        label="Create Project"     icon={FolderKanban} />
            <QuickAction href="/quotes"          label="New Quotation"      icon={Plus} />
            <QuickAction href="/purchase-orders" label="Raise Purchase Order" icon={IndianRupee} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty State helper ─────────────────────────────────────────────────── */
function EmptyState({
  icon: Icon, message, action,
}: {
  icon: React.ElementType;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
        style={{ backgroundColor: 'rgba(111,78,55,0.08)' }}
      >
        <Icon className="h-6 w-6" style={{ color: '#C8B7A6' }} />
      </div>
      <p className="text-sm" style={{ color: '#6B6B6B' }}>{message}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 text-xs font-semibold hover:underline"
          style={{ color: '#6F4E37' }}
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
