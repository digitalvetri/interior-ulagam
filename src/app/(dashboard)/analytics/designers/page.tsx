'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRupees } from '@/lib/utils';
import type { DesignerMetrics } from '@/types/analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-green-600 dark:text-green-400';
  if (pct >= 15) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function marginBarColor(pct: number): string {
  if (pct >= 30) return 'bg-green-500';
  if (pct >= 15) return 'bg-yellow-500';
  return 'bg-red-500';
}

/** Clamp margin % to a 0–50 scale and express as a percentage of bar width */
function barWidthPct(pct: number): number {
  return Math.min(Math.max(pct, 0) / 50, 1) * 100;
}

function formatMarginPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct.toFixed(1)}%`;
}

function formatRevisions(avg: number | null): string {
  if (avg === null) return '—';
  return avg.toFixed(2);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DesignerCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 space-y-2">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <div className="mb-3 h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── Designer Card ────────────────────────────────────────────────────────────

interface DesignerCardProps {
  designer: DesignerMetrics;
}

function DesignerCard({ designer }: DesignerCardProps) {
  const {
    fullName,
    phone,
    activeProjectCount,
    completedProjects,
    avgMarginPct,
    avgRevisionCount,
    totalContractPaise,
  } = designer;

  const revisionWarning =
    avgRevisionCount !== null && avgRevisionCount > 2;

  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
          {fullName}
        </CardTitle>
        {phone && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{phone}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Chips */}
        <div className="flex flex-wrap gap-2">
          {/* Active Projects */}
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
            Active: {activeProjectCount}
          </Badge>

          {/* Completed */}
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300">
            Completed: {completedProjects}
          </Badge>

          {/* Avg Margin % */}
          <Badge
            className={`hover:opacity-100 ${
              avgMarginPct === null
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400'
                : avgMarginPct >= 30
                ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300'
                : avgMarginPct >= 15
                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'
                : 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            Margin: {formatMarginPct(avgMarginPct)}
          </Badge>

          {/* Avg Revisions */}
          <Badge
            className={`hover:opacity-100 ${
              revisionWarning
                ? 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            Revisions: {formatRevisions(avgRevisionCount)}
            {revisionWarning && ' ⚠'}
          </Badge>
        </div>

        {/* Total Contract Value */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Total Contract Value
          </p>
          <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">
            {formatRupees(totalContractPaise)}
          </p>
        </div>

        {/* Visual Margin Rating Bar */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Margin Rating
            </p>
            {avgMarginPct !== null && (
              <span className={`text-xs font-semibold ${marginColor(avgMarginPct)}`}>
                {avgMarginPct.toFixed(1)}% / 50%
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            {avgMarginPct !== null ? (
              <div
                className={`h-full rounded-full transition-all ${marginBarColor(avgMarginPct)}`}
                style={{ width: `${barWidthPct(avgMarginPct)}%` }}
              />
            ) : (
              <div className="h-full w-0 rounded-full" />
            )}
          </div>
          <div className="mt-0.5 flex justify-between text-xs text-gray-400 dark:text-gray-600">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
        if (res.status === 401) {
          setState({ status: 'forbidden' });
          return;
        }
        if (res.status === 403) {
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
      .catch(() =>
        setState({ status: 'error', message: 'Network error — please try again.' }),
      );
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Designer Performance
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Owner view — shows KPIs for your design team
        </p>
      </div>

      {/* Body */}
      {state.status === 'loading' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <DesignerCardSkeleton key={i} />
          ))}
        </div>
      )}

      {state.status === 'forbidden' && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            This page is for studio owners only.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Contact your studio owner for access to Designer Performance.
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.message}
          </p>
        </div>
      )}

      {state.status === 'success' && state.designers.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No designers found in your studio.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Invite a designer via Settings to see their performance here.
          </p>
        </div>
      )}

      {state.status === 'success' && state.designers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {state.designers.map((designer) => (
            <DesignerCard key={designer.userId} designer={designer} />
          ))}
        </div>
      )}
    </div>
  );
}
