'use client';
import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import * as XLSX from 'xlsx';

/* ── Types ───────────────────────────────────────────────────────────────── */
type Report =
  | 'enquiry-funnel'
  | 'quotation-conversion'
  | 'project-pipeline'
  | 'collections'
  | 'profitability'
  | 'vendor-spend';

const REPORTS: { key: Report; label: string; subtitle: string }[] = [
  { key: 'enquiry-funnel',       label: 'Enquiry Funnel',        subtitle: 'Leads by stage, source, and month' },
  { key: 'quotation-conversion', label: 'Quotation Conversion',  subtitle: 'Quote sent vs accepted rates by month' },
  { key: 'project-pipeline',     label: 'Project Pipeline',      subtitle: 'Projects by stage with contract values' },
  { key: 'collections',          label: 'Collections',           subtitle: 'Payments received by month and mode' },
  { key: 'profitability',        label: 'Profitability',         subtitle: 'Revenue vs expenses per project' },
  { key: 'vendor-spend',         label: 'Vendor Spend',          subtitle: 'Purchase order value by vendor' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function downloadXlsx(sheetData: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename + '.xlsx');
}

/* ── Table ───────────────────────────────────────────────────────────────── */
function ReportTable({
  columns, rows,
}: { columns: { key: string; label: string; money?: boolean }[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm py-6 text-center" style={{ color: 'var(--text-secondary)' }}>No data for this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {columns.map(c => (
              <th
                key={c.key}
                className="text-left pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {columns.map(c => (
                <td key={c.key} className="py-2 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {c.money
                    ? fmt(Number(row[c.key] ?? 0))
                    : String(row[c.key] ?? '—')
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Report renderers ────────────────────────────────────────────────────── */
function EnquiryFunnelReport({ data, onExport }: { data: { byStage: Record<string, unknown>[]; bySource: Record<string, unknown>[]; byMonth: Record<string, unknown>[] }; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>By Stage</h4>
        <ReportTable
          columns={[{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Count' }]}
          rows={data.byStage}
        />
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>By Source</h4>
        <ReportTable
          columns={[{ key: 'source', label: 'Source' }, { key: 'count', label: 'Count' }]}
          rows={data.bySource}
        />
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Monthly trend</h4>
        <ReportTable
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'count', label: 'Enquiries' },
            { key: 'won',   label: 'Won' },
          ]}
          rows={data.byMonth}
        />
      </div>
    </div>
  );
}

function QuotationConversionReport({ data, onExport }: { data: { byStatus: Record<string, unknown>[]; byMonth: Record<string, unknown>[] }; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      <ReportTable
        columns={[
          { key: 'status', label: 'Status' },
          { key: 'count',  label: 'Count' },
          { key: 'totalPaise', label: 'Total Value', money: true },
        ]}
        rows={data.byStatus}
      />
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Monthly breakdown</h4>
        <ReportTable
          columns={[
            { key: 'month',    label: 'Month' },
            { key: 'sent',     label: 'Sent' },
            { key: 'accepted', label: 'Accepted' },
            { key: 'booked',   label: 'Booked' },
            { key: 'totalPaise', label: 'Value', money: true },
          ]}
          rows={data.byMonth}
        />
      </div>
    </div>
  );
}

function ProjectPipelineReport({ data, onExport }: { data: { byStage: Record<string, unknown>[]; rows: Record<string, unknown>[] }; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      <ReportTable
        columns={[
          { key: 'stage', label: 'Stage' },
          { key: 'count', label: 'Projects' },
          { key: 'totalPaise', label: 'Contract Value', money: true },
        ]}
        rows={data.byStage}
      />
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>All projects</h4>
        <ReportTable
          columns={[
            { key: 'name',               label: 'Project' },
            { key: 'lifecycleStage',     label: 'Stage' },
            { key: 'totalContractPaise', label: 'Contract', money: true },
          ]}
          rows={data.rows}
        />
      </div>
    </div>
  );
}

function CollectionsReport({ data, onExport }: { data: { byMonth: Record<string, unknown>[] }; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      <ReportTable
        columns={[
          { key: 'month',      label: 'Month' },
          { key: 'count',      label: 'Payments' },
          { key: 'totalPaise', label: 'Collected', money: true },
        ]}
        rows={data.byMonth}
      />
    </div>
  );
}

function ProfitabilityReport({ data, onExport }: { data: { rows: Record<string, unknown>[] }; onExport: () => void }) {
  const totalContract  = data.rows.reduce((s, r) => s + Number(r.contractPaise  ?? 0), 0);
  const totalExpenses  = data.rows.reduce((s, r) => s + Number(r.expensesPaise  ?? 0), 0);
  const totalMargin    = data.rows.reduce((s, r) => s + Number(r.marginPaise    ?? 0), 0);
  const avgMarginPct   = data.rows.length
    ? Math.round(data.rows.reduce((s, r) => s + Number(r.marginPct ?? 0), 0) / data.rows.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Contract', value: fmt(totalContract) },
          { label: 'Total Expenses', value: fmt(totalExpenses) },
          { label: 'Gross Margin',   value: fmt(totalMargin) },
          { label: 'Avg Margin %',   value: `${avgMarginPct}%` },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl p-3"
            style={{ backgroundColor: 'var(--surface-muted)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{s.value}</p>
          </div>
        ))}
      </div>
      <ReportTable
        columns={[
          { key: 'name',           label: 'Project' },
          { key: 'stage',          label: 'Stage' },
          { key: 'contractPaise',  label: 'Contract',  money: true },
          { key: 'expensesPaise',  label: 'Expenses',  money: true },
          { key: 'collectedPaise', label: 'Collected', money: true },
          { key: 'marginPaise',    label: 'Margin',    money: true },
          { key: 'marginPct',      label: 'Margin %' },
        ]}
        rows={data.rows}
      />
    </div>
  );
}

function VendorSpendReport({ data, onExport }: { data: { rows: Record<string, unknown>[] }; onExport: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onExport} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
      <ReportTable
        columns={[
          { key: 'vendorName',   label: 'Vendor' },
          { key: 'poCount',      label: 'POs' },
          { key: 'totalPaise',   label: 'Ordered',  money: true },
          { key: 'advancePaise', label: 'Advance',  money: true },
        ]}
        rows={data.rows}
      />
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<Report>('enquiry-funnel');
  // ISO date range (YYYY-MM-DD)
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    try {
      const res = await fetch(`/api/v1/reports/${activeReport}?from=${from}&to=${to}`);
      const json = await res.json();
      if (res.ok) setReportData(json.data);
    } finally { setLoading(false); }
  }, [activeReport, from, to]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    if (!reportData) return;
    const report = REPORTS.find(r => r.key === activeReport);
    let rows: Record<string, unknown>[] = [];
    if (activeReport === 'enquiry-funnel')       rows = reportData.byMonth ?? [];
    if (activeReport === 'quotation-conversion') rows = reportData.byMonth ?? [];
    if (activeReport === 'project-pipeline')     rows = reportData.rows ?? [];
    if (activeReport === 'collections')          rows = reportData.byMonth ?? [];
    if (activeReport === 'profitability')        rows = reportData.rows ?? [];
    if (activeReport === 'vendor-spend')         rows = reportData.rows ?? [];
    downloadXlsx(rows, report?.label ?? activeReport);
  }

  const renderReport = () => {
    if (loading) {
      return (
        <div className="space-y-3 py-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}
        </div>
      );
    }
    if (!reportData) return null;

    switch (activeReport) {
      case 'enquiry-funnel':       return <EnquiryFunnelReport       data={reportData} onExport={handleExport} />;
      case 'quotation-conversion': return <QuotationConversionReport data={reportData} onExport={handleExport} />;
      case 'project-pipeline':     return <ProjectPipelineReport     data={reportData} onExport={handleExport} />;
      case 'collections':          return <CollectionsReport         data={reportData} onExport={handleExport} />;
      case 'profitability':        return <ProfitabilityReport       data={reportData} onExport={handleExport} />;
      case 'vendor-spend':         return <VendorSpendReport         data={reportData} onExport={handleExport} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Six fixed reports with date range filter and Excel export"
      />

      {/* Report tabs */}
      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: activeReport === r.key ? 'var(--accent-base)'  : 'var(--surface-muted)',
              color:            activeReport === r.key ? '#fff'                : 'var(--text-secondary)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Date range + refresh */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input
            type="date"
            className="input-field text-xs py-1 px-2"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input
            type="date"
            className="input-field text-xs py-1 px-2"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Active report description */}
      <div>
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {REPORTS.find(r => r.key === activeReport)?.subtitle}
        </p>
      </div>

      {/* Report content */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        {renderReport()}
      </div>
    </div>
  );
}
