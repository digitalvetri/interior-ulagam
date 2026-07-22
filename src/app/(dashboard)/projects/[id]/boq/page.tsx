'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatRupees } from '@/lib/utils';
import type { BOQSummary } from '@/types/purchase-orders';

export default function ProjectBOQPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [summary, setSummary] = useState<BOQSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/projects/${id}/boq`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const { data } = (await res.json()) as { data: BOQSummary };
        setSummary(data ?? null);
      })
      .catch(() => {
        // leave summary null — handled in render
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading BOQ summary…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">Project not found.</p>
        <Link href="/projects">
          <Button variant="outline" size="sm">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Failed to load BOQ data.</p>
      </div>
    );
  }

  const { quoted, poCount, grnCount } = summary;
  const { totalClientPaise, totalCostPaise, totalMarginPaise } = quoted;

  const marginPct =
    totalClientPaise > 0
      ? ((totalMarginPaise / totalClientPaise) * 100).toFixed(1) + '%'
      : '—';

  // Variance: how much procurement cost exceeds quoted cost
  // Positive variance = under budget (good); negative = overrun (bad)
  // We don't have actual PO spend totals in this endpoint, so we surface
  // the quoted cost as the budget baseline and note if margin is negative.
  const marginNegative = totalMarginPaise < 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/projects"
          className="hover:text-gray-700 dark:hover:text-gray-200"
        >
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${id}`}
          className="hover:text-gray-700 dark:hover:text-gray-200"
        >
          {id.slice(0, 8)}…
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">BOQ</span>
      </nav>

      {/* Page heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bill of Quantities
        </h2>
        <Link href={`/projects/${id}`}>
          <Button variant="outline" size="sm">Back to Project</Button>
        </Link>
      </div>

      {/* No approved quote notice */}
      {totalClientPaise === 0 && totalCostPaise === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          No approved quote found for this project. BOQ totals will appear once a quote is approved.
        </div>
      )}

      {/* Negative margin warning */}
      {marginNegative && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Warning: Quoted cost exceeds quoted client price — the project margin is negative. Review quote lines.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Quoted Client Total"
          value={formatRupees(totalClientPaise)}
          description="Sum of client rates across approved quote lines"
        />
        <SummaryCard
          label="Quoted Cost Total"
          value={formatRupees(totalCostPaise)}
          description="Sum of cost rates across approved quote lines"
        />
        <SummaryCard
          label="Quoted Margin Total"
          value={formatRupees(totalMarginPaise)}
          description={`Margin %: ${marginPct}`}
          highlight={marginNegative ? 'danger' : totalMarginPaise > 0 ? 'success' : undefined}
        />
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CountCard label="Purchase Orders" count={poCount} />
        <CountCard label="Goods Received Notes" count={grnCount} />
      </div>

      {/* Variance note */}
      {marginNegative && (
        <div className="rounded-lg border border-red-200 bg-white p-4 dark:border-red-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Variance Alert
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            The quoted margin is{' '}
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatRupees(Math.abs(totalMarginPaise))} below zero
            </span>
            . Cost has exceeded the client price in the approved quote. A revised
            quote or change order may be required.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
  highlight?: 'success' | 'danger';
}

function SummaryCard({ label, value, description, highlight }: SummaryCardProps) {
  const valueClass =
    highlight === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : highlight === 'success'
        ? 'text-green-600 dark:text-green-400'
        : 'text-gray-900 dark:text-white';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>
      )}
    </div>
  );
}

interface CountCardProps {
  label: string;
  count: number;
}

function CountCard({ label, count }: CountCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
    </div>
  );
}
