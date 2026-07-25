'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LineItemRow } from '@/components/quotes/LineItemRow';
import { AddLineForm } from '@/components/quotes/AddLineForm';
import { MarginSummary } from '@/components/quotes/MarginSummary';
import { Quote, QuoteLine } from '@/types/quotes';

const STATUS_BADGE_STYLE: Record<Quote['status'], React.CSSProperties> = {
  draft:    { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  sent:     { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  approved: { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  revised:  { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          className="hover:text-gray-700"
        >
          Projects
        </Link>
        <span>/</span>
        <Link
          href="/quotes"
          className="hover:text-gray-700"
        >
          Quotes
        </Link>
        <span>/</span>
        <span className="text-gray-900">
          Quote #{quote.version}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">
            Quote #{quote.version}
          </h2>
          <span style={STATUS_BADGE_STYLE[quote.status]}>
            {quote.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={handleSendQuote}
              disabled={actionPending}
            >
              {actionPending ? 'Sending…' : 'Send Quote'}
            </button>
          )}
          {quote.status === 'sent' && (
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={handleMarkApproved}
              disabled={actionPending}
            >
              {actionPending ? 'Approving…' : 'Mark Approved'}
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: line items */}
        <div className="space-y-4">
          {/* Table */}
          <div className="premium-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
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
