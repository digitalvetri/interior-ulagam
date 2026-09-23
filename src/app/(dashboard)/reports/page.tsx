'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download, TrendingUp, TrendingDown, Users, FolderOpen,
  IndianRupee, AlertCircle, FileText, Calendar, RefreshCw,
  ArrowRight, Minus,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── types ────────────────────────────────────────────────────────────────────

interface KpiData {
  leads:            { curr: number; prev: number; changePct: number | null };
  newClients:       { curr: number; prev: number; changePct: number | null };
  activeProjects:   number;
  revenue:          { currPaise: number; prevPaise: number; changePct: number | null };
  outstandingPaise: number;
}
interface FunnelData {
  byStage:  { stage: string; count: number }[];
  bySource: { source: string; count: number }[];
  byMonth:  { month: string; count: number; won: number }[];
}
interface PipelineData {
  byStage: { stage: string; count: number; totalPaise: number }[];
  rows: { id: string; name: string; lifecycleStage: string; totalContractPaise: number; expectedEndAt: string | null; createdAt: string }[];
}
interface CollectionsData { byMonth: { month: string; count: number; totalPaise: number }[] }
interface ProfitabilityData {
  rows: {
    id: string; name: string; stage: string;
    contractPaise: number; expensesPaise: number; collectedPaise: number;
    marginPaise: number; marginPct: number;
  }[];
}
interface ActivityItem {
  id: string; type: 'lead' | 'project' | 'invoice' | 'payment' | 'expense';
  label: string; detail: string | null; date: string; amountPaise?: number;
}

// ─── date presets ─────────────────────────────────────────────────────────────

