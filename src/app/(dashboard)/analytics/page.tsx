'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, ArrowRight, Users, FolderKanban, FileText, Wallet,
  Percent, IndianRupee, Loader2,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';

interface OverviewData {
  leads: {
    total: number; won: number; lost: number; open: number;
    conversionPct: number;
    byStage: { stage: string; count: number }[];
  };
  projects: { total: number; byStage: { stage: string; count: number }[] };
  quotes: {
    total: number; approved: number; approvedValuePaise: number; winPct: number;
    byStatus: { status: string; count: number; valuePaise: number }[];
  };
  finance: {
    totalInvoicedPaise: number;
    capturedPaise: number;
    outstandingPaise: number;
    paymentCount: number;
  };
  trend30d: { day: string; amountPaise: number }[];
}

const LEAD_STAGES = [
  { key: 'new',                     label: 'New' },
  { key: 'site_visit_scheduled',    label: 'Site visit' },
  { key: 'consultation_done',       label: 'Consulted' },
  { key: 'proposal_sent',           label: 'Proposal sent' },
  { key: 'negotiation',             label: 'Negotiation' },
  { key: 'won',                     label: 'Won' },
  { key: 'lost',                    label: 'Lost' },
];

const PROJECT_STAGES = [
  { key: 'design_pending',     label: 'Design pending',    color: 'bg-slate-400'    },
  { key: 'design_in_progress', label: 'Design in progress',color: 'bg-blue-500'     },
  { key: 'design_approved',    label: 'Design approved',   color: 'bg-cyan-500'     },
  { key: 'procurement',        label: 'Procurement',       color: 'bg-violet-500'   },
  { key: 'execution',          label: 'Execution',         color: 'bg-amber-500'    },
  { key: 'snagging',           label: 'Snagging',          color: 'bg-orange-500'   },
  { key: 'handover',           label: 'Handover',          color: 'bg-emerald-500'  },
  { key: 'complete',           label: 'Complete',          color: 'bg-emerald-700'  },
];

const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft:    'bg-slate-400',
  sent:     'bg-blue-500',
  approved: 'bg-emerald-600',
  rejected: 'bg-red-500',
  revised:  'bg-amber-500',
};

