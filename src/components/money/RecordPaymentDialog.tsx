'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, MessageCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { allocateOldestFirst } from '@/lib/project-money/calc';
import { Field } from '@/components/civil/StatusActionDialog';
import { apiError, inputToPaise, paiseToInput, todayIso } from '@/components/civil/format';
import { MILESTONE_STATUS_LABEL, type MoneyMilestone, type ProjectMoney, type RecordedPayment } from './types';

type Mode = 'upi' | 'cash' | 'bank' | 'cheque' | 'card';

const MODES: { key: Mode; label: string; refHint: string }[] = [
  { key: 'upi', label: 'UPI', refHint: 'UTR / UPI ref' },
  { key: 'cash', label: 'Cash', refHint: 'Received by (optional)' },
  { key: 'bank', label: 'Bank transfer', refHint: 'UTR / NEFT ref' },
  { key: 'cheque', label: 'Cheque', refHint: 'Cheque no.' },
  { key: 'card', label: 'Card', refHint: 'Card txn ref' },
];

interface Props {
  open: boolean;
  onClose(): void;
  onSaved(): void;
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string | null;
}

interface Done { id: string; receiptNumber: string | null; amountPaise: number; allocatedPaise: number; advancePaise: number }

/**
 * Record money received from a client. It is applied to the project's oldest
 * due milestones first (editable), and anything extra is kept as an advance.
 */
