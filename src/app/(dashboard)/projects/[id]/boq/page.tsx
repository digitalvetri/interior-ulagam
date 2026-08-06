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
    highlight === 'danger'  ? 'var(--danger)' :
    highlight === 'success' ? 'var(--success-text)' :
    'var(--text-heading)';

  return (
    <div className="rounded-2xl border p-5 flex items-start justify-between gap-3"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex-1">
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color: valueColor }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
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
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: 'var(--text-heading)' }}>{count}</p>
        <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
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
        <AlertTriangle className="h-12 w-12" style={{ color: 'var(--danger)' }} />
        <p className="text-base font-medium" style={{ color: 'var(--danger)' }}>Project not found.</p>
        <Link href="/projects" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm rounded-xl">
          <ArrowLeft className="h-4 w-4" />Back to Projects
        </Link>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10" style={{ color: 'var(--warning)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Failed to load BOQ data — please refresh.</p>
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
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Bill of Quantities</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Procurement vs quoted cost overview
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
          <LayoutList className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
        </div>
      </div>

      {/* Alerts */}
      {noQuote && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: 'var(--warning-soft)', background: 'var(--warning-soft)' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <p className="text-sm" style={{ color: 'var(--warning-text)' }}>
            No approved quote found for this project. BOQ totals will appear once a quote is approved.
          </p>
        </div>
      )}

      {negMargin && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: 'var(--danger-soft)', background: 'var(--danger-soft)' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>
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
          iconBg="var(--success-soft)" iconColor="var(--success)"
        />
        <SummaryCard
          label="QUOTED COST TOTAL"
          value={formatRupees(totalCostPaise)}
          sub="Sum of cost rates"
          icon={TrendingDown}
          iconBg="var(--accent-soft)" iconColor="var(--accent-text)"
        />
        <SummaryCard
          label="QUOTED MARGIN"
          value={formatRupees(totalMarginPaise)}
          sub={`Margin: ${marginPct}`}
          highlight={negMargin ? 'danger' : totalMarginPaise > 0 ? 'success' : 'neutral'}
          icon={negMargin ? AlertTriangle : TrendingUp}
          iconBg={negMargin ? 'var(--danger-soft)' : 'var(--success-soft)'}
          iconColor={negMargin ? 'var(--danger)' : 'var(--success)'}
        />
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CountCard
          label="Purchase Orders"
          count={poCount}
          icon={ShoppingBag}
          iconBg="var(--accent-soft)" iconColor="var(--accent-text)"
        />
        <CountCard
          label="Goods Received Notes"
          count={grnCount}
          icon={ClipboardCheck}
          iconBg="var(--success-soft)" iconColor="var(--success)"
        />
      </div>

      {/* Variance detail */}
      {negMargin && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--danger-soft)', background: '#FFF1F2' }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--danger)' }}>
            Variance Alert
          </p>
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>
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