export default function AnalyticsOverviewPage() {
  const [data, setData]     = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/analytics/overview')
      .then((r) => r.json())
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-sm text-red-600">Failed to load analytics.</div>;
  }

  const paidRatio = data.finance.totalInvoicedPaise > 0
    ? Math.round((data.finance.capturedPaise / data.finance.totalInvoicedPaise) * 100)
    : 0;

  const trendMax = Math.max(1, ...data.trend30d.map((d) => d.amountPaise));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>Analytics</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Studio performance across leads, projects, quotes and revenue
          </p>
        </div>
        <Link
          href="/analytics/designers"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          style={{ color: 'var(--text-heading)' }}
        >
          Designer performance <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* KPI row */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi
            icon={Users}
            label="Leads (all-time)"
            value={data.leads.total.toLocaleString()}
            sub={`${data.leads.open} open · ${data.leads.won} won · ${data.leads.lost} lost`}
            accent="blue"
          />
          <Kpi
            icon={FolderKanban}
            label="Active projects"
            value={data.projects.total.toLocaleString()}
            sub={`${data.projects.byStage.find((s) => s.stage === 'complete')?.count ?? 0} completed`}
            accent="violet"
          />
          <Kpi
            icon={FileText}
            label="Approved quote value"
            value={formatRupees(data.quotes.approvedValuePaise)}
            sub={`${data.quotes.approved} of ${data.quotes.total} quotes approved`}
            accent="amber"
          />
          <Kpi
            icon={Wallet}
            label="Collected"
            value={formatRupees(data.finance.capturedPaise)}
            sub={`${formatRupees(data.finance.outstandingPaise)} outstanding`}
            accent="emerald"
          />
        </section>

        {/* Conversion + revenue trend row */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead conversion</h2>
              <Percent className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
                {data.leads.conversionPct}%
              </span>
              {data.leads.conversionPct >= 30 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" /> healthy
                </span>
              ) : data.leads.conversionPct > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <TrendingDown className="h-3.5 w-3.5" /> improve
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data.leads.won} won of {data.leads.won + data.leads.lost} decided
            </p>

            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {data.leads.won > 0 && (
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${(data.leads.won / Math.max(1, data.leads.won + data.leads.lost)) * 100}%` }}
                  />
                )}
                {data.leads.lost > 0 && (
                  <div
                    className="bg-red-400"
                    style={{ width: `${(data.leads.lost / Math.max(1, data.leads.won + data.leads.lost)) * 100}%` }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
                <span>Won</span><span>Lost</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quote win rate</h2>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>{data.quotes.winPct}%</span>
              <span className="text-xs text-slate-500">of decided quotes</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data.quotes.approved} approved · {data.quotes.total} total
            </p>

            <div className="mt-4 space-y-1.5">
              {data.quotes.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-2 text-xs">
                  <span className={'h-2 w-2 rounded-full ' + (QUOTE_STATUS_COLOR[s.status] ?? 'bg-slate-300')} />
                  <span className="w-16 capitalize text-slate-600 dark:text-slate-300">{s.status}</span>
                  <span className="ml-auto tabular-nums text-slate-500">{s.count}</span>
                  <span className="w-20 text-right tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(s.valuePaise)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800 lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Collection ratio</h2>
              <IndianRupee className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>{paidRatio}%</span>
              <span className="text-xs text-slate-500">collected</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatRupees(data.finance.capturedPaise)} of {formatRupees(data.finance.totalInvoicedPaise)}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${paidRatio}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Outstanding</span>
              <span className="tabular-nums font-medium text-red-600">
                {formatRupees(data.finance.outstandingPaise)}
              </span>
            </div>
          </div>
        </section>

        {/* Revenue trend sparkline */}
        <section className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Revenue — last 30 days</h2>
              <p className="mt-1 text-xs text-slate-500">Daily captured payments</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(data.trend30d.reduce((s, d) => s + d.amountPaise, 0))}
              </p>
              <p className="text-[11px] text-slate-500">30-day total</p>
            </div>
          </div>
          <div className="flex h-32 items-end gap-1">
            {data.trend30d.map((d) => {
              const h = trendMax > 0 ? (d.amountPaise / trendMax) * 100 : 0;
              return (
                <div
                  key={d.day}
                  className="group relative flex-1 rounded-t bg-emerald-100 transition-colors hover:bg-emerald-500 dark:bg-emerald-950/40 dark:hover:bg-emerald-500"
                  style={{ height: `${Math.max(h, 4)}%` }}
                  title={`${d.day}: ${formatRupees(d.amountPaise)}`}
                >
                  {d.amountPaise > 0 && (
                    <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
                      {formatRupees(d.amountPaise)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{data.trend30d[0]?.day}</span>
            <span>{data.trend30d[data.trend30d.length - 1]?.day}</span>
          </div>
        </section>

        {/* Lead funnel + project pipeline */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Lead funnel</h2>
            <Funnel
              stages={LEAD_STAGES.map((s) => {
                const c = data.leads.byStage.find((r) => r.stage === s.key)?.count ?? 0;
                return { label: s.label, count: c };
              })}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Project pipeline</h2>
            <div className="space-y-3">
              {PROJECT_STAGES.map((s) => {
                const c = data.projects.byStage.find((r) => r.stage === s.key)?.count ?? 0;
                const pct = data.projects.total > 0 ? (c / data.projects.total) * 100 : 0;
                return (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-heading)' }}>{s.label}</span>
                      <span className="tabular-nums text-slate-500">{c}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={'h-full rounded-full ' + s.color} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {data.projects.total === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">No projects yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Kpi({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: 'blue' | 'violet' | 'amber' | 'emerald';
}) {
  const bg = {
    blue:    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    violet:  'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--surface-card)] p-5 shadow-sm dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <span className={'flex h-9 w-9 items-center justify-center rounded-lg ' + bg}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const w = (s.count / max) * 100;
        const isWonLost = s.label === 'Won' || s.label === 'Lost';
        const color = s.label === 'Won'  ? 'bg-emerald-500'
                    : s.label === 'Lost' ? 'bg-red-400'
                    : 'bg-slate-400';
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0 text-xs text-slate-600 dark:text-slate-400" style={{ opacity: isWonLost ? 1 : 0.9 }}>
              {s.label}
            </div>
            <div className="relative flex-1 rounded bg-slate-100 dark:bg-slate-800">
              <div
                className={'h-6 rounded ' + color}
                style={{ width: `${Math.max(w, s.count > 0 ? 6 : 0)}%`, opacity: 0.15 + (i / stages.length) * 0.75 }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {s.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
