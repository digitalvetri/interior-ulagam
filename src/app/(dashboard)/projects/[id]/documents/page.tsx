'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Loader2, Eye, Download,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { DocumentActions } from '@/components/ui/DocumentActions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteRow {
  id: string;
  quoteNumber?: string | null;
  version: number;
  status: string;
  totalPaise: number;
  pdfUrl?: string | null;
  createdAt: string;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  pdfUrl?: string | null;
  paymentStatus?: string | null;
  createdAt: string;
}

// ─── Invoice PDF Actions ──────────────────────────────────────────────────────
// Invoices use DOCUMENTS_BUCKET (presigned URLs) — the stored pdfUrl is an S3
// key, not a viewable URL. Fetch a fresh presigned URL on demand.

function InvoiceActions({ invoice }: { invoice: InvoiceRow }) {
  const [loading, setLoading] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPdf = !!invoice.pdfUrl;

  async function handleFetchOrGenerate() {
    setLoading(true);
    setError(null);
    try {
      // GET fetches presigned URL for existing PDF; POST generates a new one
      const method = hasPdf ? 'GET' : 'POST';
      const res = await fetch(`/api/v1/invoices/${invoice.id}/pdf`, { method });
      const body = await res.json() as { data?: { pdfUrl?: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      const url = body.data?.pdfUrl;
      if (url) {
        setViewUrl(url);
        window.open(url, '_blank');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {viewUrl ? (
        <>
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </a>
          <a
            href={viewUrl}
            download={`Invoice-${invoice.invoiceNumber}.pdf`}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void handleFetchOrGenerate()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileText className="h-3.5 w-3.5" />}
          {loading ? 'Loading…' : hasPdf ? 'Open PDF' : 'Generate PDF'}
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [qRes, iRes] = await Promise.all([
          fetch(`/api/v1/quotes?projectId=${id}`),
          fetch(`/api/v1/invoices?projectId=${id}`),
        ]);
        const qData = await qRes.json() as { data?: QuoteRow[] };
        const iData = await iRes.json() as { data?: InvoiceRow[] };
        setQuotes(qData.data ?? []);
        setInvoices(iData.data ?? []);
      } catch {
        setFetchError('Failed to load documents');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${id}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-page)] transition-colors hover:bg-[var(--surface-muted)]"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--text-primary)]" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-heading)]">Documents</h1>
          <p className="text-xs text-[var(--text-secondary)]">Generated PDFs — quotations and invoices</p>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Quotations */}
      <div className="premium-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-heading)]">Quotations</h2>
          <Link
            href="/quotes"
            className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline"
          >
            All Quotes →
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 rounded-full bg-[var(--surface-muted)] p-3">
              <FileText className="h-6 w-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">No quotations yet</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Quotes linked to this project will appear here.
            </p>
            <Link
              href="/quotes"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              Go to Quotes
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {quotes.map(q => {
              const docNum = q.quoteNumber ?? `QUO-V${q.version}`;
              return (
                <div key={q.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="text-sm font-medium text-[var(--text-heading)] hover:text-violet-600"
                    >
                      {docNum}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-secondary)]">
                      <span>{formatRupees(q.totalPaise)}</span>
                      <span>·</span>
                      <span className="capitalize">{q.status}</span>
                      <span>·</span>
                      <span>
                        {new Date(q.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <DocumentActions
                    docType="quote"
                    docNumber={docNum}
                    pdfUrl={q.pdfUrl}
                    generateEndpoint={`/api/v1/quotes/${q.id}/pdf`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="premium-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-heading)]">Invoices</h2>
          <Link
            href={`/projects/${id}/payments`}
            className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline"
          >
            Payments →
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 rounded-full bg-[var(--surface-muted)] p-3">
              <FileText className="h-6 w-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">No invoices yet</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Invoices linked to project milestones will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {invoices.map(inv => {
              const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
              return (
                <div key={inv.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-heading)]">{inv.invoiceNumber}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-secondary)]">
                      <span>{formatRupees(total)}</span>
                      <span>·</span>
                      <span>
                        {new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {inv.paymentStatus && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{inv.paymentStatus.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <InvoiceActions invoice={inv} />
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
