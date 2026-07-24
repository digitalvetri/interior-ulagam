'use client';

import { useState, useEffect } from 'react';
import { TrendingDown, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { ReceivableItem } from '@/types/accounts';

interface ReceivablesPayload {
  items: ReceivableItem[];
  totalOutstandingPaise: number;
  totalOverduePaise: number;
}

const STATUS_CONFIG: Record<'pending' | 'link_sent' | 'overdue', { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: '#EFF6FF', color: '#1E40AF' },
  link_sent: { label: 'Link Sent', bg: '#F0FDF4', color: '#14532D' },
  overdue:   { label: 'Overdue',   bg: '#FEF2F2', color: '#991B1B' },
};

export default function AccountsPage() {
  const [overdueOnly, setOverdueOnly]     = useState(false);
  const [receivables, setReceivables]     = useState<ReceivablesPayload | null>(null);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState<string | null>(null);
  const [exportError, setExportError]     = useState<string | null>(null);
  const [xmlExportError, setXmlExportError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    const url = `/api/v1/accounts/receivables${overdueOnly ? '?overdueOnly=true' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(({ data }: { data: ReceivablesPayload }) => {
        if (!cancelled) { setReceivables(data); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setFetchError('Failed to load receivables — please try again.'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [overdueOnly]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function downloadBlob(url: string, filename: string, setErr: (e: string | null) => void) {
    setErr(null);
    try {
      const res = await fetch(url);
      if (!res.ok) { setErr('Export failed — please try again.'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErr('Network error — please try again.');
    }
  }

  const items = receivables?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Accounts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>Receivables, outstanding milestones, and Tally exports</p>
        </div>
        <button
          onClick={() => setOverdueOnly(o => !o)}
          className={overdueOnly ? 'btn-primary px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm'}
        >
          <AlertCircle className="h-4 w-4 inline mr-1.5" />
          {overdueOnly ? 'Show All' : 'Overdue Only'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="premium-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#A8927F' }}>Total Outstanding</p>
          <p className="text-2xl font-bold" style={{ color: '#1C1C1C' }}>
            {receivables ? formatRupees(receivables.totalOutstandingPaise) : '—'}
          </p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#A8927F' }}>Total Overdue</p>
          <p className="text-2xl font-bold text-red-600">
            {receivables ? formatRupees(receivables.totalOverduePaise) : '—'}
          </p>
          {receivables && receivables.totalOverduePaise > 0 && (
            <p className="text-xs mt-1 text-red-500 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Needs immediate follow-up
            </p>
          )}
        </div>
      </div>

      {/* Receivables table */}
      <div className="premium-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: '#E9DFD3' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#3D2314' }}>
            {overdueOnly ? 'Overdue Milestones' : 'All Receivables'}
          </h2>
        </div>

        {loading && (
          <div className="p-10 text-center text-sm" style={{ color: '#6B6B6B' }}>Loading receivables…</div>
        )}
        {fetchError && !loading && (
          <div className="p-10 text-center text-sm text-red-600">{fetchError}</div>
        )}
        {!loading && !fetchError && items.length === 0 && (
          <div className="p-10 text-center text-sm" style={{ color: '#6B6B6B' }}>
            {overdueOnly ? 'No overdue milestones.' : 'No outstanding receivables.'}
          </div>
        )}
        {!loading && !fetchError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#FDFAF7', borderBottom: '1px solid #E9DFD3' }}>
                <tr>
                  {['Project', 'Milestone', 'Amount', 'Status', 'Age'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left${h === 'Amount' || h === 'Age' ? ' text-right' : ''}`}
                      style={{ color: '#A8927F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const s = STATUS_CONFIG[item.paymentStatus] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #F0EBE5' : undefined }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#1C1C1C' }}>{item.projectName}</td>
                      <td className="px-4 py-3" style={{ color: '#6B6B6B' }}>{item.label}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: '#C89B3C' }}>{formatRupees(item.amountPaise)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: '#6B6B6B' }}>{item.daysSinceCreation}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export section */}
      <div className="premium-card p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: '#3D2314' }}>Tally Export</h2>
        <p className="text-xs" style={{ color: '#6B6B6B' }}>Download captured payments in Tally-compatible formats.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadBlob('/api/v1/accounts/tally-export', 'tally-export.csv', setExportError)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => downloadBlob('/api/v1/accounts/tally-xml-push', 'tally-vouchers.xml', setXmlExportError)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Tally XML
          </button>
        </div>
        {exportError && <p className="text-sm text-red-600">{exportError}</p>}
        {xmlExportError && <p className="text-sm text-red-600">{xmlExportError}</p>}
      </div>
    </div>
  );
}
