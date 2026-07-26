'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderKanban,
  IndianRupee,
  TrendingUp,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  ArrowUpRight,
  Command,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number;
  site_visit_scheduled: number;
  consultation_done: number;
  proposal_sent: number;
  negotiation: number;
  won: number;
  lost: number;
}
interface Project {
  id: string;
  name: string;
  lifecycleStage: string;
  totalContractPaise: number;
}
interface Receivable {
  projectName: string;
  milestoneName: string;
  amountPaise: number;
  dueDays: number;
}

function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtCompact(paise: number) {
  const n = paise / 100;
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  delta,
  positive = true,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="eyebrow">{label}</span>
        <span className="stat-badge">
          <Icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </span>
      </div>
      <div className="mt-5">
        {loading ? (
          <div className="skeleton h-10 w-28" />
        ) : (
          <p className="kpi-value">{value}</p>
        )}
      </div>
      {delta && !loading && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`chip ${positive ? 'chip--pos' : 'chip--neg'}`}>
            <ArrowUpRight
              className={`h-3 w-3 ${positive ? '' : 'rotate-90'}`}
              strokeWidth={2.5}
            />
            {delta}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Stage badge ────────────────────────────────────────────────────────── */
function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    planning:    { label: 'Planning',    cls: 'chip chip--acc' },
    design:      { label: 'Design',      cls: 'chip chip--acc' },
    procurement: { label: 'Procurement', cls: 'chip chip--warn' },
    execution:   { label: 'Execution',   cls: 'chip chip--acc' },
    complete:    { label: 'Complete',    cls: 'chip chip--pos' },
  };
  const s = map[stage] ?? { label: stage, cls: 'chip' };
  return <span className={s.cls}>{s.label}</span>;
}

/* ── Quick action row ───────────────────────────────────────────────────── */
function QuickAction({
  href,
  label,
  hint,
  icon: Icon,
  shortcut,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  shortcut?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 py-3 border-b last:border-b-0 transition-colors hover:bg-[color:var(--panel-hi)] -mx-2 px-2 rounded-md"
      style={{ borderColor: 'var(--line)' }}
    >
      <span className="stat-badge">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-4)' }}>
          {hint}
        </p>
      </div>
      {shortcut && <span className="kbd">{shortcut}</span>}
      <ChevronRight
        className="h-4 w-4 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-90"
        strokeWidth={1.75}
      />
    </Link>
  );
}

