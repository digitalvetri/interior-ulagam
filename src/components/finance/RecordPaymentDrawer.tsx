'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  /** Label shown below the drawer title, e.g. "ABC Corp — Milestone 2" */
  contextLabel?: string;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function RecordPaymentDrawer({
  open,
  onClose,
  onSuccess,
  defaultAmountPaise,
  defaultInvoiceId,
  defaultProjectId,
  defaultCustomerId,
  contextLabel,
}: RecordPaymentDrawerProps) {
  const defaultRupees = defaultAmountPaise
    ? String(Math.round(defaultAmountPaise / 100))
    : '';

  const [amountRupees, setAmountRupees] = useState(defaultRupees);
  const [mode,         setMode]         = useState<Mode>('upi');
  const [reference,    setReference]    = useState('');
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [note,         setNote]         = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

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
    const rupees = Number(amountRupees.replace(/,/g, ''));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter a valid amount in rupees.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: Math.round(rupees * 100),
          mode,
          reference:   reference.trim() || undefined,
          receivedAt:  new Date(`${receivedDate}T12:00:00`).toISOString(),
          note:        note.trim() || undefined,
          invoiceId:   defaultInvoiceId   ?? undefined,
          projectId:   defaultProjectId   ?? undefined,
          customerId:  defaultCustomerId  ?? undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? 'Failed to record payment.');
        return;
      }

      reset();
      onSuccess(body.data.id, body.data.receiptNumber ?? '');
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

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="rp-amount">Amount (₹) *</Label>
          <Input
            id="rp-amount"
            type="text"
            inputMode="numeric"
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
