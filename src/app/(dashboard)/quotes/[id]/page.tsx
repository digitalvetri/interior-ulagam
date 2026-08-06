'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ClipboardList, Download, Phone, Tag, Layers, User,
  CheckCircle2, Send, MessageCircle, Mail, FileText, IndianRupee,
  Upload, FileDown, ChevronDown, ChevronRight,
} from 'lucide-react';
import { LineItemRow } from '@/components/quotes/LineItemRow';
import { AddLineForm } from '@/components/quotes/AddLineForm';
import { MarginSummary } from '@/components/quotes/MarginSummary';
import { ImportBOQModal } from '@/components/quotes/ImportBOQModal';
import { Quote, QuoteLine, QuoteStatus } from '@/types/quotes';
import { formatRupees } from '@/lib/utils';

const STATUS_CONFIG: Record<QuoteStatus, { label: string; bg: string; color: string; dot: string }> = {
  draft:    { label: 'Draft',    bg: '#F5F5F5', color: '#374151', dot: '#9CA3AF' },
  sent:     { label: 'Sent',     bg: '#FFFBEB', color: '#92400E', dot: '#F59E0B' },
  approved: { label: 'Approved', bg: '#F0FDF4', color: '#14532D', dot: '#16A34A' },
  revised:  { label: 'Revised',  bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
};

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quote, setQuote]                   = useState<Quote | null>(null);
  const [loading, setLoading]               = useState(true);
  const [actionPending, setActionPending]   = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [showAddForm, setShowAddForm]       = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());

  const fetchQuote = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/quotes/${id}`)
      .then((r) => r.json())
      .then(({ data }: { data: Quote }) => { setQuote(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  function toggleRoom(key: string) {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleLineUpdate(
    lineId: string,
    data: Partial<Pick<QuoteLine, 'room' | 'item' | 'unit' | 'qty' | 'costRatePaise' | 'clientRatePaise'>>,
  ) {
    setQuote((prev) => {
      if (!prev?.lines) return prev;
      return {
        ...prev,
        lines: prev.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                ...data,
                marginPaise:
                  ((data.clientRatePaise ?? l.clientRatePaise) -
                   (data.costRatePaise  ?? l.costRatePaise)) *
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
    setShowAddForm(false);
    fetchQuote();
  }

  async function handleLineDuplicate(line: QuoteLine) {
    try {
      const res = await fetch(`/api/v1/quotes/${id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room:            line.room,
          item:            line.item + ' (copy)',
          unit:            line.unit,
          qty:             line.qty,
          costRatePaise:   line.costRatePaise,
          clientRatePaise: line.clientRatePaise,
        }),
      });
      if (res.ok) fetchQuote();
    } catch {
      // Silently ignore — user can retry
    }
  }

  async function handleExportExcel() {
    if (!quote) return;
    const XLSX = await import('xlsx');
    const wb   = XLSX.utils.book_new();

    const sheetRows: (string | number)[][] = [
      ['Room', 'Item', 'Unit', 'Qty', 'Cost Rate (₹)', 'Client Rate (₹)', 'Margin (₹)', 'Total (₹)'],
    ];

    for (const [, { displayName, lines: roomLines }] of roomGroups) {
      sheetRows.push([displayName.toUpperCase(), '', '', '', '', '', '', '']);
      for (const l of roomLines) {
        sheetRows.push([
          '',
          l.item,
          l.unit,
          l.qty,
          l.costRatePaise   / 100,
          l.clientRatePaise / 100,
          l.marginPaise     / 100,
          (l.clientRatePaise * l.qty) / 100,
        ]);
      }
    }

    if (lines.length > 0) {
      sheetRows.push(['', '', '', '', '', '', '', '']);
      sheetRows.push(['', '', '', '', '', '', 'Subtotal', quote.subtotalPaise / 100]);
      sheetRows.push(['', '', '', '', '', '', 'GST (18%)', quote.gstPaise     / 100]);
      sheetRows.push(['', '', '', '', '', '', 'TOTAL',    quote.totalPaise    / 100]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 22 }, { wch: 36 }, { wch: 8 }, { wch: 6 },
      { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    XLSX.writeFile(wb, `${quoteLabel}.xlsx`);
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

  const lines = quote?.lines ?? [];

  // Normalise room keys so "Living Room" and "living room" merge into one group
  const roomGroups = useMemo(() => {
    const map = new Map<string, { displayName: string; lines: QuoteLine[]; totalPaise: number }>();
    for (const line of lines) {
      const key = line.room.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { displayName: line.room.trim(), lines: [], totalPaise: 0 });
      }
      const group = map.get(key)!;
      group.lines.push(line);
      group.totalPaise += line.clientRatePaise * line.qty;
    }
    return map;
  }, [lines]);

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-4 w-28 rounded-lg" />
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-10 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  /* ── Not found ────────────────────────────────────────────────────────── */
  if (!quote) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 gap-5">
        <FileText className="h-12 w-12" style={{ color: '#D1CAC0' }} />
        <p className="text-base font-medium" style={{ color: '#DC2626' }}>Quote not found.</p>
        <Link href="/quotes"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: '#F0EEE9', color: '#6B6459' }}>
          <ArrowLeft className="h-4 w-4" />Back to Quotes
        </Link>
      </div>
    );
  }

  const cfg        = STATUS_CONFIG[quote.status];
  const quoteLabel = `QUO-${quote.id.slice(-6).toUpperCase()}`;
  const isDraft    = quote.status === 'draft';
  const hasLead    = Boolean(quote.leadId);
  const stageLabel = quote.leadStage
    ? quote.leadStage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const phone    = quote.leadContactPhone?.replace(/\D/g, '');
  const waText   = encodeURIComponent(`Hello ${quote.leadContactName ?? ''}, please find your quotation ${quoteLabel} from The Interior Studio.`);
  const mailSubj = encodeURIComponent(`Quotation ${quoteLabel} — The Interior Studio`);
  const mailBody = encodeURIComponent(
    `Dear ${quote.leadContactName ?? 'Client'},\n\nPlease find your quotation (${quoteLabel}) from The Interior Studio.\n\nRegards,\nThe Interior Studio`,
  );

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <>
      {showImportModal && (
        <ImportBOQModal
          quoteId={id}
          onImported={fetchQuote}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <div className="p-6 space-y-5">

        {/* ── Back navigation ──────────────────────────────────────────────── */}
        {hasLead ? (
          <Link href={`/leads/${quote.leadId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: '#6B6459' }}>
            <ArrowLeft className="h-4 w-4" />{quote.leadContactName ?? 'Lead'}
          </Link>
        ) : (
          <Link href="/quotes"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: '#6B6459' }}>
            <ArrowLeft className="h-4 w-4" />All Quotes
          </Link>
        )}

        {/* ── Hero header card ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">

            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#F5F3FF' }}>
                <ClipboardList className="h-6 w-6" style={{ color: '#7C3AED' }} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold" style={{ color: '#1C1916' }}>{quoteLabel}</h1>
                  {quote.version > 1 && (
                    <span className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{ background: '#EDE9FE', color: '#6D4FE0' }}>
                      v{quote.version}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#A79E8E' }}>
                  Created {fmtDate(quote.createdAt)}
                  {quote.sentAt     && ` · Sent ${fmtDate(quote.sentAt)}`}
                  {quote.approvedAt && ` · Approved ${fmtDate(quote.approvedAt)}`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {phone && (
                <a href={`https://wa.me/${phone}?text=${waText}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ borderColor: '#BBF7D0', background: '#F0FDF4', color: '#14532D' }}>
                  <MessageCircle className="h-4 w-4" />WhatsApp
                </a>
              )}
              <a href={`mailto:?subject=${mailSubj}&body=${mailBody}`}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: '#F0EEE9', background: '#FAFAF8', color: '#6B6459' }}>
                <Mail className="h-4 w-4" />Email
              </a>
              {quote.pdfUrl && (
                <a href={quote.pdfUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ borderColor: '#F0EEE9', background: '#FAFAF8', color: '#6B6459' }}>
                  <Download className="h-4 w-4" />Download PDF
                </a>
              )}
              {isDraft && (
                <button type="button"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  onClick={handleSendQuote} disabled={actionPending}>
                  <Send className="h-4 w-4" />
                  {actionPending ? 'Sending…' : 'Send Quotation'}
                </button>
              )}
              {quote.status === 'sent' && (
                <button type="button"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#16A34A' }}
                  onClick={handleMarkApproved} disabled={actionPending}>
                  <CheckCircle2 className="h-4 w-4" />
                  {actionPending ? 'Approving…' : 'Mark Approved'}
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mt-3 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              {actionError}
            </div>
          )}
        </div>

        {/* ── Client / project context ──────────────────────────────────────── */}
        {(hasLead || quote.projectName) && (
          <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-x-6 gap-y-3"
            style={{ background: '#FAFAF8', borderColor: '#F0EEE9' }}>

            {quote.leadContactName && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#EDE9FE' }}>
                  <User className="h-4 w-4" style={{ color: '#7C3AED' }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#A79E8E' }}>Client</p>
                  <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{quote.leadContactName}</p>
                </div>
              </div>
            )}

            {quote.leadContactPhone && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F0FDF4' }}>
                  <Phone className="h-4 w-4" style={{ color: '#16A34A' }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#A79E8E' }}>Phone</p>
                  <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{quote.leadContactPhone}</p>
                </div>
              </div>
            )}

            {stageLabel && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FFFBEB' }}>
                  <Layers className="h-4 w-4" style={{ color: '#D97706' }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#A79E8E' }}>Stage</p>
                  <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{stageLabel}</p>
                </div>
              </div>
            )}

            {quote.leadBudgetBand && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#EFF6FF' }}>
                  <IndianRupee className="h-4 w-4" style={{ color: '#1E40AF' }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#A79E8E' }}>Budget</p>
                  <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{quote.leadBudgetBand}</p>
                </div>
              </div>
            )}

            {quote.projectName && !hasLead && (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F5F3FF' }}>
                  <Tag className="h-4 w-4" style={{ color: '#7C3AED' }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#A79E8E' }}>Project</p>
                  <p className="text-sm font-semibold" style={{ color: '#1C1916' }}>{quote.projectName}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_296px]">

          {/* Left: line items table */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#F0EEE9', background: '#FFFFFF' }}>

            {/* Table toolbar */}
            <div className="flex items-center justify-between gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid #F0EEE9' }}>
              <h2 className="text-sm font-bold flex-shrink-0" style={{ color: '#1C1916' }}>
                Line Items
                {lines.length > 0 && (
                  <span className="ml-2 text-xs font-semibold rounded-full px-2 py-0.5"
                    style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                    {lines.length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Export Excel — available regardless of status */}
                {lines.length > 0 && (
                  <button type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-gray-50"
                    style={{ borderColor: '#F0EEE9', color: '#6B6459' }}>
                    <FileDown className="h-3.5 w-3.5" />
                    Export Excel
                  </button>
                )}
                {/* Import BOQ + Add Line — draft only */}
                {isDraft && !showAddForm && (
                  <>
                    <button type="button"
                      onClick={() => setShowImportModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-violet-50"
                      style={{ borderColor: '#EDE9FE', color: '#7C3AED' }}>
                      <Upload className="h-3.5 w-3.5" />
                      Import BOQ
                    </button>
                    <button type="button"
                      onClick={() => setShowAddForm(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: '#7C3AED', color: '#FFFFFF' }}>
                      + Add Line
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #F0EEE9' }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Item</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Unit</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Cost Rate ₹</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Client Rate ₹</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A79E8E' }}>Margin ₹</th>
                    <th className="px-4 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center">
                        <FileText className="h-9 w-9 mx-auto mb-3" style={{ color: '#D1CAC0' }} />
                        <p className="text-sm font-medium" style={{ color: '#A79E8E' }}>No line items yet</p>
                        <p className="text-xs mt-1" style={{ color: '#C4BCAF' }}>
                          Click &quot;Add Line&quot; or &quot;Import BOQ&quot; above to add rooms and items.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    Array.from(roomGroups.entries()).flatMap(([key, { displayName, lines: roomLines, totalPaise: roomTotal }]) => {
                      const isCollapsed = collapsedRooms.has(key);
                      return [
                        <tr
                          key={`room-hdr-${key}`}
                          style={{
                            background:   '#F7F6F3',
                            borderBottom: '1px solid #F0EEE9',
                            borderTop:    '1px solid #F0EEE9',
                            cursor:       'pointer',
                          }}
                          onClick={() => toggleRoom(key)}>
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isCollapsed
                                  ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#A79E8E' }} />
                                  : <ChevronDown  className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#A79E8E' }} />}
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6B6459' }}>
                                  {displayName}
                                </span>
                                <span className="ml-1 text-[10px]" style={{ color: '#A79E8E' }}>
                                  {roomLines.length} item{roomLines.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {/* Show room total when collapsed so user can scan room costs at a glance */}
                              <span
                                className="text-[11px] font-semibold transition-opacity"
                                style={{ color: '#7C3AED', opacity: isCollapsed ? 1 : 0.4 }}>
                                {formatRupees(roomTotal)}
                              </span>
                            </div>
                          </td>
                        </tr>,
                        ...(isCollapsed ? [] : roomLines.map((line) => (
                          <LineItemRow
                            key={line.id}
                            line={line}
                            isDraft={isDraft}
                            onDelete={handleLineDelete}
                            onUpdate={handleLineUpdate}
                            onDuplicate={handleLineDuplicate}
                          />
                        ))),
                      ];
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Inline add form */}
            {showAddForm && (
              <div style={{ borderTop: '1px solid #F0EEE9', background: '#FAFAF8' }}>
                <AddLineForm
                  quoteId={id}
                  onSuccess={handleLineAdded}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            )}
          </div>

          {/* Right: summary sidebar */}
          <MarginSummary
            lines={lines}
            subtotalPaise={quote.subtotalPaise}
            gstPaise={quote.gstPaise}
            totalPaise={quote.totalPaise}
          />
        </div>
      </div>
    </>
  );
}