const FUNNEL_STAGES: { key: keyof LeadStats; label: string }[] = [
  { key: 'new',                  label: 'New' },
  { key: 'site_visit_scheduled', label: 'Site visit' },
  { key: 'consultation_done',    label: 'Consultation' },
  { key: 'proposal_sent',        label: 'Proposal sent' },
  { key: 'negotiation',          label: 'Negotiation' },
  { key: 'won',                  label: 'Won' },
];

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ls, ps, rs] = await Promise.all([
          fetch('/api/v1/leads/stats').then((r) => r.json()),
          fetch('/api/v1/projects').then((r) => r.json()),
          fetch('/api/v1/accounts/receivables').then((r) => r.json()),
        ]);
        if (ls.data) setLeadStats(ls.data);
        if (ps.data) setProjects(ps.data.slice(0, 5));
        if (rs.data) setReceivables(rs.data.slice(0, 5));
      } catch {
        /* silent — empty state shown */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalLeads = leadStats ? Object.values(leadStats).reduce((a, b) => a + b, 0) : 0;
  const activeLeads = leadStats ? totalLeads - (leadStats.won + leadStats.lost) : 0;
  const activeProj = projects.filter((p) => p.lifecycleStage !== 'complete').length;
  const totalRec = receivables.reduce((s, r) => s + r.amountPaise, 0);
  const conversionPct =
    leadStats && totalLeads > 0 ? Math.round((leadStats.won / totalLeads) * 100) : 0;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Hero — big italic-serif accent, live status, primary + secondary CTAs */}
      <section className="card p-8 relative overflow-hidden">
        {/* Ambient accent glow anchored top-right */}
        <div
          className="absolute -top-24 -right-16 w-[24rem] h-[24rem] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--acc-glow) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="live-dot" />
              <span className="eyebrow">Live · {today}</span>
            </div>
            <h2 className="display display-xl mt-4">
              Studio, <span className="serif-em">today.</span>
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: '36rem' }}>
              Pipeline, projects in flight, and receivables — in one view.
              Numbers update as they change.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/leads"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              New lead
              <span className="kbd ml-1" style={{ background: 'rgba(0,0,0,0.25)', color: 'var(--bg)', borderColor: 'transparent' }}>N</span>
            </Link>
            <Link
              href="/projects"
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5"
            >
              <Command className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open command
              <span className="kbd ml-1">⌘K</span>
            </Link>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active leads"
          value={String(activeLeads)}
          delta={`${totalLeads} total`}
          positive
          icon={Users}
          loading={loading}
        />
        <KpiCard
          label="Projects in flight"
          value={String(activeProj)}
          delta={`${projects.length} on the books`}
          positive
          icon={FolderKanban}
          loading={loading}
        />
        <KpiCard
          label="Pending receivables"
          value={fmtCompact(totalRec)}
          delta={`${receivables.length} invoices`}
          positive={false}
          icon={IndianRupee}
          loading={loading}
        />
        <KpiCard
          label="Conversion"
          value={`${conversionPct}%`}
          delta={`${leadStats?.won ?? 0} won`}
          positive
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* Row 2: funnel + projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-6">
          <SectionHead title="Lead funnel" href="/leads" cta="Open pipeline" />
          {loading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-7 w-full" />
              ))}
            </div>
          ) : !leadStats || totalLeads === 0 ? (
            <EmptyState icon={Target} message="No leads yet" action={{ href: '/leads', label: 'Add lead' }} />
          ) : (
            <ul className="mt-5 space-y-2.5">
              {FUNNEL_STAGES.map((s, i, arr) => {
                const count = leadStats[s.key];
                const max = Math.max(...arr.map((x) => leadStats[x.key]), 1);
                const pct = Math.max(6, (count / max) * 100);
                const won = s.key === 'won';
                return (
                  <li key={s.key} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-4">
                    <span className="text-sm" style={{ color: 'var(--ink-3)' }}>
                      {s.label}
                    </span>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--panel-hi)' }}>
                      <div
                        className="h-full transition-all duration-700 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: won
                            ? 'linear-gradient(90deg, var(--acc), var(--acc-hi))'
                            : 'var(--ink-2)',
                          boxShadow: won ? '0 0 8px var(--acc-glow)' : undefined,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-right num" style={{ color: 'var(--ink)' }}>
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <SectionHead title="Projects in flight" href="/projects" cta="View all" />
          {loading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState icon={FolderKanban} message="No active projects" detail="Create one from a won lead." action={{ href: '/projects', label: 'New project' }} large />
          ) : (
            <ul className="mt-5 divide-y" style={{ borderColor: 'var(--line)' }}>
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {p.name}
                    </p>
                    <p className="text-xs mt-0.5 num" style={{ color: 'var(--ink-4)' }}>
                      {fmt(p.totalContractPaise ?? 0)}
                    </p>
                  </div>
                  <StageBadge stage={p.lifecycleStage} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Row 3: receivables + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-6">
          <SectionHead title="Pending payments" href="/accounts" cta="Open ledger" />
          {loading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : receivables.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-lg p-4" style={{ background: 'var(--pos-tint)', border: '1px solid transparent' }}>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--pos)' }} strokeWidth={2} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--pos)' }}>
                  All squared away.
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  Nothing outstanding.
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-5 divide-y" style={{ borderColor: 'var(--line)' }}>
              {receivables.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 border"
                      style={{
                        background: r.dueDays > 7 ? 'var(--neg-tint)' : 'var(--warn-tint)',
                        color: r.dueDays > 7 ? 'var(--neg)' : 'var(--warn)',
                        borderColor: 'transparent',
                      }}
                    >
                      {r.dueDays > 7 ? <AlertCircle className="h-4 w-4" strokeWidth={2} /> : <Clock className="h-4 w-4" strokeWidth={2} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {r.projectName}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--ink-4)' }}>
                        {r.milestoneName}
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-sm font-semibold num flex-shrink-0"
                    style={{ color: r.dueDays > 7 ? 'var(--neg)' : 'var(--warn)' }}
                  >
                    {fmt(r.amountPaise)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <SectionHead title="Quick actions" />
          <div className="mt-3">
            <QuickAction href="/leads" label="Add a new lead" hint="Start a fresh conversation" icon={Users} shortcut="N" />
            <QuickAction href="/quotes" label="Draft quotation" hint="With GST + margins" icon={Plus} shortcut="Q" />
            <QuickAction href="/projects" label="Start a project" hint="From a won lead" icon={FolderKanban} shortcut="P" />
            <QuickAction href="/analytics/designers" label="Designer reports" hint="Team utilisation" icon={TrendingUp} shortcut="R" />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SectionHead({
  title,
  href,
  cta,
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="section-title">{title}</h3>
      {href && cta && (
        <Link
          href={href}
          className="text-xs font-medium inline-flex items-center gap-1 group"
          style={{ color: 'var(--acc)' }}
        >
          {cta}
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </Link>
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({
  icon: Icon,
  message,
  detail,
  action,
  large = false,
}: {
  icon: React.ElementType;
  message: string;
  detail?: string;
  action?: { href: string; label: string };
  large?: boolean;
}) {
  if (large) {
    return (
      <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-lg py-12 text-center" style={{ background: 'var(--bg-2)', border: '1px dashed var(--line-strong)' }}>
        <div className="stat-badge" style={{ width: 44, height: 44, color: 'var(--acc)' }}>
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {message}
        </p>
        {detail && (
          <p className="text-xs max-w-xs" style={{ color: 'var(--ink-3)' }}>
            {detail}
          </p>
        )}
        {action && (
          <Link href={action.href} className="btn-primary inline-flex items-center gap-1.5 mt-2 px-4 py-2">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {action.label}
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="mt-5 flex items-center justify-between gap-4 rounded-lg p-4" style={{ background: 'var(--bg-2)', border: '1px dashed var(--line-strong)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ink-3)' }} strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {message}
          </p>
          {detail && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {detail}
            </p>
          )}
        </div>
      </div>
      {action && (
        <Link href={action.href} className="btn-primary flex-shrink-0 px-3.5 py-2 text-xs">
          {action.label}
        </Link>
      )}
    </div>
  );
}
