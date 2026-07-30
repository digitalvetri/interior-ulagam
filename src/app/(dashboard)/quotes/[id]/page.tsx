'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Phone, Tag, Layers } from 'lucide-react';
import { LineItemRow } from '@/components/quotes/LineItemRow';
import { AddLineForm } from '@/components/quotes/AddLineForm';
import { MarginSummary } from '@/components/quotes/MarginSummary';
import { Quote, QuoteLine } from '@/types/quotes';

const STATUS_BADGE_STYLE: Record<Quote['status'], React.CSSProperties> = {
  draft:    { background: 'var(--surface-muted)', color: 'var(--text-secondary)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  sent:     { background: 'var(--gold-soft)', color: 'var(--text-gold)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  approved: { background: 'var(--teal-soft)', color: 'var(--text-accent)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  revised:  { background: '#FEE2E2', color: '#991B1B', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
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
  const [actionError, setActionError] = useState<string | null>(null);

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
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${id}/send`, { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      fetchQuote();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to send quote');
    } finally {
      setActionPending(false);
    }
  }

  async function handleMarkApproved() {
    setActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${id}/approve`, { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      fetchQuote();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to mark approved');
    } finally {
      setActionPending(false);
    }
  }

  if (loading) {
    return (
      <div className="premium-card flex h-64 items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading quote…</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="premium-card flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Quote not found.</p>
      </div>
    );
  }

  const quoteLabel = `QUO-${quote.id.slice(-6).toUpperCase()}`;
  const hasLead = Boolean(quote.leadId);
  const stageLabel = quote.leadStage
    ? quote.leadStage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {hasLead ? (
          <>
            <Link href="/leads" className="hover:underline">Leads</Link>
            <span>/</span>
            <Link href={`/leads/${quote.leadId}`} className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {quote.leadContactName ?? 'Lead'}
            </Link>
          </>
        ) : (
          <>
            <Link href="/projects" className="hover:underline">Projects</Link>
            <span>/</span>
            <Link href="/quotes" className="hover:underline">Quotes</Link>
          </>
        )}
        <span>/</span>
        <span style={{ color: 'var(--text-heading)' }}>{quoteLabel}</span>
      </nav>

      {/* Lead / project context banner */}
      {(hasLead || quote.projectName) && (
        <div
          className="flex flex-wrap items-center gap-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
        >
          {quote.leadContactName && (
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>
              {quote.leadContactName}
            </span>
          )}
          {quote.leadContactPhone && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Phone className="h-3.5 w-3.5" />
              {quote.leadContactPhone}
            </span>
          )}
          {stageLabel && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Layers className="h-3.5 w-3.5" />
              {stageLabel}
            </span>
          )}
          {quote.leadBudgetBand && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Tag className="h-3.5 w-3.5" />
              {quote.leadBudgetBand}
            </span>
          )}
          {quote.projectName && !hasLead && (
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>
              {quote.projectName}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {quoteLabel}
            {quote.version > 1 && (
              <span className="ml-2 text-base font-normal" style={{ color: 'var(--text-secondary)' }}>
                v{quote.version}
              </span>
            )}
          </h2>
          <span style={STATUS_BADGE_STYLE[quote.status]}>
            {quote.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {quote.pdfUrl && (
            <a
              href={quote.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          )}
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

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: line items */}
        <div className="space-y-4">
          <div className="premium-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
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
                      className="px-3 py-8 text-center text-sm"
                      style={{ color: 'var(--text-secondary)' }}
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

          <AddLineForm quoteId={id} onSuccess={handleLineAdded} />
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
