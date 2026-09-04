'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { Quote, QuoteLine } from '@/types/quotes';

// ── Company identity ──────────────────────────────────────────────────────────
// TODO: source these from a tenant settings API once the settings screen exists.
// Until then, update these constants to match your studio's details.
// ⚠ IMPORTANT: Review and correct COMPANY_GSTIN before sharing with clients —
//   a wrong GSTIN on a commercial document creates compliance liability.
const COMPANY_NAME    = 'Konst Design';
const COMPANY_ADDRESS = 'No.11 Barathi Nagar, Rathinapuri, Coimbatore 641027';
const COMPANY_PHONE   = '+91 98943 31115';
const COMPANY_EMAIL   = 'Mohasher11@gmail.com';
const COMPANY_GSTIN   = '';                        // e.g. '33XXXXX0000X1ZX'

// ── Commercial terms ─────────────────────────────────────────────────────────
// Phase 2: move these to per-quote editable fields once Drizzle migration lands.
const VALIDITY_DAYS = 30;

const PAYMENT_TERMS = [
  '10% — Advance at order confirmation',
  '40% — At design finalisation / material procurement',
  '40% — At site completion / before snag list',
  '10% — At project handover',
];

const SCOPE_INCLUSIONS = [
  'Interior design and execution as per line items above',
  'Project management and site supervision',
  'Co-ordination with vendors and contractors',
];

const SCOPE_EXCLUSIONS = [
  'Civil / masonry / structural changes (unless specified above)',
  'Electrical points / plumbing (unless specified above)',
  'White goods, appliances, and loose furniture',
];

