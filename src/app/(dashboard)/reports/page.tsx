'use client';
import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────────────────────
interface ByStageCount  { stage: string; count: number }
interface BySourceCount { source: string; count: number }
interface ByMonthLeads  { month: string; count: number; won: number }
interface EnquiryData   { byStage: ByStageCount[]; bySource: BySourceCount[]; byMonth: ByMonthLeads[] }

interface ByStatusQuote { status: string; count: number; totalPaise: number }
interface ByMonthQuote  { month: string; sent: number; accepted: number; rejected: number; totalPaise: number }
interface QuotationData { byStatus: ByStatusQuote[]; byMonth: ByMonthQuote[] }

interface ByStageProject { stage: string; count: number; totalPaise: number }
interface ProjectRow     { id: string; name: string; lifecycleStage: string; totalContractPaise: number; expectedEndAt: string | null; createdAt: string }
interface ProjectData    { byStage: ByStageProject[]; rows: ProjectRow[] }

interface CollMonth       { month: string; count: number; totalPaise: number }
interface CollectionsData { byMonth: CollMonth[] }

interface ProfRow           { id: string; name: string; stage: string; contractPaise: number; expensesPaise: number; collectedPaise: number; marginPaise: number; marginPct: number }
interface ProfitabilityData { rows: ProfRow[] }

interface VendorRow  { vendorId: string; vendorName: string; poCount: number; advancePaise: number; totalPaise: number }
interface VendorData { rows: VendorRow[] }

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
const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', revised: 'Revised', accepted: 'Accepted', rejected: 'Rejected',
};

type TabKey = 'overview' | 'leads' | 'quotations' | 'projects' | 'collections' | 'profitability' | 'procurement';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',      label: 'Overview' },
  { key: 'leads',         label: 'Lead Pipeline' },
  { key: 'quotations',    label: 'Quotations' },
  { key: 'projects',      label: 'Projects' },
  { key: 'collections',   label: 'Collections' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'procurement',   label: 'Procurement' },
];

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

type DR = { from: string; to: string };

// ── Data hook ──────────────────────────────────────────────────────────────
function useReport<T>(report: string, from: string, to: string) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (from) sp.set('from', from);
    if (to)   sp.set('to', to);
    fetch(`/api/v1/reports/${report}?${sp}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { setData(j.data ?? null); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [report, from, to]);

  return { data, loading, error };
}

// ── Shared UI ──────────────────────────────────────────────────────────────
function KPI({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
      ) : (
        <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: 'var(--text-heading)' }}>{value}</div>
      )}
      {sub && !loading && (
        <div className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>
      )}
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
      <span className="w-40 text-xs truncate shrink-0" style={{ color: 'var(--text-secondary)' }} title={label}>{label}</span>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${w}%`, background: color ?? 'var(--accent-base)' }} />
      </div>
      <span className="w-28 text-xs tabular-nums text-right shrink-0" style={{ color: 'var(--text-heading)' }}>{display}</span>
    </div>
  );
}

function VBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t-sm"
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`, background: 'var(--accent-base)', opacity: 0.85 }}
          />
          <span className="text-[9px] tabular-nums truncate w-full text-center" style={{ color: 'var(--text-tertiary)' }}>
            {d.label.length >= 7 ? d.label.slice(5) : d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ color: 'var(--text-tertiary)' }}>{children}</th>
  );
}
function TR({ children }: { children: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }} className="hover:bg-[var(--surface-muted)] transition-colors">
      {children}
    </tr>
  );
}
function SkelRows({ rows = 4, h = 'h-8' }: { rows?: number; h?: string }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${h} rounded-lg`} style={{ background: 'var(--surface-muted)' }} />
      ))}
    </div>
  );
}
function SectionError({ msg }: { msg: string }) {
  return <div className="rounded-xl px-5 py-4 text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>{msg}</div>;
}
function Empty() {
  return <p className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No data for this period</p>;
}
function ExportBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
      <Download className="w-3.5 h-3.5" /> Export
    </button>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────