type Preset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function computeRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const p2  = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date)   => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const today = fmt(now);

  if (preset === 'today')      return { from: today, to: today };
  if (preset === 'this_week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (preset === 'this_month') {
    return { from: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-01`, to: today };
  }
  if (preset === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(s), to: fmt(e) };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: today };
  }
  if (preset === 'this_year') return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: today, to: today };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'this_week',    label: 'This Week' },
  { key: 'this_month',   label: 'This Month' },
  { key: 'last_month',   label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year',    label: 'This Year' },
];

// ─── labels ───────────────────────────────────────────────────────────────────

const LEAD_STAGE_ORDER = [
  'new','contacted','qualified','site_visit','measurement','quotation','negotiation','won','lost',
];
const LEAD_STAGE_LABEL: Record<string, string> = {
  new:'New', contacted:'Contacted', qualified:'Qualified', site_visit:'Site Visit',
  measurement:'Measurement', quotation:'Quotation', negotiation:'Negotiation', won:'Won', lost:'Lost',
};
const PROJ_STAGE_LABEL: Record<string, string> = {
  design_pending:'Design Pending', design_in_progress:'In Progress',
  design_approved:'Approved', procurement:'Procurement',
  execution:'Execution', snagging:'Snagging', handover:'Handover', complete:'Complete',
};
const SOURCE_LABEL: Record<string, string> = {
  instagram:'Instagram', whatsapp:'WhatsApp', referral:'Referral',
  website:'Website', walk_in:'Walk-in', other:'Other',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const rupees = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtK   = (p: number) => {
  const r = p / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(1)}Cr`;
  if (r >= 1_00_000)    return `₹${(r / 1_00_000).toFixed(1)}L`;
  if (r >= 1_000)       return `₹${(r / 1_000).toFixed(0)}K`;
  return rupees(p);
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const pct = (n: number, total: number) => total === 0 ? 0 : Math.round((n / total) * 100);

// ─── donut chart ──────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  'var(--accent-base)','#10b981','#f59e0b','#6366f1','#ec4899',
  '#14b8a6','#f97316','#8b5cf6','#06b6d4','#84cc16',
];

interface DonutSlice { label: string; value: number; color?: string }

function DonutChart({ slices, size = 120 }: { slices: DonutSlice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size * 0.38;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {total === 0 ? (
        <circle cx={c} cy={c} r={r} fill="none"
          stroke="var(--border-subtle)" strokeWidth={size * 0.14} />
      ) : slices.map((sl, i) => {
        const dash    = (sl.value / total) * circ;
        const offset  = -(cumulative / total) * circ;
        cumulative += sl.value;
        return (
          <circle key={i} cx={c} cy={c} r={r} fill="none"
            stroke={sl.color ?? DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={size * 0.14}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
          />
        );
      })}
      <circle cx={c} cy={c} r={r * 0.54} fill="var(--surface-card)" />
    </svg>
  );
}

// ─── bar chart ────────────────────────────────────────────────────────────────

function BarChart({ months }: { months: { month: string; totalPaise: number }[] }) {
  const maxVal = Math.max(...months.map(m => Number(m.totalPaise)), 1);
  // h-28 = 112px; reserve ~22px for label → 90px usable bar area
  const BAR_AREA = 90;
  return (
    <div className="flex items-end gap-[4px] h-28 w-full">
      {months.map((m, i) => {
        const barPx = Math.max(Math.round((Number(m.totalPaise) / maxVal) * BAR_AREA), 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-[2px] group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none"
              style={{ background: 'var(--text-heading)', color: 'var(--surface-page)' }}>
              {fmtK(Number(m.totalPaise))}
            </div>
            <div className="w-full rounded-t-sm" style={{
              height: `${barPx}px`,
              background: 'var(--accent-base)',
              opacity: i === months.length - 1 ? 1 : 0.65,
            }} />
            <span className="text-[9px] truncate w-full text-center" style={{ color: 'var(--text-tertiary)' }}>
              {m.month.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── delta badge ──────────────────────────────────────────────────────────────

function Delta({ changePct }: { changePct: number | null }) {
  if (changePct === null) return <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>—</span>;
  if (changePct === 0) return (
    <span className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
      <Minus className="w-3 h-3" />0%
    </span>
  );
  const up = changePct > 0;
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color: up ? 'var(--success)' : 'var(--destructive)' }}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{changePct}%
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, changePct, sub, accent }: {
  icon: React.ReactNode; label: string; value: string;
  changePct: number | null | undefined; sub: string; accent?: 'warning';
}) {
  const color = accent === 'warning' ? 'var(--warning, #f59e0b)' : 'var(--accent-base)';
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: 'var(--surface-muted)', color }}>{icon}</div>
        {changePct !== undefined ? <Delta changePct={changePct} /> : null}
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
      <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
    </div>
  );
}

// ─── primitives ───────────────────────────────────────────────────────────────

const SKEL_WIDTHS = ['90%','75%','85%','60%','80%','70%','95%','65%','78%','88%'];
function Skel({ h, w, className = '' }: { h?: string | number; w?: string | number; className?: string }) {
  return (
    <div className={`animate-pulse rounded ${className}`}
      style={{ height: h, width: w, background: 'var(--surface-muted)' }} />
  );
}
function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <FileText className="w-8 h-8 opacity-20" style={{ color: 'var(--text-secondary)' }} />
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
    </div>
  );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      {children}
    </div>
  );
}
function SecHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider mb-4"
      style={{ color: 'var(--accent-base)' }}>{children}</p>
  );
}

// ─── safe fetch helper ────────────────────────────────────────────────────────

async function safeJson(r: Response) {
  try { return r.ok ? await r.json() : null; } catch { return null; }
}

// ─── generate report (xlsx export) ───────────────────────────────────────────

function dlXlsx(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename);
}

async function exportReport(report: string, from: string, to: string) {
  const res  = await fetch(`/api/v1/reports/${report}?from=${from}&to=${to}`);
  const json = await res.json();
  const d    = json.data;
  if (!d) return;
  const rows: unknown[] = Array.isArray(d.rows)    ? d.rows
    : Array.isArray(d.byStage)  ? d.byStage
    : Array.isArray(d.byMonth)  ? d.byMonth
    : [];
  if (rows.length === 0) return;
  dlXlsx(rows as Record<string, unknown>[], `konst-${report}-${from}-to-${to}.xlsx`);
}

