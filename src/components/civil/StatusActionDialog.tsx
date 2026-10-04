'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { CivilJobStatus, CivilStatusChangeInput } from '@/types/civil';
import { todayIso } from './format';

const TITLE: Record<CivilJobStatus, string> = {
  done: 'Move back to Done',
  billed: 'Mark as Billed',
  paid: 'Mark as Paid',
};

interface Props {
  /** Target status; null keeps the dialog closed. */
  to: CivilJobStatus | null;
  /** e.g. "Job #192" or "4 jobs" */
  subject: string;
  /** Pre-fill when the job already has a bill. */
  billNo?: string | null;
  billDate?: string | null;
  /** True when this change moves a job backwards and will clear bill/payment details. */
  clearsBilling?: boolean;
  /** Several jobs at once: bill details only fill in jobs that have none yet. */
  bulk?: boolean;
  onClose: () => void;
  /** Resolve with an error message to keep the dialog open, or null on success. */
  onConfirm: (change: CivilStatusChangeInput) => Promise<string | null>;
}

/**
 * The one place a status changes. Billing asks for the bill number and date,
 * payment asks for the date received. Everything else is a single confirm.
 */
export function StatusActionDialog({ to, subject, billNo, billDate, clearsBilling, bulk, onClose, onConfirm }: Props) {
  const [form, setForm] = useState({ billNo: '', billDate: '', paidDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!to) return;
    setForm({ billNo: billNo ?? '', billDate: billDate ?? todayIso(), paidDate: todayIso() });
    setError(null);
  }, [to, billNo, billDate]);

  async function confirm() {
    if (!to) return;
    const change: CivilStatusChangeInput = { to };
    if (to === 'billed') {
      if (!form.billNo.trim() || !form.billDate) { setError('Enter the bill number and bill date.'); return; }
      change.billNo = form.billNo.trim();
      change.billDate = form.billDate;
    }
    if (to === 'paid') {
      if (!form.paidDate) { setError('Enter the date the payment was received.'); return; }
      change.paidDate = form.paidDate;
      if (!billNo && form.billNo.trim()) change.billNo = form.billNo.trim();
      if (!billDate && form.billDate) change.billDate = form.billDate;
    }
    setBusy(true); setError(null);
    const err = await onConfirm(change);
    setBusy(false);
    if (err) setError(err); else onClose();
  }

  const needsBillInfo = to === 'billed' || (to === 'paid' && !billNo);

  return (
    <Dialog open={!!to} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        // A plain confirm (no fields) should confirm on Enter, not land on Cancel.
        onOpenAutoFocus={e => {
          if (to === 'billed' || to === 'paid') return;
          e.preventDefault();
          submitRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{to ? TITLE[to] : ''}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-1"
          onSubmit={e => { e.preventDefault(); void confirm(); }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{subject}</span>
            {to === 'done' && ' — back to finished, not billed yet.'}
            {to === 'billed' && ' — record the bill sent to the company.'}
            {to === 'paid' && ' — record that the company has paid.'}
          </p>

          {needsBillInfo && bulk && to === 'paid' && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Bill details are used only for jobs not billed yet — billed jobs keep their own bill.
            </p>
          )}
          {needsBillInfo && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bill number" required={!(bulk && to === 'paid')}>
                <input
                  autoFocus value={form.billNo} onChange={e => setForm(f => ({ ...f, billNo: e.target.value }))}
                  placeholder="e.g. B-118" className="studio-input h-9 w-full text-sm"
                />
              </Field>
              <Field label="Bill date" required={!(bulk && to === 'paid')}>
                <input
                  type="date" value={form.billDate} onChange={e => setForm(f => ({ ...f, billDate: e.target.value }))}
                  className="studio-input h-9 w-full text-sm"
                />
              </Field>
            </div>
          )}

          {to === 'paid' && (
            <Field label="Payment received on" required>
              <input
                autoFocus={!needsBillInfo} type="date" value={form.paidDate}
                onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                className="studio-input h-9 w-full text-sm"
              />
            </Field>
          )}

          {clearsBilling && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Moving back clears the bill and payment details recorded after this stage.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <DialogFooter>
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button ref={submitRef} type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {busy ? 'Saving…' : to ? TITLE[to] : ''}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
        {label}{required && <span style={{ color: 'var(--accent-base)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
