'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutList, AlertTriangle, TrendingDown, TrendingUp, ShoppingBag, ClipboardCheck } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import type { BOQSummary } from '@/types/purchase-orders';

/* ── Sub-components ────────────────────────────────────────────────────────── */

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'success' | 'danger' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

function SummaryCard({ label, value, sub, highlight, icon: Icon, iconBg, iconColor }: SummaryCardProps) {
  const valueColor =
    highlight === 'danger'  ? '#DC2626' :
    highlight === 'success' ? '#14532D' :
    '#1C1916';

  return (
    <div className="rounded-2xl border p-5 flex items-start justify-between gap-3"
      style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
      <div className="flex-1">
        <p className="text-xs font-semibold mb-2" style={{ color: '#6B6459' }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color: valueColor }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: '#A79E8E' }}>{sub}</p>}
      </div>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function CountCard({ label, count, icon: Icon, iconBg, iconColor }: {
  label: string; count: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4"
      style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: '#1C1916' }}>{count}</p>
        <p className="text-xs font-medium mt-0.5" style={{ color: '#6B6459' }}>{label}</p>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ProjectBOQPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [summary,  setSummary]  = useState<BOQSummary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}/boq`)
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setError(true); return; }
        const { data } = await res.json() as { data: BOQSummary };
        setSummary(data ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-5 w-32 rounded-lg" />
        <div className="skeleton h-9 w-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 gap-5">
        <AlertTriangle className="h-12 w-12" style={{ color: '#DC2626' }} />
        <p className="text-base font-medium" style={{ color: '#DC2626' }}>Project not found.</p>
        <Link href="/projects" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
          <ArrowLeft className="h-4 w-4" />Back to Projects
        </Link>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10" style={{ color: '#F59E0B' }} />
        <p className="text-sm" style={{ color: '#6B6459' }}>Failed to load BOQ data — please refresh.</p>
      </div>
    );
  }

  const { quoted, poCount, grnCount } = summary;
  const { totalClientPaise, totalCostPaise, totalMarginPaise } = quoted;

  const marginPct = totalClientPaise > 0
    ? ((totalMarginPaise / totalClientPaise) * 100).toFixed(1) + '%'
    : '—';

  const noQuote     = totalClientPaise === 0 && totalCostPaise === 0;
  const negMargin   = totalMarginPaise < 0;

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: '#6B6459' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1916' }}>Bill of Quantities</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B6459' }}>
            Procurement vs quoted cost overview
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5F3FF' }}>
          <LayoutList className="h-5 w-5" style={{ color: '#7C3AED' }} />
        </div>
      </div>

      {/* Alerts */}
      {noQuote && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
          <p className="text-sm" style={{ color: '#92400E' }}>
            No approved quote found for this project. BOQ totals will appear once a quote is approved.
          </p>
        </div>
      )}

      {negMargin && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
          <p className="text-sm" style={{ color: '#B91C1C' }}>
            Quoted cost exceeds client price — margin is negative. Review quote lines immediately.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="QUOTED CLIENT TOTAL"
          value={formatRupees(totalClientPaise)}
          sub="Sum of client rates"
          icon={TrendingUp}
          iconBg="#F0FDF4" iconColor="#16A34A"
        />
        <SummaryCard
          label="QUOTED COST TOTAL"
          value={formatRupees(totalCostPaise)}
          sub="Sum of cost rates"
          icon={TrendingDown}
          iconBg="#EFF6FF" iconColor="#1E40AF"
        />
        <SummaryCard
          label="QUOTED MARGIN"
          value={formatRupees(totalMarginPaise)}
          sub={`Margin: ${marginPct}`}
          highlight={negMargin ? 'danger' : totalMarginPaise > 0 ? 'success' : 'neutral'}
          icon={negMargin ? AlertTriangle : TrendingUp}
          iconBg={negMargin ? '#FEF2F2' : '#F0FDF4'}
          iconColor={negMargin ? '#DC2626' : '#16A34A'}
        />
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CountCard
          label="Purchase Orders"
          count={poCount}
          icon={ShoppingBag}
          iconBg="#EFF6FF" iconColor="#1E40AF"
        />
        <CountCard
          label="Goods Received Notes"
          count={grnCount}
          icon={ClipboardCheck}
          iconBg="#F0FDF4" iconColor="#16A34A"
        />
      </div>

      {/* Variance detail */}
      {negMargin && (
        <div className="rounded-2xl border p-5" style={{ borderColor: '#FECACA', background: '#FFF1F2' }}>
          <p className="font-semibold mb-1" style={{ color: '#DC2626' }}>
            Variance Alert
          </p>
          <p className="text-sm" style={{ color: '#B91C1C' }}>
            The quoted margin is{' '}
            <strong>{formatRupees(Math.abs(totalMarginPaise))} below zero</strong>.
            Cost has exceeded the client price in the approved quote.
            A revised quote or change order may be required to recover the margin.
          </p>
        </div>
      )}
    </div>
  );
}