function OverviewSection({ from, to }: DR) {
  const leads  = useReport<EnquiryData>('enquiry-funnel', from, to);
  const proj   = useReport<ProjectData>('project-pipeline', from, to);
  const coll   = useReport<CollectionsData>('collections', from, to);
  const profit = useReport<ProfitabilityData>('profitability', from, to);

  const totalLeads = (leads.data?.byStage ?? []).reduce((s, r) => s + r.count, 0);
  const wonLeads   = leads.data?.byStage.find(r => r.stage === 'won')?.count  ?? 0;
  const lostLeads  = leads.data?.byStage.find(r => r.stage === 'lost')?.count ?? 0;

  const activeProj  = (proj.data?.rows ?? []).filter(r => r.lifecycleStage !== 'complete').length;
  const pipelineVal = (proj.data?.rows ?? []).reduce((s, r) => s + (r.totalContractPaise ?? 0), 0);
  const totalColl   = (coll.data?.byMonth ?? []).reduce((s, r) => s + r.totalPaise, 0);
  const profRows    = profit.data?.rows ?? [];
  const avgMargin   = profRows.length ? Math.round(profRows.reduce((s, r) => s + r.marginPct, 0) / profRows.length) : 0;
  const maxProj     = Math.max(...(proj.data?.byStage ?? []).map(r => r.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI label="Total Leads"     value={String(totalLeads)} loading={leads.loading} />
        <KPI label="Win Rate"        value={`${pct(wonLeads, wonLeads + lostLeads)}%`} sub={`${wonLeads} won · ${lostLeads} lost`} loading={leads.loading} />
        <KPI label="Active Projects" value={String(activeProj)} loading={proj.loading} />
        <KPI label="Pipeline Value"  value={fmtK(pipelineVal)} loading={proj.loading} />
        <KPI label="Total Collected" value={fmtK(totalColl)} loading={coll.loading} />
        <KPI label="Avg Margin"      value={`${avgMargin}%`} sub="across all projects" loading={profit.loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Lead Enquiries by Month">
          {leads.loading
            ? <div className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
            : (leads.data?.byMonth ?? []).length === 0 ? <Empty />
            : <VBars data={(leads.data?.byMonth ?? []).slice(-12).map(r => ({ label: r.month, value: r.count }))} />}
        </Card>
        <Card title="Collections by Month">
          {coll.loading
            ? <div className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
            : (coll.data?.byMonth ?? []).length === 0 ? <Empty />
            : <VBars data={(coll.data?.byMonth ?? []).slice(-12).map(r => ({ label: r.month, value: r.totalPaise / 100 }))} />}
        </Card>
      </div>

      <Card title="Projects by Stage">
        {proj.loading
          ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
          : (proj.data?.byStage ?? []).every(r => r.count === 0) ? <Empty />
          : (
            <div className="space-y-2.5">
              {PROJECT_STAGE_ORDER.map(stage => {
                const row = proj.data?.byStage.find(r => r.stage === stage);
                if (!row || row.count === 0) return null;
                return <HBar key={stage} label={PROJECT_STAGE_LABEL[stage] ?? stage} value={row.count} max={maxProj} display={`${row.count} · ${fmtK(row.totalPaise)}`} />;
              })}
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Lead Pipeline ──────────────────────────────────────────────────────────
function LeadPipelineSection({ from, to }: DR) {
  const { data, loading, error } = useReport<EnquiryData>('enquiry-funnel', from, to);

  const total  = (data?.byStage  ?? []).reduce((s, r) => s + r.count, 0);
  const won    = data?.byStage.find(r => r.stage === 'won')?.count  ?? 0;
  const lost   = data?.byStage.find(r => r.stage === 'lost')?.count ?? 0;
  const maxSt  = Math.max(...(data?.byStage  ?? []).map(r => r.count), 1);
  const maxSrc = Math.max(...(data?.bySource ?? []).map(r => r.count), 1);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byStage.map(r  => ({ Stage: r.stage, Count: r.count }))), 'By Stage');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.bySource.map(r => ({ Source: r.source, Count: r.count }))), 'By Source');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byMonth.map(r  => ({ Month: r.month, Total: r.count, Won: r.won }))), 'By Month');
    XLSX.writeFile(wb, 'lead-pipeline.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Leads" value={String(total)} loading={loading} />
        <KPI label="Won"         value={String(won)}  sub={`${pct(won, total)}% of total`} loading={loading} />
        <KPI label="Lost"        value={String(lost)} sub={`${pct(lost, total)}% of total`} loading={loading} />
        <KPI label="Win Rate"    value={`${pct(won, won + lost)}%`} sub="won vs decided" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Stage Funnel" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
          {loading
            ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
            : (
              <div className="space-y-2.5">
                {LEAD_STAGE_ORDER.map(stage => {
                  const count = data?.byStage.find(r => r.stage === stage)?.count ?? 0;
                  const color = stage === 'won' ? 'var(--success)' : stage === 'lost' ? 'var(--danger)' : 'var(--accent-base)';
                  return <HBar key={stage} label={LEAD_STAGE_LABEL[stage]} value={count} max={maxSt} display={String(count)} color={color} />;
                })}
              </div>
            )}
        </Card>

        <Card title="Lead Sources">
          {loading
            ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
            : (data?.bySource ?? []).length === 0 ? <Empty />
            : (
              <div className="space-y-2.5">
                {[...(data?.bySource ?? [])].sort((a, b) => b.count - a.count).map(r => (
                  <HBar key={r.source} label={r.source ?? 'Other'} value={r.count} max={maxSrc}
                    display={`${r.count} (${pct(r.count, total)}%)`} />
                ))}
              </div>
            )}
        </Card>
      </div>

      <Card title="Monthly Trend">
        {loading
          ? <SkelRows rows={1} h="h-28" />
          : (data?.byMonth ?? []).length === 0 ? <Empty />
          : (
            <div className="space-y-5">
              <VBars data={(data?.byMonth ?? []).slice(-12).map(r => ({ label: r.month, value: r.count }))} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Month</TH><TH>Leads</TH><TH>Won</TH><TH>Win Rate</TH></tr></thead>
                  <tbody>
                    {(data?.byMonth ?? []).map((r, i) => (
                      <TR key={i}>
                        <td className="px-3 py-2.5 font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{r.month}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.count}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--success-text)' }}>{r.won}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct(r.won, r.count)}%</td>
                      </TR>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Quotations ─────────────────────────────────────────────────────────────
function QuotationsSection({ from, to }: DR) {
  const { data, loading, error } = useReport<QuotationData>('quotation-conversion', from, to);

  const total    = (data?.byStatus ?? []).reduce((s, r) => s + r.count, 0);
  const accepted = data?.byStatus.find(r => r.status === 'accepted')?.count ?? 0;
  const totalVal = (data?.byStatus ?? []).reduce((s, r) => s + r.totalPaise, 0);
  const maxSt    = Math.max(...(data?.byStatus ?? []).map(r => r.count), 1);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byStatus.map(r => ({ Status: r.status, Count: r.count, 'Value (₹)': r.totalPaise / 100 }))), 'By Status');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byMonth.map(r  => ({ Month: r.month, Sent: r.sent, Accepted: r.accepted, Rejected: r.rejected, 'Value (₹)': r.totalPaise / 100 }))), 'By Month');
    XLSX.writeFile(wb, 'quotations.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Quotes"      value={String(total)} loading={loading} />
        <KPI label="Accepted"          value={String(accepted)} sub={`${pct(accepted, total)}% conversion`} loading={loading} />
        <KPI label="Conversion Rate"   value={`${pct(accepted, total)}%`} loading={loading} />
        <KPI label="Total Quote Value" value={fmtK(totalVal)} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Status Breakdown" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
          {loading
            ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
            : (
              <div className="space-y-2.5">
                {(['accepted','sent','revised','rejected','draft'] as const).map(status => {
                  const row   = data?.byStatus.find(r => r.status === status);
                  const count = row?.count ?? 0;
                  const color = status === 'accepted' ? 'var(--success)' : status === 'rejected' ? 'var(--danger)' : 'var(--accent-base)';
                  return <HBar key={status} label={QUOTE_STATUS_LABEL[status]} value={count} max={maxSt}
                    display={`${count} · ${fmtK(row?.totalPaise ?? 0)}`} color={color} />;
                })}
              </div>
            )}
        </Card>

        <Card title="Quotes Sent by Month">
          {loading
            ? <div className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
            : (data?.byMonth ?? []).length === 0 ? <Empty />
            : <VBars data={(data?.byMonth ?? []).slice(-12).map(r => ({ label: r.month, value: r.sent }))} />}
        </Card>
      </div>

      <Card title="Monthly Breakdown">
        {loading
          ? <SkelRows rows={4} />
          : (data?.byMonth ?? []).length === 0 ? <Empty />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Month</TH><TH>Sent</TH><TH>Accepted</TH><TH>Rejected</TH><TH>Conversion</TH><TH>Value</TH></tr></thead>
                <tbody>
                  {(data?.byMonth ?? []).map((r, i) => (
                    <TR key={i}>
                      <td className="px-3 py-2.5 font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{r.month}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.sent}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--success-text)' }}>{r.accepted}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--danger-text)' }}>{r.rejected}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct(r.accepted, r.sent)}%</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-heading)' }}>{fmtK(r.totalPaise)}</td>
                    </TR>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Project Pipeline ────────────────────────────────────────────────────────
function ProjectsSection({ from, to }: DR) {
  const { data, loading, error } = useReport<ProjectData>('project-pipeline', from, to);

  const rows     = data?.rows ?? [];
  const total    = rows.length;
  const active   = rows.filter(r => !['complete', 'handover'].includes(r.lifecycleStage)).length;
  const totalVal = rows.reduce((s, r) => s + (r.totalContractPaise ?? 0), 0);
  const avgVal   = total > 0 ? totalVal / total : 0;
  const maxSt    = Math.max(...(data?.byStage ?? []).map(r => r.count), 1);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(r => ({
      Name: r.name, Stage: r.lifecycleStage,
      'Contract (₹)': (r.totalContractPaise ?? 0) / 100,
      'Expected End': r.expectedEndAt ? fmtDate(r.expectedEndAt) : '',
      Created: fmtDate(r.createdAt),
    }))), 'Projects');
    XLSX.writeFile(wb, 'project-pipeline.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Projects"    value={String(total)} loading={loading} />
        <KPI label="Active"            value={String(active)} loading={loading} />
        <KPI label="Pipeline Value"    value={fmtK(totalVal)} loading={loading} />
        <KPI label="Avg Project Value" value={fmtK(avgVal)} loading={loading} />
      </div>

      <Card title="Stage Distribution">
        {loading
          ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
          : (data?.byStage ?? []).length === 0 ? <Empty />
          : (
            <div className="space-y-2.5">
              {PROJECT_STAGE_ORDER.map(stage => {
                const row = data?.byStage.find(r => r.stage === stage);
                if (!row || row.count === 0) return null;
                return <HBar key={stage} label={PROJECT_STAGE_LABEL[stage] ?? stage} value={row.count} max={maxSt} display={`${row.count} · ${fmtK(row.totalPaise)}`} />;
              })}
            </div>
          )}
      </Card>

      <Card title="All Projects" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
        {loading
          ? <SkelRows rows={5} />
          : rows.length === 0 ? <Empty />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Project</TH><TH>Stage</TH><TH>Contract Value</TH><TH>Expected End</TH><TH>Created</TH></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <TR key={r.id}>
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{r.name}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                          {PROJECT_STAGE_LABEL[r.lifecycleStage] ?? r.lifecycleStage}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>{fmtK(r.totalContractPaise ?? 0)}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.expectedEndAt ? fmtDate(r.expectedEndAt) : '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(r.createdAt)}</td>
                    </TR>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Collections ─────────────────────────────────────────────────────────────
function CollectionsSection({ from, to }: DR) {
  const { data, loading, error } = useReport<CollectionsData>('collections', from, to);

  const months    = data?.byMonth ?? [];
  const totalColl = months.reduce((s, r) => s + r.totalPaise, 0);
  const avg       = months.length > 0 ? totalColl / months.length : 0;
  const peak      = months.reduce<CollMonth | null>((b, r) => (!b || r.totalPaise > b.totalPaise) ? r : b, null);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(months.map(r => ({ Month: r.month, Payments: r.count, 'Collected (₹)': r.totalPaise / 100 }))), 'Collections');
    XLSX.writeFile(wb, 'collections.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPI label="Total Collected" value={fmtK(totalColl)} loading={loading} />
        <KPI label="Avg per Month"   value={fmtK(avg)} loading={loading} />
        <KPI label="Peak Month"      value={peak?.month ?? '—'} sub={peak ? fmtK(peak.totalPaise) : undefined} loading={loading} />
      </div>

      <Card title="Monthly Collections" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
        {loading
          ? <div className="space-y-5"><div className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} /></div>
          : months.length === 0 ? <Empty />
          : (
            <div className="space-y-5">
              <VBars data={months.slice(-12).map(r => ({ label: r.month, value: r.totalPaise / 100 }))} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Month</TH><TH>Payments</TH><TH>Amount Collected</TH></tr></thead>
                  <tbody>
                    {months.map((r, i) => (
                      <TR key={i}>
                        <td className="px-3 py-2.5 font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{r.month}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.count}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>{fmt(r.totalPaise)}</td>
                      </TR>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Profitability ───────────────────────────────────────────────────────────
function ProfitabilitySection({ from, to }: DR) {
  const { data, loading, error } = useReport<ProfitabilityData>('profitability', from, to);

  const rows      = data?.rows ?? [];
  const totalRev  = rows.reduce((s, r) => s + r.contractPaise, 0);
  const totalExp  = rows.reduce((s, r) => s + r.expensesPaise, 0);
  const totalMgn  = totalRev - totalExp;
  const avgMgnPct = rows.length ? Math.round(rows.reduce((s, r) => s + r.marginPct, 0) / rows.length) : 0;
  const sorted    = [...rows].sort((a, b) => b.marginPct - a.marginPct);
  const maxMgn    = Math.max(...rows.map(r => Math.abs(r.marginPct)), 1);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(r => ({
      Project: r.name, Stage: r.stage,
      'Contract (₹)': r.contractPaise / 100, 'Expenses (₹)': r.expensesPaise / 100,
      'Margin (₹)': r.marginPaise / 100, 'Margin %': r.marginPct,
      'Collected (₹)': r.collectedPaise / 100,
    }))), 'Profitability');
    XLSX.writeFile(wb, 'profitability.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Portfolio Revenue" value={fmtK(totalRev)} loading={loading} />
        <KPI label="Total Expenses"    value={fmtK(totalExp)} loading={loading} />
        <KPI label="Gross Margin"      value={fmtK(totalMgn)} loading={loading} />
        <KPI label="Avg Margin %"      value={`${avgMgnPct}%`} loading={loading} />
      </div>

      <Card title="Margin by Project" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
        {loading
          ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
          : rows.length === 0 ? <Empty />
          : (
            <div className="space-y-2.5">
              {sorted.slice(0, 20).map(r => {
                const color = r.marginPct >= 25 ? 'var(--success)' : r.marginPct >= 10 ? 'var(--accent-base)' : 'var(--danger)';
                return <HBar key={r.id} label={r.name} value={Math.abs(r.marginPct)} max={maxMgn}
                  display={`${r.marginPct}% · ${fmtK(r.marginPaise)}`} color={color} />;
              })}
            </div>
          )}
      </Card>

      <Card title="Project Profitability">
        {loading
          ? <SkelRows rows={5} />
          : rows.length === 0 ? <Empty />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Project</TH><TH>Stage</TH><TH>Contract</TH><TH>Expenses</TH><TH>Margin</TH><TH>Margin %</TH><TH>Collected</TH></tr></thead>
                <tbody>
                  {sorted.map(r => {
                    const mc = r.marginPct >= 25 ? 'var(--success-text)' : r.marginPct >= 10 ? 'var(--text-heading)' : 'var(--danger-text)';
                    return (
                      <TR key={r.id}>
                        <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{r.name}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{PROJECT_STAGE_LABEL[r.stage] ?? r.stage}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtK(r.contractPaise)}</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtK(r.expensesPaise)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold" style={{ color: mc }}>{fmtK(r.marginPaise)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold" style={{ color: mc }}>{r.marginPct}%</td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtK(r.collectedPaise)}</td>
                      </TR>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Procurement ─────────────────────────────────────────────────────────────
function ProcurementSection({ from, to }: DR) {
  const { data, loading, error } = useReport<VendorData>('vendor-spend', from, to);

  const rows    = data?.rows ?? [];
  const totalPO = rows.reduce((s, r) => s + r.totalPaise, 0);
  const totalAd = rows.reduce((s, r) => s + r.advancePaise, 0);
  const maxPO   = Math.max(...rows.map(r => r.totalPaise), 1);

  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(r => ({
      Vendor: r.vendorName, POs: r.poCount,
      'PO Value (₹)': r.totalPaise / 100, 'Advance Paid (₹)': r.advancePaise / 100,
    }))), 'Vendor Spend');
    XLSX.writeFile(wb, 'vendor-spend.xlsx');
  };

  if (error) return <SectionError msg={error} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Vendors Used"   value={String(rows.length)} loading={loading} />
        <KPI label="Total PO Value" value={fmtK(totalPO)} loading={loading} />
        <KPI label="Advance Paid"   value={fmtK(totalAd)} loading={loading} />
        <KPI label="Advance %"      value={`${pct(totalAd, totalPO)}%`} sub="of total PO value" loading={loading} />
      </div>

      <Card title="Spend by Vendor" action={<ExportBtn onClick={exportXlsx} disabled={!data} />}>
        {loading
          ? <div className="space-y-2.5 animate-pulse">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 rounded-full" style={{ background: 'var(--surface-muted)' }} />)}</div>
          : rows.length === 0 ? <Empty />
          : (
            <div className="space-y-2.5">
              {rows.map(r => (
                <HBar key={r.vendorId} label={r.vendorName ?? '—'} value={r.totalPaise} max={maxPO}
                  display={`${r.poCount} POs · ${fmtK(r.totalPaise)}`} />
              ))}
            </div>
          )}
      </Card>

      <Card title="Vendor Breakdown">
        {loading
          ? <SkelRows rows={5} />
          : rows.length === 0 ? <Empty />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><TH>Vendor</TH><TH>POs</TH><TH>PO Value</TH><TH>Advance Paid</TH><TH>Advance %</TH></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <TR key={r.vendorId}>
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{r.vendorName ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.poCount}</td>
                      <td className="px-3 py-2.5 tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>{fmt(r.totalPaise)}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmt(r.advancePaise)}</td>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct(r.advancePaise, r.totalPaise)}%</td>
                    </TR>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to,   setTo]   = useState(now.toISOString().slice(0, 10));
  const [active, setActive] = useState<TabKey>('overview');
  const [seen,   setSeen]   = useState<Set<TabKey>>(() => new Set<TabKey>(['overview']));

  function goTo(tab: TabKey) {
    setActive(tab);
    setSeen(prev => new Set<TabKey>([...prev, tab]));
  }

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

      <div className="flex gap-0.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => goTo(t.key)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              color:        active === t.key ? 'var(--accent-text)' : 'var(--text-secondary)',
              borderBottom: active === t.key ? '2px solid var(--accent-base)' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {seen.has('overview')      && <div className={active !== 'overview'      ? 'hidden' : ''}><OverviewSection      from={from} to={to} /></div>}
      {seen.has('leads')         && <div className={active !== 'leads'         ? 'hidden' : ''}><LeadPipelineSection  from={from} to={to} /></div>}
      {seen.has('quotations')    && <div className={active !== 'quotations'    ? 'hidden' : ''}><QuotationsSection    from={from} to={to} /></div>}
      {seen.has('projects')      && <div className={active !== 'projects'      ? 'hidden' : ''}><ProjectsSection      from={from} to={to} /></div>}
      {seen.has('collections')   && <div className={active !== 'collections'   ? 'hidden' : ''}><CollectionsSection   from={from} to={to} /></div>}
      {seen.has('profitability') && <div className={active !== 'profitability' ? 'hidden' : ''}><ProfitabilitySection from={from} to={to} /></div>}
      {seen.has('procurement')   && <div className={active !== 'procurement'   ? 'hidden' : ''}><ProcurementSection   from={from} to={to} /></div>}
    </div>
  );
}
