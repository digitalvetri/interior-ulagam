'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineItemRow } from '@/components/quotes/LineItemRow';
import { AddLineForm } from '@/components/quotes/AddLineForm';
import { MarginSummary } from '@/components/quotes/MarginSummary';
import { Quote, QuoteLine } from '@/types/quotes';

const STATUS_BADGE_VARIANT: Record<
  Quote['status'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  draft: 'secondary',
  sent: 'default',
  approved: 'outline',
  revised: 'destructive',
};

export default function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const fetchQuote = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/quotes/${id}`)
      .then((r) => r.json())
      .then(({ data }: { data: Quote }) => {
        setQuote(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  function handleLineUpdate(
    lineId: string,
    data: { qty?: number; costRatePaise?: number; clientRatePaise?: number },
  ) {
    // Refetch so totals stay accurate
    setQuote((prev) => {
      if (!prev?.lines) return prev;
      return {
        ...prev,
        lines: prev.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                qty: data.qty ?? l.qty,
                costRatePaise: data.costRatePaise ?? l.costRatePaise,
                clientRatePaise: data.clientRatePaise ?? l.clientRatePaise,
                marginPaise:
                  ((data.clientRatePaise ?? l.clientRatePaise) -
                    (data.costRatePaise ?? l.costRatePaise)) *
                  (data.qty ?? l.qty),
              }
            : l,
        ),
      };
    });
    // Full refetch to get updated server-side totals
    fetchQuote();
  }

  function handleLineDelete(lineId: string) {
    setQuote((prev) => {
      if (!prev?.lines) return prev;
      return { ...prev, lines: prev.lines.filter((l) => l.id !== lineId) };
    });
    fetchQuote();
  }

  function handleLineAdded(_line: QuoteLine) {
    fetchQuote();
  }

  async function handleSendQuote() {
    setActionPending(true);
    try {
      await fetch(`/api/v1/quotes/${id}/send`, { method: 'POST' });
      fetchQuote();
    } finally {
      setActionPending(false);
    }
  }

  async function handleMarkApproved() {
    setActionPending(true);
    try {
      await fetch(`/api/v1/quotes/${id}/approve`, { method: 'POST' });
      fetchQuote();
    } finally {
      setActionPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-500">Loading quote…</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Quote not found.</p>
      </div>
    );
  }

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
          href="/quotes"
          className="hover:text-gray-700 dark:hover:text-gray-200"
        >
          Quotes
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">
          Quote #{quote.version}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Quote #{quote.version}
          </h2>
          <Badge variant={STATUS_BADGE_VARIANT[quote.status]}>
            {quote.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <Button onClick={handleSendQuote} disabled={actionPending}>
              {actionPending ? 'Sending…' : 'Send Quote'}
            </Button>
          )}
          {quote.status === 'sent' && (
            <Button onClick={handleMarkApproved} disabled={actionPending}>
              {actionPending ? 'Approving…' : 'Mark Approved'}
            </Button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: line items */}
        <div className="space-y-4">
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-3 py-3">Room</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Cost Rate (₹)</th>
                  <th className="px-3 py-3">Client Rate (₹)</th>
                  <th className="px-3 py-3">Margin (₹)</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(quote.lines ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-sm text-gray-400"
                    >
                      No line items yet. Add one below.
                    </td>
                  </tr>
                ) : (
                  (quote.lines ?? []).map((line) => (
                    <LineItemRow
                      key={line.id}
                      line={line}
                      onDelete={handleLineDelete}
                      onUpdate={handleLineUpdate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add line form */}
          <AddLineForm
            quoteId={id}
            onSuccess={handleLineAdded}
          />
        </div>

        {/* Right: summary */}
        <MarginSummary
          lines={quote.lines ?? []}
          subtotalPaise={quote.subtotalPaise}
          gstPaise={quote.gstPaise}
          totalPaise={quote.totalPaise}
        />
      </div>
    </div>
  );
}