// ─── activity icon ────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const MAP: Record<ActivityItem['type'], { bg: string; fg: string; el: React.ReactNode }> = {
    lead:    { bg: 'rgba(99,102,241,.12)', fg: '#6366f1', el: <Users className="w-4 h-4" /> },
    project: { bg: 'rgba(16,185,129,.12)', fg: '#10b981', el: <FolderOpen className="w-4 h-4" /> },
    invoice: { bg: 'rgba(245,158,11,.12)', fg: '#f59e0b', el: <FileText className="w-4 h-4" /> },
    payment: { bg: 'rgba(16,185,129,.12)', fg: '#10b981', el: <IndianRupee className="w-4 h-4" /> },
    expense: { bg: 'rgba(239,68,68,.12)',  fg: '#ef4444', el: <ArrowRight className="w-4 h-4" /> },
  };
  const c = MAP[type];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ background: c.bg, color: c.fg }}>{c.el}</div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preset,     setPreset]     = useState<Preset>('this_month');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [mounted,    setMounted]    = useState(false);
  const [loading,    setLoading]    = useState(true);

  const [kpi,      setKpi]      = useState<KpiData | null>(null);
  const [funnel,   setFunnel]   = useState<FunnelData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [coll,     setColl]     = useState<CollectionsData | null>(null);
  const [profit,   setProfit]   = useState<ProfitabilityData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  // ── init after mount — avoids hydration mismatch ──────────────────────────
  useEffect(() => {
    setMounted(true);
    const r = computeRange('this_month');
    setFrom(r.from);
    setTo(r.to);
    setCustomFrom(r.from);
    setCustomTo(r.to);
  }, []);

  const fetchAll = useCallback(async (f: string, t: string) => {
    if (!f || !t) return;
    setLoading(true);
    const sp = `from=${f}&to=${t}`;
    try {
      const [kpiR, funnelR, pipeR, collR, profR, actR] = await Promise.all([
        fetch(`/api/v1/reports/summary?${sp}`),
        fetch(`/api/v1/reports/enquiry-funnel?${sp}`),
        fetch(`/api/v1/reports/project-pipeline?${sp}`),
        fetch(`/api/v1/reports/collections?${sp}`),
        fetch(`/api/v1/reports/profitability?${sp}`),
        fetch('/api/v1/reports/activity'),
      ]);
      const [kj, fj, pj, cj, prj, aj] = await Promise.all([
        safeJson(kpiR), safeJson(funnelR), safeJson(pipeR),
        safeJson(collR), safeJson(profR), safeJson(actR),
      ]);
      setKpi(kj?.data ?? null);
      setFunnel(fj?.data ?? null);
      setPipeline(pj?.data ?? null);
      setColl(cj?.data ?? null);
      setProfit(prj?.data ?? null);
      setActivity(aj?.data?.items ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (from && to) fetchAll(from, to); }, [from, to, fetchAll]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== 'custom') {
      const r = computeRange(p);
      setFrom(r.from); setTo(r.to);
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────

  // Always show all 9 lead stages so the full funnel is visible; 0-count stages are dimmed
  const funnelRows = LEAD_STAGE_ORDER
    .map(s => ({ stage: s, count: funnel?.byStage.find(b => b.stage === s)?.count ?? 0 }));
  const funnelMax = Math.max(...funnelRows.map(s => s.count), 1);

  const sourceSlices: DonutSlice[] = (funnel?.bySource ?? [])
    .filter(s => s.count > 0)
    .map((s, i) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.count, color: DONUT_COLORS[i] }));

  const projSlices: DonutSlice[] = (pipeline?.byStage ?? [])
    .filter(s => s.count > 0)
    .map((s, i) => ({ label: PROJ_STAGE_LABEL[s.stage] ?? s.stage, value: s.count, color: DONUT_COLORS[i] }));

  // Pad revenue to always show last 6 months so the chart never shows a single block
  const revenueMonths = (() => {
    const raw = coll?.byMonth ?? [];
    const end = to ? new Date(to) : new Date();
    const padded: { month: string; count: number; totalPaise: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const hit = raw.find(m => m.month.startsWith(key));
      padded.push(hit ?? { month: key, count: 0, totalPaise: 0 });
    }
    return padded;
  })();

  if (!mounted) return null;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Track your performance and business insights
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-secondary)' }}>
            <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-base)' }} />
            <span className="tabular-nums whitespace-nowrap">
              {from && to ? `${fmtDate(from)} — ${fmtDate(to)}` : '—'}
            </span>
          </div>
          <button onClick={() => fetchAll(from, to)} disabled={loading}
            className="p-2 rounded-xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
            title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              if (!profit?.rows.length) return;
              dlXlsx(profit.rows.map(r => ({
                Project: r.name, Stage: r.stage,
                'Contract (₹)': +(r.contractPaise / 100).toFixed(2),
                'Collected (₹)': +(r.collectedPaise / 100).toFixed(2),
                'Expenses (₹)': +(r.expensesPaise / 100).toFixed(2),
                'Margin (₹)': +(r.marginPaise / 100).toFixed(2),
                'Margin %': r.marginPct,
              })), `konst-profitability-${from}-to-${to}.xlsx`);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent-base)', color: '#fff' }}>
            <Download className="w-3.5 h-3.5" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Date presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: preset === p.key ? 'var(--accent-base)' : 'var(--surface-muted)',
              color:      preset === p.key ? '#fff'                : 'var(--text-secondary)',
            }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => applyPreset('custom')}
          className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors"
          style={{
            background: preset === 'custom' ? 'var(--accent-base)' : 'var(--surface-muted)',
            color:      preset === 'custom' ? '#fff'                : 'var(--text-secondary)',
          }}>
          Custom
        </button>
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm px-2 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-heading)' }} />
            <span style={{ color: 'var(--text-tertiary)' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-sm px-2 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-heading)' }} />
            <button
              onClick={() => { if (customFrom && customTo && customFrom <= customTo) { setFrom(customFrom); setTo(customTo); } }}
              className="px-3 py-1 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent-base)', color: '#fff' }}>
              Apply
            </button>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading || !kpi ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <Skel h={32} w={32} className="rounded-lg" />
            <Skel h={28} w="60%" />
            <Skel h={14} w="80%" />
          </div>
        )) : (<>
          <KpiCard icon={<Users className="w-4 h-4" />} label="Total Leads"
            value={String(kpi.leads.curr)} changePct={kpi.leads.changePct}
            sub={kpi.leads.prev > 0 ? `prev period: ${kpi.leads.prev}` : 'no data last period'} />
          <KpiCard icon={<Users className="w-4 h-4" />} label="New Clients"
            value={String(kpi.newClients.curr)} changePct={kpi.newClients.changePct}
            sub={kpi.newClients.prev > 0 ? `prev period: ${kpi.newClients.prev}` : 'no data last period'} />
          <KpiCard icon={<FolderOpen className="w-4 h-4" />} label="Active Projects"
            value={String(kpi.activeProjects)} changePct={undefined}
            sub="not yet completed" />
          <KpiCard icon={<IndianRupee className="w-4 h-4" />} label="Revenue Collected"
            value={fmtK(kpi.revenue.currPaise)} changePct={kpi.revenue.changePct}
            sub={kpi.revenue.prevPaise > 0 ? `prev period: ${fmtK(kpi.revenue.prevPaise)}` : 'no data last period'} />
          <KpiCard icon={<AlertCircle className="w-4 h-4" />} label="Outstanding"
            value={fmtK(kpi.outstandingPaise)} changePct={undefined}
            sub="unpaid milestones" accent="warning" />
        </>)}
      </div>

      {/* Funnel | Revenue | Generate Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Lead Conversion Funnel */}
        <Card>
          <SecHead>Lead Conversion Funnel</SecHead>
          {loading ? (
            <div className="space-y-2">
              {SKEL_WIDTHS.slice(0, 6).map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skel h={14} w={80} /> <Skel h={22} w={w} />
                </div>
              ))}
            </div>
          ) : !funnel ? <Empty label="No leads in this period" /> : (
            <div className="space-y-1.5">
              {funnelRows.map(s => (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-[11px] w-[84px] shrink-0 text-right truncate"
                    style={{ color: s.count > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                    {LEAD_STAGE_LABEL[s.stage] ?? s.stage}
                  </span>
                  <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
                    {s.count > 0 && (
                      <div className="h-full rounded-md flex items-center px-2"
                        style={{
                          width: `${pct(s.count, funnelMax)}%`,
                          background: s.stage === 'won' ? 'var(--success)'
                            : s.stage === 'lost' ? 'var(--destructive)'
                            : 'var(--accent-base)',
                          minWidth: 28,
                        }}>
                        <span className="text-[10px] font-semibold text-white">{s.count}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* Win rate summary */}
              {(() => {
                const total = funnelRows.reduce((s, x) => s + x.count, 0);
                const won   = funnelRows.find(s => s.stage === 'won')?.count  ?? 0;
                const lost  = funnelRows.find(s => s.stage === 'lost')?.count ?? 0;
                return (
                  <div className="mt-4 pt-3 border-t flex gap-6"
                    style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Win Rate</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>
                        {total > 0 ? pct(won, total) : 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Won</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>{won}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Lost</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--destructive)' }}>{lost}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>

        {/* Revenue Overview */}
        <Card>
          <SecHead>Revenue Overview</SecHead>
          {loading ? (
            <div className="space-y-3">
              <Skel h={112} w="100%" />
              <div className="flex justify-between">
                <Skel h={14} w="30%" /> <Skel h={14} w="20%" />
              </div>
            </div>
          ) : revenueMonths.length === 0 ? <Empty label="No payment data" /> : (
            <div className="space-y-4">
              <BarChart months={revenueMonths} />
              <div className="flex justify-between pt-2 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
                    {fmtK(revenueMonths.reduce((s, m) => s + Number(m.totalPaise), 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Payments</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
                    {revenueMonths.reduce((s, m) => s + m.count, 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Generate Reports */}
        <Card>
          <SecHead>Generate Reports</SecHead>
          <div className="space-y-1.5">
            {([
              { label: 'Lead Funnel',         report: 'enquiry-funnel' },
              { label: 'Project Pipeline',    report: 'project-pipeline' },
              { label: 'Revenue & Payments',  report: 'collections' },
              { label: 'Profitability',       report: 'profitability' },
              { label: 'Vendor Spend',        report: 'vendor-spend' },
            ] as const).map(r => (
              <button key={r.report}
                onClick={() => exportReport(r.report, from, to)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all group hover:opacity-80"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-base)' }} />
                  {r.label}
                </span>
                <Download className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            Downloads as Excel (.xlsx) for the selected date range.
          </p>
        </Card>
      </div>

      {/* Project Status | Top Lead Sources | Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <Card>
          <SecHead>Project Report</SecHead>
          {loading ? (
            <div className="flex items-center gap-4">
              <Skel h={110} w={110} className="rounded-full" />
              <div className="flex-1 space-y-2">
                {SKEL_WIDTHS.slice(0, 5).map((w, i) => <Skel key={i} h={14} w={w} />)}
              </div>
            </div>
          ) : projSlices.length === 0 ? <Empty label="No projects" /> : (
            <div className="flex items-center gap-4">
              <DonutChart slices={projSlices} size={110} />
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {projSlices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums shrink-0"
                      style={{ color: 'var(--text-heading)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SecHead>Top Lead Sources</SecHead>
          {loading ? (
            <div className="flex items-center gap-4">
              <Skel h={110} w={110} className="rounded-full" />
              <div className="flex-1 space-y-2">
                {SKEL_WIDTHS.slice(0, 5).map((w, i) => <Skel key={i} h={14} w={w} />)}
              </div>
            </div>
          ) : sourceSlices.length === 0 ? <Empty label="No lead data" /> : (
            <div className="flex items-center gap-4">
              <DonutChart slices={sourceSlices} size={110} />
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {(() => {
                  const total = sourceSlices.reduce((s, x) => s + x.value, 0);
                  return sourceSlices.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums shrink-0"
                        style={{ color: 'var(--text-heading)' }}>
                        {pct(s.value, total)}%
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SecHead>Recent Activity</SecHead>
          {loading || !activity ? (
            <div className="space-y-3">
              {SKEL_WIDTHS.slice(0, 6).map((w, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skel h={32} w={32} className="rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skel h={13} w={w} /> <Skel h={11} w="40%" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? <Empty label="No recent activity" /> : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {activity.map((item, i) => (
                <div key={item.id + i} className="flex items-start gap-2.5 pb-2.5 border-b last:border-0"
                  style={{ borderColor: 'var(--border-subtle)' }}>
                  <ActivityIcon type={item.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[12px] font-medium truncate leading-snug" style={{ color: 'var(--text-heading)' }}>
                        {item.label}
                      </p>
                      {item.amountPaise != null && item.amountPaise > 0 && (
                        <span className="text-[11px] font-semibold tabular-nums shrink-0"
                          style={{ color: item.type === 'expense' ? 'var(--destructive)' : 'var(--success)' }}>
                          {item.type === 'expense' ? '-' : '+'}{fmtK(item.amountPaise)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] capitalize px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
                        {item.type}
                      </span>
                      {item.detail && (
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {item.detail.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                        {item.date ? fmtDate(item.date) : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Profitability Table */}
      <Card>
        <SecHead>Project Profitability</SecHead>
        {loading || !profit ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={40} w="100%" />)}
          </div>
        ) : profit.rows.length === 0 ? <Empty label="No projects in this period" /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Project','Stage','Contract','Collected','Expenses','Margin','Margin %'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profit.rows.map((r, i) => (
                  <tr key={r.id}
                    style={{ background: i % 2 === 1 ? 'var(--surface-muted)' : 'transparent' }}>
                    <td className="px-5 py-3 font-medium max-w-[180px] truncate"
                      style={{ color: 'var(--text-heading)' }}>{r.name}</td>
                    <td className="px-5 py-3 text-[12px] whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {PROJ_STAGE_LABEL[r.stage] ?? r.stage}
                    </td>
                    <td className="px-5 py-3 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--text-heading)' }}>{fmtK(r.contractPaise)}</td>
                    <td className="px-5 py-3 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--success)' }}>{fmtK(r.collectedPaise)}</td>
                    <td className="px-5 py-3 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--destructive)' }}>{fmtK(r.expensesPaise)}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold whitespace-nowrap"
                      style={{ color: r.marginPaise >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
                      {r.marginPaise < 0 ? '-' : ''}{fmtK(Math.abs(r.marginPaise))}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{
                          background: r.marginPct >= 30 ? 'rgba(16,185,129,.15)'
                            : r.marginPct >= 10         ? 'rgba(245,158,11,.15)'
                            : 'rgba(239,68,68,.15)',
                          color: r.marginPct >= 30 ? 'var(--success)'
                            : r.marginPct >= 10    ? '#f59e0b'
                            : 'var(--destructive)',
                        }}>
                        {r.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
