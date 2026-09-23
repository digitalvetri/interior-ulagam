'use client';
import { useState } from 'react';
import { Download, TrendingUp, Users, FolderOpen, IndianRupee, BarChart2, Percent, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import * as XLSX from 'xlsx';
import { useReport } from './useReport';

// ── Types ──────────────────────────────────────────────────────────────────
interface ByStageCount  { stage: string; count: number }
interface BySourceCount { source: string; count: number }
interface ByMonthLeads  { month: string; count: number; won: number }
interface EnquiryData   { byStage: ByStageCount[]; bySource: BySourceCount[]; byMonth: ByMonthLeads[] }

interface ByStageProject { stage: string; count: number; totalPaise: number }
interface ProjectRow     { id: string; name: string; lifecycleStage: string; totalContractPaise: number; expectedEndAt: string | null; createdAt: string }
interface ProjectData    { byStage: ByStageProject[]; rows: ProjectRow[] }

interface CollMonth       { month: string; count: number; totalPaise: number }
interface CollectionsData { byMonth: CollMonth[] }

interface ProfRow           { id: string; name: string; stage: string; contractPaise: number; expensesPaise: number; collectedPaise: number; marginPaise: number; marginPct: number }
interface ProfitabilityData { rows: ProfRow[] }

// ── Constants ──────────────────────────────────────────────────────────────
const LEAD_STAGE_ORDER = ['new','contacted','qualified','site_visit','measurement','quotation','negotiation','won','lost'];
const LEAD_STAGE_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  site_visit: 'Site Visit', measurement: 'Measurement',
  quotation: 'Quotation', negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
};
const PROJECT_STAGE_ORDER = ['design_pending','design_in_progress','design_approved','procurement','execution','snagging','handover','complete'];
const PROJECT_STAGE_LABEL: Record<string, string> = {
  design_pending: 'Design Pending', design_in_progress: 'Design In Progress',
  design_approved: 'Design Approved', procurement: 'Procurement',
  execution: 'Execution', snagging: 'Snagging', handover: 'Handover', complete: 'Complete',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtK(paise: number): string {
  const val = paise / 100;
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`;
  if (val >= 100_000)    return `₹${(val / 100_000).toFixed(1)}L`;
  return fmt(paise);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

// ── Shared UI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, loading, icon: Icon, accent }: {
  label: string; value: string; sub?: string; loading?: boolean;
  icon?: React.ElementType; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5" style={{ color: accent ?? 'var(--accent-base)' }} />}
      </div>
      {loading
        ? <div className="h-7 w-20 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
        : <span className="text-2xl font-black tabular-nums leading-none" style={{ color: accent ?? 'var(--text-heading)' }}>{value}</span>
      }
      {sub && !loading && <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</span>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function HBar({ label, value, max, display, color }: { label: string; value: number; max: number; display: string; color?: string }) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs truncate shrink-0" style={{ color: 'var(--text-secondary)' }} title={label}>{label}</span>
      <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: color ?? 'var(--accent-base)' }} />
      </div>
      <span className="w-24 text-xs tabular-nums text-right shrink-0 font-medium" style={{ color: 'var(--text-heading)' }}>{display}</span>
    </div>
  );
}

function VBars({ data, height = 'h-32' }: { data: { label: string; value: number }[]; height?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={`flex items-end gap-1 ${height}`}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full rounded-t-sm transition-all duration-500"
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`, background: 'var(--accent-base)', opacity: 0.85 }} />
          <span className="text-[9px] tabular-nums truncate w-full text-center" style={{ color: 'var(--text-tertiary)' }}>
            {d.label.length >= 7 ? d.label.slice(5) : d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function SkelBars({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 rounded-full" style={{ background: 'var(--surface-muted)', width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No data for this period</p>;
}

// ── Export helpers ──────────────────────────────────────────────────────────
function exportLeads(data: EnquiryData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byStage.map(r => ({ Stage: r.stage, Count: r.count }))), 'By Stage');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.bySource.map(r => ({ Source: r.source, Count: r.count }))), 'By Source');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byMonth.map(r => ({ Month: r.month, Total: r.count, Won: r.won }))), 'By Month');
  XLSX.writeFile(wb, 'lead-pipeline.xlsx');
}
function exportProjects(data: ProjectData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rows.map(r => ({
    Name: r.name, Stage: r.lifecycleStage,
    'Contract (₹)': (r.totalContractPaise ?? 0) / 100,
    'Expected End': r.expectedEndAt ? fmtDate(r.expectedEndAt) : '',
    Created: fmtDate(r.createdAt),
  }))), 'Projects');
  XLSX.writeFile(wb, 'project-pipeline.xlsx');
}
function exportCollections(data: CollectionsData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byMonth.map(r => ({
    Month: r.month, Payments: r.count, 'Collected (₹)': r.totalPaise / 100,
  }))), 'Collections');
  XLSX.writeFile(wb, 'collections.xlsx');
}
function exportProfitability(data: ProfitabilityData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rows.map(r => ({
    Project: r.name, Stage: r.stage,
    'Contract (₹)': r.contractPaise / 100, 'Expenses (₹)': r.expensesPaise / 100,
    'Margin (₹)': r.marginPaise / 100, 'Margin %': r.marginPct,
    'Collected (₹)': r.collectedPaise / 100,
  }))), 'Profitability');
  XLSX.writeFile(wb, 'profitability.xlsx');
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to,   setTo]   = useState(now.toISOString().slice(0, 10));

  const leads  = useReport<EnquiryData>('enquiry-funnel', from, to);
  const proj   = useReport<ProjectData>('project-pipeline', from, to);
  const coll   = useReport<CollectionsData>('collections', from, to);
  const profit = useReport<ProfitabilityData>('profitability', from, to);

  // ── Derived values ─────────────────────────────────────────────────────
  const totalLeads  = (leads.data?.byStage ?? []).reduce((s, r) => s + r.count, 0);
  const wonLeads    = leads.data?.byStage.find(r => r.stage === 'won')?.count ?? 0;
  const lostLeads   = leads.data?.byStage.find(r => r.stage === 'lost')?.count ?? 0;
  const activeProj  = (proj.data?.rows ?? []).filter(r => r.lifecycleStage !== 'complete').length;
  const pipelineVal = (proj.data?.rows ?? []).reduce((s, r) => s + (r.totalContractPaise ?? 0), 0);
  const totalColl   = (coll.data?.byMonth ?? []).reduce((s, r) => s + r.totalPaise, 0);
  const profRows    = profit.data?.rows ?? [];
  const avgMargin   = profRows.length ? Math.round(profRows.reduce((s, r) => s + r.marginPct, 0) / profRows.length) : 0;
  const totalRev    = profRows.reduce((s, r) => s + r.contractPaise, 0);
  const totalExp    = profRows.reduce((s, r) => s + r.expensesPaise, 0);

  const maxStage  = Math.max(...(leads.data?.byStage ?? []).map(r => r.count), 1);
  const maxSource = Math.max(...(leads.data?.bySource ?? []).map(r => r.count), 1);
  const maxProj   = Math.max(...(proj.data?.byStage ?? []).map(r => r.count), 1);
  const sortedProfit = [...profRows].sort((a, b) => b.marginPct - a.marginPct);

  const datePicker = (
    <div className="flex items-center gap-2">
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-strong)', color: 'var(--text-heading)' }} />
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>to</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-strong)', color: 'var(--text-heading)' }} />
    </div>
  );

  return (
    <div className="px-6 py-6 space-y-6">
      <PageHeader title="Reports" subtitle="Business insights and performance analytics" actions={datePicker} />

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Total Leads"     value={String(totalLeads)}          icon={Users}        loading={leads.loading} />
        <KpiCard label="Win Rate"        value={`${pct(wonLeads, wonLeads + lostLeads)}%`}
          sub={`${wonLeads} won · ${lostLeads} lost`}                        icon={TrendingUp}   loading={leads.loading} accent="var(--success-text)" />
        <KpiCard label="Active Projects" value={String(activeProj)}          icon={FolderOpen}   loading={proj.loading} />
        <KpiCard label="Pipeline Value"  value={fmtK(pipelineVal)}           icon={BarChart2}    loading={proj.loading} accent="var(--accent-base)" />
        <KpiCard label="Total Collected" value={fmtK(totalColl)}             icon={IndianRupee}  loading={coll.loading} accent="var(--success-text)" />
        <KpiCard label="Avg Margin"      value={`${avgMargin}%`}
          sub="across all projects"                                           icon={Percent}      loading={profit.loading}
          accent={avgMargin >= 25 ? 'var(--success-text)' : avgMargin >= 10 ? 'var(--accent-base)' : 'var(--danger-text)'} />
      </div>

      {/* ── Main Grid: Lead Funnel + Collections | Export Panel ── */}
      <div className="grid xl:grid-cols-3 gap-6">

        {/* Left: Lead Funnel */}
        <div className="xl:col-span-1">
          <Card title="Lead Generation Funnel">
            {leads.loading ? <SkelBars rows={9} /> :
              (leads.data?.byStage ?? []).every(r => r.count === 0) ? <Empty /> :
              <div className="space-y-2.5">
                {LEAD_STAGE_ORDER.map(stage => {
                  const count = leads.data?.byStage.find(r => r.stage === stage)?.count ?? 0;
                  const color = stage === 'won' ? 'var(--success)' : stage === 'lost' ? 'var(--danger)' : 'var(--accent-base)';
                  return <HBar key={stage} label={LEAD_STAGE_LABEL[stage]} value={count} max={maxStage} display={String(count)} color={color} />;
                })}
              </div>
            }
          </Card>
        </div>

        {/* Middle: Collections chart */}
        <div className="xl:col-span-1">
          <Card title="Revenue Overview">
            {coll.loading
              ? <div className="h-32 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
              : (coll.data?.byMonth ?? []).length === 0 ? <Empty />
              : <VBars data={(coll.data?.byMonth ?? []).slice(-12).map(r => ({ label: r.month, value: r.totalPaise / 100 }))} />
            }
            <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Total Revenue</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'var(--success-text)' }}>{fmtK(totalRev)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Total Expenses</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'var(--danger-text)' }}>{fmtK(totalExp)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Export panel */}
        <div className="xl:col-span-1">
          <div className="rounded-2xl p-5 h-full flex flex-col gap-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-heading)' }}>Generate Reports</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Download data as Excel spreadsheets</p>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
              {[
                { label: 'Lead Pipeline Report',   sub: 'Stage funnel, sources, monthly trend', ready: !!leads.data,  onClick: () => leads.data && exportLeads(leads.data)   },
                { label: 'Project Pipeline Report', sub: 'All projects, stage distribution',     ready: !!proj.data,   onClick: () => proj.data && exportProjects(proj.data)   },
                { label: 'Collections Report',      sub: 'Monthly payment collections',          ready: !!coll.data,   onClick: () => coll.data && exportCollections(coll.data) },
                { label: 'Profitability Report',    sub: 'Margin per project',                   ready: !!profit.data, onClick: () => profit.data && exportProfitability(profit.data) },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} disabled={!item.ready}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:opacity-40"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-muted)'; }}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)' }}>
                    <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{item.label}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{item.sub}</p>
                  </div>
                  <Download className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center" style={{ color: 'var(--text-tertiary)' }}>
              Reports reflect the selected date range above
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Projects + Sources + Profitability ── */}
      <div className="grid xl:grid-cols-3 gap-6">

        {/* Projects by Stage */}
        <Card title="Projects by Stage">
          {proj.loading ? <SkelBars rows={6} /> :
            (proj.data?.byStage ?? []).every(r => r.count === 0) ? <Empty /> :
            <div className="space-y-2.5">
              {PROJECT_STAGE_ORDER.map(stage => {
                const row = proj.data?.byStage.find(r => r.stage === stage);
                if (!row || row.count === 0) return null;
                return <HBar key={stage} label={PROJECT_STAGE_LABEL[stage] ?? stage} value={row.count} max={maxProj}
                  display={`${row.count} · ${fmtK(row.totalPaise)}`} />;
              })}
            </div>
          }
        </Card>

        {/* Lead Sources */}
        <Card title="Top Lead Sources">
          {leads.loading ? <SkelBars rows={5} /> :
            (leads.data?.bySource ?? []).length === 0 ? <Empty /> :
            <div className="space-y-2.5">
              {[...(leads.data?.bySource ?? [])].sort((a, b) => b.count - a.count).map(r => (
                <HBar key={r.source} label={r.source ?? 'Other'} value={r.count} max={maxSource}
                  display={`${r.count} (${pct(r.count, totalLeads)}%)`} />
              ))}
            </div>
          }
        </Card>

        {/* Profitability */}
        <Card title="Project Profitability">
          {profit.loading
            ? <div className="space-y-3 animate-pulse">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-10 rounded-xl" style={{ background: 'var(--surface-muted)' }} />)}</div>
            : sortedProfit.length === 0 ? <Empty />
            : (
              <div className="space-y-2">
                {sortedProfit.slice(0, 6).map(r => {
                  const mc = r.marginPct >= 25 ? 'var(--success-text)' : r.marginPct >= 10 ? 'var(--accent-base)' : 'var(--danger-text)';
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface-muted)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-heading)' }}>{r.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{PROJECT_STAGE_LABEL[r.stage] ?? r.stage}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums" style={{ color: mc }}>{r.marginPct}%</p>
                        <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{fmtK(r.marginPaise)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      </div>

      {/* ── Monthly Trend Table ── */}
      <Card title="Monthly Activity">
        {leads.loading || coll.loading
          ? <div className="space-y-2 animate-pulse">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-10 rounded-xl" style={{ background: 'var(--surface-muted)' }} />)}</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Month','Leads','Won','Win Rate','Collections','Payments'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(leads.data?.byMonth ?? []).map((lm, i) => {
                    const cm = (coll.data?.byMonth ?? []).find(c => c.month === lm.month);
                    return (
                      <tr key={i} className="transition-colors"
                        style={{ background: i % 2 === 0 ? 'var(--surface-card)' : 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-3 font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{lm.month}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{lm.count}</td>
                        <td className="px-4 py-3 tabular-nums font-medium" style={{ color: 'var(--success-text)' }}>{lm.won}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct(lm.won, lm.count)}%</td>
                        <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>{cm ? fmt(cm.totalPaise) : '—'}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{cm?.count ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {(leads.data?.byMonth ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  );
}
