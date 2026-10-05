'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { istToday } from '@/lib/dates/ist';

const MODES = [
  { value: 'upi',      label: 'UPI' },
  { value: 'cash',     label: 'Cash' },
  { value: 'bank',     label: 'Bank Transfer' },
  { value: 'cheque',   label: 'Cheque' },
  { value: 'card',     label: 'Card' },
  { value: 'razorpay', label: 'Razorpay' },
] as const;

type Mode = typeof MODES[number]['value'];

export interface RecordPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (paymentId: string, receiptNumber: string) => void;
  defaultAmountPaise?: number;
  defaultInvoiceId?: string | null;
  defaultProjectId?: string | null;
  defaultCustomerId?: string | null;
  /** Apply the payment to this milestone (sent as an explicit allocation). */
  defaultMilestoneId?: string | null;
  /** Label shown below the drawer title, e.g. "ABC Corp — Milestone 2" */
  contextLabel?: string;
}

function todayISO() {
  return istToday();
}

/** Paise → rupees text with up to 2 decimals (no float drift). */
function paiseToRupeesText(paise: number): string {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p === 0 ? String(r) : `${r}.${String(p).padStart(2, '0')}`;
}

/** Rupees text → integer paise, or null when not a valid amount (max 2 decimals). */
function rupeesTextToPaise(text: string): number | null {
  const t = text.replace(/,/g, '').trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

interface ProjectOption { id: string; name: string }

export function RecordPaymentDrawer({
  open,
  onClose,
  onSuccess,
  defaultAmountPaise,
  defaultInvoiceId,
  defaultProjectId,
  defaultCustomerId,
  defaultMilestoneId,
  contextLabel,
}: RecordPaymentDrawerProps) {
  const defaultRupees = defaultAmountPaise ? paiseToRupeesText(defaultAmountPaise) : '';
  // With no project, invoice or client given, the payment must be tied to a project.
  const needsProject = !defaultInvoiceId && !defaultProjectId && !defaultCustomerId;

  const [amountRupees, setAmountRupees] = useState(defaultRupees);
  const [mode,         setMode]         = useState<Mode>('upi');
  const [reference,    setReference]    = useState('');
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [note,         setNote]         = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [projectId,    setProjectId]    = useState('');
  const [projectList,  setProjectList]  = useState<ProjectOption[]>([]);

  // Re-sync the form each time the drawer opens for a (possibly different) row.
  // Adjusted during render rather than in an effect, per React's guidance.
  const openKey = open ? `${defaultRupees}|${defaultInvoiceId ?? ''}|${defaultProjectId ?? ''}|${defaultMilestoneId ?? ''}` : '';
  const [syncedKey, setSyncedKey] = useState('');
  if (openKey !== syncedKey) {
    setSyncedKey(openKey);
    if (open) {
      setAmountRupees(defaultRupees);
      setMode('upi');
      setReference('');
      setReceivedDate(todayISO());
      setNote('');
      setError(null);
      setProjectId('');
    }
  }

  useEffect(() => {
    if (!open || !needsProject || projectList.length) return;
    fetch('/api/v1/projects?limit=500')
      .then(r => (r.ok ? r.json() : null))
      .then((body: { data?: ProjectOption[] } | null) => setProjectList((body?.data ?? []).map(p => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, [open, needsProject, projectList.length]);

  function reset() {
    setAmountRupees(defaultRupees);
    setMode('upi');
    setReference('');
    setReceivedDate(todayISO());
    setNote('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    const amountPaise = rupeesTextToPaise(amountRupees);
    if (amountPaise === null || amountPaise <= 0) {
      setError('Enter a valid amount in rupees (up to 2 decimals).');
      return;
    }
    if (needsProject && !projectId) {
      setError('Pick the project this payment is for.');
      return;
    }

    // Pre-open the receipt window now (synchronous click context) so the
    // browser doesn't block the popup. We'll navigate it after the PDF is ready.
    const receiptWindow = window.open('', '_blank');

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          mode,
          reference:   reference.trim() || undefined,
          receivedAt:  new Date(`${receivedDate}T12:00:00`).toISOString(),
          note:        note.trim() || undefined,
          invoiceId:   defaultInvoiceId   ?? undefined,
          projectId:   defaultProjectId ?? (projectId || undefined),
          customerId:  defaultCustomerId  ?? undefined,
          allocations: defaultMilestoneId ? [{ milestoneId: defaultMilestoneId, amountPaise }] : undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? 'Failed to record payment.');
        return;
      }

      const paymentId = body.data.id as string;

      // Generate receipt PDF and navigate the pre-opened window to it
      try {
        const receiptRes = await fetch(`/api/v1/payments/${paymentId}/receipt`, { method: 'POST' });
        const receiptBody = await receiptRes.json().catch(() => ({}));
        if (receiptRes.ok && receiptBody?.data?.pdfUrl && receiptWindow) {
          receiptWindow.location.href = receiptBody.data.pdfUrl as string;
        } else {
          receiptWindow?.close();
        }
      } catch { receiptWindow?.close(); }

      reset();
      onSuccess(paymentId, body.data.receiptNumber ?? '');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Record payment"
      width="w-[420px]"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & generate receipt'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {contextLabel && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{contextLabel}</p>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {needsProject && (
          <div className="space-y-1.5">
            <Label htmlFor="rp-project">Project *</Label>
            <select
              id="rp-project"
              className="studio-input w-full text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select a project…</option>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-amount">Amount (₹) *</Label>
          <Input
            id="rp-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
          />
        </div>

        {/* Mode */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-mode">Payment mode *</Label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className="rounded-lg px-3 py-2 text-xs font-medium border transition-colors"
                style={{
                  background: mode === m.value ? 'var(--accent-base)' : 'var(--surface-page)',
                  color:      mode === m.value ? '#fff'                : 'var(--text-primary)',
                  borderColor: mode === m.value ? 'var(--accent-base)' : 'var(--border-subtle)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-ref">Reference / UTR / Cheque #</Label>
          <Input
            id="rp-ref"
            placeholder="e.g. UPI-123456789"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-date">Payment date *</Label>
          <Input
            id="rp-date"
            type="date"
            value={receivedDate}
            max={todayISO()}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-note">Note (optional)</Label>
          <Textarea
            id="rp-note"
            rows={2}
            placeholder="Internal note about this receipt…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Drawer>
  );
}
