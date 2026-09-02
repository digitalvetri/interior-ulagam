'use client';

import { useState } from 'react';
import { Eye, Download, MessageCircle, Loader2, FileText } from 'lucide-react';

interface DocumentActionsProps {
  pdfUrl?: string | null;
  docType: 'quote' | 'invoice' | 'receipt' | 'po';
  docNumber: string;
  /** Job endpoint to trigger PDF generation when pdfUrl is missing */
  generateEndpoint?: string;
  /** WhatsApp phone number (digits only, with country code e.g. 919876543210) */
  waPhone?: string | null;
  waCaption?: string;
  className?: string;
}

const DOC_LABELS: Record<DocumentActionsProps['docType'], string> = {
  quote:   'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  po:      'Purchase Order',
};

export function DocumentActions({
  pdfUrl,
  docType,
  docNumber,
  generateEndpoint,
  waPhone,
  waCaption,
  className,
}: DocumentActionsProps) {
  const [generating, setGenerating] = useState(false);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(pdfUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const docLabel = DOC_LABELS[docType];

  async function handleGenerate() {
    if (!generateEndpoint) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(generateEndpoint, { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { data?: { pdfUrl?: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Generation failed (${res.status})`);
      if (body.data?.pdfUrl) setLocalPdfUrl(body.data.pdfUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  }

  const effectivePdfUrl = localPdfUrl ?? pdfUrl;

  const waText = waCaption
    ?? `Please find your ${docLabel} ${docNumber} attached.`;
  const waLink = waPhone
    ? `https://wa.me/${waPhone.replace(/\D/g, '')}?text=${encodeURIComponent(waText + (effectivePdfUrl ? '\n' + effectivePdfUrl : ''))}`
    : null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : null}

      {effectivePdfUrl ? (
        <>
          <a
            href={effectivePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            title={`Preview ${docLabel}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </a>
          <a
            href={effectivePdfUrl}
            download={`${docLabel}-${docNumber}.pdf`}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-muted)]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            title={`Download ${docLabel}`}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: '#25D366',
                color: '#25D366',
              }}
              title="Send on WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          ) : null}
        </>
      ) : generateEndpoint ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 hover:bg-[var(--surface-muted)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {generating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileText className="h-3.5 w-3.5" />}
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          PDF not yet generated
        </span>
      )}
    </div>
  );
}