export function RecordPaymentDialog({
  open, onClose, onSaved, projects, defaultProjectId, customerId, customerName, customerPhone,
}: Props) {
  const [projectId, setProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<Mode>('upi');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [milestones, setMilestones] = useState<MoneyMilestone[]>([]);
  const [loadingMs, setLoadingMs] = useState(false);
  /** Per-milestone amounts the user typed; null = use the suggested split. */
  const [split, setSplit] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  // Fresh form each time it opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setProjectId(defaultProjectId ?? (projects.length === 1 ? projects[0].id : ''));
    setAmount(''); setDate(todayIso()); setMode('upi'); setReference(''); setNote('');
    setSplit(null); setError(null); setDone(null);
  }
  if (!open && wasOpen) setWasOpen(false);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoadingMs(true);
      fetch(`/api/v1/projects/${projectId}/money`)
        .then(r => (r.ok ? r.json() : null))
        .then((j: { data?: ProjectMoney } | null) => {
          if (!cancelled) setMilestones((j?.data?.milestones ?? []).filter(m => m.balancePaise > 0));
        })
        .finally(() => { if (!cancelled) setLoadingMs(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, projectId]);

  const amountPaise = inputToPaise(amount);

  const suggested = useMemo(() => {
    const plan = allocateOldestFirst(amountPaise, milestones.map(m => ({
      id: m.id, balancePaise: m.balancePaise, isDue: m.isDue, order: m.sortOrder,
    })));
    return new Map(plan.allocations.map(a => [a.milestoneId, a.amountPaise]));
  }, [amountPaise, milestones]);

  const applied = useMemo(() => {
    const m = new Map<string, number>();
    for (const ms of milestones) {
      const v = split ? inputToPaise(split[ms.id] ?? '') : suggested.get(ms.id) ?? 0;
      if (v > 0) m.set(ms.id, v);
    }
    return m;
  }, [milestones, split, suggested]);

  const appliedTotal = [...applied.values()].reduce((s, v) => s + v, 0);
  const advance = amountPaise - appliedTotal;
  const overApplied = advance < 0;
  const overBalance = milestones.some(m => (applied.get(m.id) ?? 0) > m.balancePaise);

  function editSplit(id: string, value: string) {
    const base = split ?? Object.fromEntries(milestones.map(m => [m.id, paiseToInput(suggested.get(m.id) ?? 0)]));
    setSplit({ ...base, [id]: value });
  }

  async function save() {
    if (projects.length > 1 && !projectId) { setError('Pick the project this payment is for.'); return; }
    if (amountPaise <= 0) { setError('Enter the amount received.'); return; }
    if (!date) { setError('Enter the date the money was received.'); return; }
    if (overApplied) { setError('The split adds up to more than the payment.'); return; }
    if (overBalance) { setError('A milestone can’t take more than its balance.'); return; }
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        amountPaise, mode,
        receivedAt: new Date(`${date}T12:00:00+05:30`).toISOString(),
        projectId: projectId || null,
        customerId: customerId ?? null,
      };
      if (reference.trim()) body.reference = reference.trim();
      if (note.trim()) body.note = note.trim();
      if (split && projectId) body.allocations = [...applied.entries()].map(([milestoneId, a]) => ({ milestoneId, amountPaise: a }));
      const res = await fetch('/api/v1/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError(await apiError(res, 'Could not record the payment.')); return; }
      const j = (await res.json()) as { data: RecordedPayment };
      setDone({
        id: j.data.id, receiptNumber: j.data.receiptNumber, amountPaise: j.data.amountPaise,
        allocatedPaise: j.data.allocatedPaise, advancePaise: j.data.advancePaise,
      });
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function downloadReceipt() {
    if (!done) return;
    setReceiptBusy(true);
    try {
      const res = await fetch(`/api/v1/payments/${done.id}/receipt`, { method: 'POST' });
      if (!res.ok) { setError(await apiError(res, 'Could not make the receipt.')); return; }
      const j = (await res.json()) as { data: { pdfUrl: string } };
      window.open(j.data.pdfUrl, '_blank', 'noopener');
    } finally { setReceiptBusy(false); }
  }

  const digits = (customerPhone ?? '').replace(/\D/g, '').slice(-10);
  const waText = done
    ? `Dear ${customerName ?? 'Sir/Madam'}, thank you for your payment of ${formatRupees(done.amountPaise)}`
      + `${done.receiptNumber ? ` (receipt ${done.receiptNumber})` : ''}. — Konst Design`
    : '';
  const refHint = MODES.find(m => m.key === mode)?.refHint ?? 'Reference';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) { if (done) onSaved(); else onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{done ? 'Payment recorded' : 'Record payment'}</DialogTitle></DialogHeader>

        {done ? (
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--success-soft)' }}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
              <div className="text-sm" style={{ color: 'var(--success-text)' }}>
                <p className="font-semibold">{formatRupees(done.amountPaise)} received{done.receiptNumber ? ` · ${done.receiptNumber}` : ''}</p>
                <p className="mt-0.5 text-xs">
                  {formatRupees(done.allocatedPaise)} applied to milestones
                  {done.advancePaise > 0 ? ` · ${formatRupees(done.advancePaise)} kept as advance` : ''}
                </p>
              </div>
            </div>
            {error && <ErrorBox text={error} />}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadReceipt()} disabled={receiptBusy}
                className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                {receiptBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download receipt
              </button>
              {digits.length === 10 && (
                <a href={`https://wa.me/91${digits}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
                  <MessageCircle className="h-4 w-4" />Send on WhatsApp
                </a>
              )}
            </div>
            <DialogFooter>
              <button type="button" onClick={onSaved} className="btn-primary px-4 py-2 text-sm">Done</button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4 py-1" onSubmit={e => { e.preventDefault(); void save(); }}>
            {projects.length > 1 && (
              <Field label="Project" required>
                <select value={projectId} onChange={e => { setProjectId(e.target.value); setSplit(null); setMilestones([]); }}
                  className="studio-input h-9 w-full text-sm">
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount received (₹)" required>
                <input autoFocus value={amount} inputMode="decimal" placeholder="0"
                  onChange={e => { setAmount(e.target.value); setSplit(null); }}
                  className="studio-input h-9 w-full text-right text-sm tabular-nums" />
              </Field>
              <Field label="Date received" required>
                <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)}
                  className="studio-input h-9 w-full text-sm" />
              </Field>
            </div>

            <Field label="Mode">
              <div className="flex flex-wrap gap-1.5">
                {MODES.map(m => {
                  const on = mode === m.key;
                  return (
                    <button key={m.key} type="button" onClick={() => setMode(m.key)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                      style={on
                        ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                        : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference">
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder={refHint}
                  className="studio-input h-9 w-full text-sm" />
              </Field>
              <Field label="Note">
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                  className="studio-input h-9 w-full text-sm" />
              </Field>
            </div>

            {projectId && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Apply to</p>
                  {split && (
                    <button type="button" onClick={() => setSplit(null)} className="text-xs font-medium" style={{ color: 'var(--accent-base)' }}>
                      Reset to oldest first
                    </button>
                  )}
                </div>
                {loadingMs ? (
                  <div className="skeleton h-16 w-full rounded-xl" />
                ) : milestones.length === 0 ? (
                  <p className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                    No milestone has a balance — this payment will be kept as an advance.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                    {milestones.map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2"
                        style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{m.label}</p>
                          <p className="text-[11px]" style={{ color: m.status === 'overdue' ? 'var(--danger-text)' : 'var(--text-tertiary)' }}>
                            {MILESTONE_STATUS_LABEL[m.status]} · balance {formatRupees(m.balancePaise)}
                          </p>
                        </div>
                        <input inputMode="decimal" placeholder="0"
                          value={split ? split[m.id] ?? '' : paiseToInput(suggested.get(m.id) ?? 0)}
                          onChange={e => editSplit(m.id, e.target.value)}
                          className="studio-input h-8 w-28 text-right text-sm tabular-nums" />
                      </div>
                    ))}
                  </div>
                )}
                {amountPaise > 0 && advance > 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Advance (not applied): <b>{formatRupees(advance)}</b>
                  </p>
                )}
                {overApplied && (
                  <p className="text-xs" style={{ color: 'var(--danger-text)' }}>
                    The split is {formatRupees(-advance)} more than the payment.
                  </p>
                )}
              </div>
            )}

            {error && <ErrorBox text={error} />}

            <DialogFooter>
              <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Record payment'}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{text}
    </div>
  );
}
