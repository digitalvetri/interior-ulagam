'use client';

import { useEffect, useState } from 'react';
import { formatRupees } from '@/lib/utils';
import type { DesignerMetrics } from '@/types/analytics';

function formatMarginPct(pct: number | null): string {
  return pct === null ? '—' : `${pct.toFixed(1)}%`;
}

function marginColor(pct: number): string {
  if (pct >= 30) return '#16A34A';
  if (pct >= 15) return '#D97706';
  return '#DC2626';
}

function barWidth(pct: number): string {
  return `${Math.min(Math.max(pct, 0) / 50, 1) * 100}%`;
}

function DesignerCard({ designer }: { designer: DesignerMetrics }) {
  const { fullName, phone, activeProjectCount, completedProjects, avgMarginPct, avgRevisionCount, totalContractPaise } = designer;
  const revisionWarn = avgRevisionCount !== null && avgRevisionCount > 2;

  const chips = [
    { label: `Active: ${activeProjectCount}`,  bg: '#EFF6FF', color: '#1E40AF' },
    { label: `Done: ${completedProjects}`,       bg: '#F0FDF4', color: '#14532D' },
    {
      label: `Margin: ${formatMarginPct(avgMarginPct)}`,
      bg: avgMarginPct === null ? '#F5F5F5' : avgMarginPct >= 30 ? '#F0FDF4' : avgMarginPct >= 15 ? '#FFFBEB' : '#FEF2F2',
      color: avgMarginPct === null ? '#6B6B6B' : marginColor(avgMarginPct),
    },
    {
      label: `Revisions: ${avgRevisionCount !== null ? avgRevisionCount.toFixed(1) : '—'}${revisionWarn ? ' ⚠' : ''}`,
      bg: revisionWarn ? '#FFF7ED' : '#F5F5F5',
      color: revisionWarn ? '#EA580C' : '#6B6B6B',
    },
  ];

  return (
    <div className="premium-card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold" style={{ color: '#1C1C1C' }}>{fullName}</h3>
        {phone && <p className="text-xs mt-0.5" style={{ color: '#6B6B6B' }}>{phone}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <span key={c.label} className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: c.bg, color: c.color }}>{c.label}</span>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: '#A8927F' }}>Total Contract Value</p>
        <p className="text-lg font-bold" style={{ color: '#C89B3C' }}>{formatRupees(totalContractPaise)}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs" style={{ color: '#6B6B6B' }}>Margin Rating</p>
          {avgMarginPct !== null && (
            <span className="text-xs font-semibold" style={{ color: marginColor(avgMarginPct) }}>
              {avgMarginPct.toFixed(1)}% / 50%
            </span>
          )}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E9DFD3' }}>
          {avgMarginPct !== null && (
            <div className="h-full rounded-full transition-all"
              style={{ width: barWidth(avgMarginPct), background: marginColor(avgMarginPct) }} />
          )}
        </div>
        <div className="flex justify-between text-[10px] mt-0.5" style={{ color: '#C8B7A6' }}>
          <span>0%</span><span>25%</span><span>50%</span>
        </div>
      </div>
    </div>
  );
}

type FetchState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'success'; designers: DesignerMetrics[] };

export default function DesignerPerformancePage() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/v1/analytics/designers')
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          setState({ status: 'forbidden' });
          return;
        }
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setState({ status: 'error', message: body.error ?? 'Failed to load data' });
          return;
        }
        const body = (await res.json()) as { data: DesignerMetrics[] };
        setState({ status: 'success', designers: body.data ?? [] });
      })
      .catch(() => setState({ status: 'error', message: 'Network error — please try again.' }));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Designer Performance</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>Owner view — KPIs for your design team</p>
      </div>

      {state.status === 'loading' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-52 rounded-2xl" />)}
        </div>
      )}

      {state.status === 'forbidden' && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E9DFD3' }}>
          <p className="text-sm font-medium" style={{ color: '#6F4E37' }}>This page is for studio owners only.</p>
          <p className="text-xs" style={{ color: '#6B6B6B' }}>Contact your studio owner for access.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">{state.message}</p>
        </div>
      )}

      {state.status === 'success' && state.designers.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E9DFD3' }}>
          <p className="text-sm" style={{ color: '#6B6B6B' }}>No designers found in your studio.</p>
          <p className="text-xs" style={{ color: '#A8927F' }}>Invite a designer via Settings to see their performance here.</p>
        </div>
      )}

      {state.status === 'success' && state.designers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.designers.map(d => <DesignerCard key={d.userId} designer={d} />)}
        </div>
      )}
    </div>
  );
}