const TERMS_AND_CONDITIONS = [
  `This quotation is valid for ${VALIDITY_DAYS} days from the date of issue.`,
  'Rates are subject to revision if there is a change in scope, specifications, or material prices.',
  'Material selection to be finalised before procurement — changes post-procurement may attract additional charges.',
  'All payments to be made as per the schedule above. Work progresses only upon receipt of due instalments.',
  'Any disputes shall be subject to the jurisdiction of courts in Coimbatore.',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtRupees(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TableRow =
  | { kind: 'room-header'; name: string }
  | { kind: 'line'; line: QuoteLine; seq: number }
  | { kind: 'room-subtotal'; name: string; totalPaise: number };

function buildTableRows(lines: QuoteLine[]): TableRow[] {
  const map = new Map<string, { name: string; lines: QuoteLine[]; totalPaise: number }>();
  for (const line of lines) {
    const key = line.room.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: line.room.trim(), lines: [], totalPaise: 0 });
    const g = map.get(key)!;
    g.lines.push(line);
    g.totalPaise += line.clientRatePaise * line.qty;
  }

  const rows: TableRow[] = [];
  let seq = 0;
  for (const [, g] of map) {
    rows.push({ kind: 'room-header', name: g.name });
    for (const line of g.lines) {
      seq++;
      rows.push({ kind: 'line', line, seq });
    }
    rows.push({ kind: 'room-subtotal', name: g.name, totalPaise: g.totalPaise });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function QuotePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }                  = use(params);
  const [quote, setQuote]       = useState<Quote | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchQuote = useCallback(() => {
    fetch(`/api/v1/quotes/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json() as Promise<{ data: Quote }>;
      })
      .then((body) => { if (body) setQuote(body.data); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  // Inject print CSS scoped to #quote-preview-doc so dashboard chrome disappears on print
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #quote-preview-doc, #quote-preview-doc * { visibility: visible; }
        #quote-preview-doc {
          position: fixed;
          top: 0; left: 0;
          width: 100%;
          box-shadow: none;
          padding: 0;
          margin: 0;
          max-width: 100%;
        }
        @page { size: A4; margin: 15mm; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading quotation…</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Quotation not found.</p>
        <Link href="/quotes"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-4 w-4" /> Back to Quotes
        </Link>
      </div>
    );
  }

  const quoteLabel  = `QUO-${quote.id.slice(-6).toUpperCase()}`;
  const issueDate   = new Date(quote.createdAt);
  const validUntil  = new Date(issueDate.getTime() + VALIDITY_DAYS * 86_400_000);
  const cgstPaise   = Math.round(quote.gstPaise / 2);
  const sgstPaise   = quote.gstPaise - cgstPaise;
  const tableRows   = buildTableRows(quote.lines ?? []);
  const hasLines    = (quote.lines?.length ?? 0) > 0;

  return (
    <>
      {/* ── Toolbar (hidden by print CSS above) ─────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3"
        style={{ background: '#FFFFFF', borderColor: '#E5E7EB' }}
      >
        <Link
          href={`/quotes/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotation
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent-base)' }}
        >
          <Printer className="h-4 w-4" /> Print / Download PDF
        </button>
      </div>

      {/* ── Document wrapper ─────────────────────────────────────────────── */}
      <div className="min-h-screen py-8 px-4" style={{ background: '#F0EFED' }}>
        <div
          id="quote-preview-doc"
          className="mx-auto max-w-[794px] bg-white shadow-sm"
          style={{ padding: '40px 48px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >

          {/* ── Document header ─────────────────────────────────────────── */}
          <div
            className="flex items-start justify-between mb-8 pb-6"
            style={{ borderBottom: '2px solid #111827' }}
          >
            {/* Company block */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                  style={{ background: '#4F3CC9', letterSpacing: '-0.02em' }}
                >
                  TIS
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight" style={{ color: '#111827' }}>{COMPANY_NAME}</p>
                  {COMPANY_ADDRESS && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>{COMPANY_ADDRESS}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-[11px]" style={{ color: '#6B7280' }}>
                {COMPANY_PHONE && <p>{COMPANY_PHONE}</p>}
                {COMPANY_EMAIL && <p>{COMPANY_EMAIL}</p>}
                {COMPANY_GSTIN && (
                  <p className="font-semibold mt-1" style={{ color: '#374151' }}>
                    GSTIN: {COMPANY_GSTIN}
                  </p>
                )}
              </div>
            </div>

            {/* Quotation label block */}
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold tracking-tight" style={{ color: '#111827' }}>QUOTATION</p>
              <p className="text-base font-bold mt-1" style={{ color: '#4F3CC9' }}>{quoteLabel}</p>
              {quote.version > 1 && (
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>Version {quote.version}</p>
              )}
              <div className="mt-3 space-y-0.5 text-[11px]" style={{ color: '#6B7280' }}>
                <p>
                  Issue Date:{' '}
                  <strong style={{ color: '#374151' }}>{fmtDate(issueDate)}</strong>
                </p>
                <p>
                  Valid Until:{' '}
                  <strong style={{ color: '#374151' }}>{fmtDate(validUntil)}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* ── Client section ───────────────────────────────────────────── */}
          <div className="mb-8">
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: '#9CA3AF' }}
            >
              Prepared For
            </p>
            <p className="text-base font-semibold" style={{ color: '#111827' }}>
              {quote.leadContactName ?? '—'}
            </p>
            {quote.leadContactPhone && (
              <p className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>
                {quote.leadContactPhone}
              </p>
            )}
            {quote.projectName && (
              <p className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>
                Project: {quote.projectName}
              </p>
            )}
          </div>

          {/* ── Line items table ─────────────────────────────────────────── */}
          {!hasLines ? (
            <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>
              No line items have been added to this quotation.
            </p>
          ) : (
            <div className="mb-8">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th className="py-2 px-3 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '2.5rem' }}>
                      Sl.
                    </th>
                    <th className="py-2 px-3 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                      Description
                    </th>
                    <th className="py-2 px-3 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '5rem' }}>
                      Unit
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '3.5rem' }}>
                      Qty
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '7rem' }}>
                      Rate
                    </th>
                    <th className="py-2 px-3 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '7rem' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => {
                    if (row.kind === 'room-header') {
                      return (
                        <tr
                          key={`rh-${idx}`}
                          style={{ background: '#F3F4F6', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}
                        >
                          <td
                            colSpan={6}
                            className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider"
                            style={{ color: '#374151' }}
                          >
                            {row.name}
                          </td>
                        </tr>
                      );
                    }

                    if (row.kind === 'line') {
                      const { line, seq } = row;
                      return (
                        <tr key={line.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td className="py-2 px-3 text-[11px] tabular-nums" style={{ color: '#9CA3AF' }}>
                            {seq}
                          </td>
                          <td className="py-2 px-3" style={{ color: '#111827' }}>
                            <p className="text-[13px]">{line.item}</p>
                            {line.description && (
                              <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                                {line.description}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[12px]" style={{ color: '#6B7280' }}>
                            {line.unit}
                          </td>
                          <td className="py-2 px-3 text-right text-[13px] tabular-nums" style={{ color: '#374151' }}>
                            {line.qty}
                          </td>
                          <td className="py-2 px-3 text-right text-[13px] tabular-nums" style={{ color: '#374151' }}>
                            {fmtRupees(line.clientRatePaise)}
                          </td>
                          <td className="py-2 px-3 text-right text-[13px] font-semibold tabular-nums" style={{ color: '#111827' }}>
                            {fmtRupees(line.clientRatePaise * line.qty)}
                          </td>
                        </tr>
                      );
                    }

                    // room-subtotal
                    return (
                      <tr key={`rs-${idx}`} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td
                          colSpan={5}
                          className="py-1.5 px-3 text-right text-[11px] font-semibold"
                          style={{ color: '#9CA3AF' }}
                        >
                          {row.name} Total
                        </td>
                        <td
                          className="py-1.5 px-3 text-right text-[12px] font-bold tabular-nums"
                          style={{ color: '#111827' }}
                        >
                          {fmtRupees(row.totalPaise)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Totals ───────────────────────────────────────────────────── */}
          {hasLines && (
            <div className="flex justify-end mb-10">
              <div style={{ width: '18rem' }}>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: '#6B7280' }}>Subtotal</span>
                    <span className="tabular-nums font-medium" style={{ color: '#111827' }}>
                      {fmtRupees(quote.subtotalPaise)}
                    </span>
                  </div>
                  {quote.gstPaise > 0 && (
                    <>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: '#6B7280' }}>CGST @ 9%</span>
                        <span className="tabular-nums" style={{ color: '#374151' }}>
                          {fmtRupees(cgstPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: '#6B7280' }}>SGST @ 9%</span>
                        <span className="tabular-nums" style={{ color: '#374151' }}>
                          {fmtRupees(sgstPaise)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="flex justify-between items-center mt-3 pt-3"
                  style={{ borderTop: '2px solid #111827' }}
                >
                  <span className="text-base font-bold" style={{ color: '#111827' }}>Grand Total</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: '#4F3CC9' }}>
                    {fmtRupees(quote.totalPaise)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Commercial terms ─────────────────────────────────────────── */}
          <div
            className="grid gap-8 mb-8 pt-6"
            style={{ borderTop: '1px solid #E5E7EB', gridTemplateColumns: '1fr 1fr' }}
          >
            {/* Payment schedule */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
                Payment Schedule
              </p>
              <ul className="space-y-1.5">
                {PAYMENT_TERMS.map((term) => (
                  <li key={term} className="flex gap-2 text-[12px]" style={{ color: '#374151' }}>
                    <span style={{ color: '#9CA3AF', flexShrink: 0 }}>•</span>
                    {term}
                  </li>
                ))}
              </ul>
            </div>

            {/* Scope */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
                Scope of Work
              </p>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#374151' }}>Included:</p>
              <ul className="space-y-1 mb-3">
                {SCOPE_INCLUSIONS.map((item) => (
                  <li key={item} className="flex gap-2 text-[12px]" style={{ color: '#374151' }}>
                    <span style={{ color: '#22C55E', flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#374151' }}>Excluded:</p>
              <ul className="space-y-1">
                {SCOPE_EXCLUSIONS.map((item) => (
                  <li key={item} className="flex gap-2 text-[12px]" style={{ color: '#374151' }}>
                    <span style={{ color: '#EF4444', flexShrink: 0 }}>✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Terms & Conditions ───────────────────────────────────────── */}
          <div className="mb-10 pt-5" style={{ borderTop: '1px solid #E5E7EB' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>
              Terms &amp; Conditions
            </p>
            <ol className="list-decimal list-outside pl-4 space-y-1.5">
              {TERMS_AND_CONDITIONS.map((term, i) => (
                <li key={i} className="text-[12px]" style={{ color: '#6B7280' }}>
                  {term}
                </li>
              ))}
            </ol>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div
            className="flex justify-between items-end pt-5"
            style={{ borderTop: '1px solid #E5E7EB' }}
          >
            <div>
              <p className="text-[11px] mb-6" style={{ color: '#9CA3AF' }}>
                For <strong style={{ color: '#374151' }}>{COMPANY_NAME}</strong>
              </p>
              <p className="text-[11px]" style={{ color: '#6B7280' }}>Authorised Signatory</p>
            </div>
            <div className="text-right text-[11px]" style={{ color: '#9CA3AF' }}>
              <p>Thank you for your business.</p>
              {quote.version > 1 && (
                <p className="mt-1">
                  This is Version {quote.version} and supersedes all previous quotations.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
