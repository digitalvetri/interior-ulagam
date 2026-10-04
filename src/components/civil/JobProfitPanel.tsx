'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lock, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { jobCost, profitOf } from '@/lib/civil/profit';
import type { CivilJobCostsInput, CivilLineKind } from '@/types/civil';
import { apiError, inputToPaise, paiseToInput } from './format';

// Owner-only. Real costs never appear on the job sheet the office shares,
// in the Excel/PDF downloads, or in any response an accountant can read.

interface CostLine { id: string; description: string; kind: CivilLineKind; amountPaise: number; costPaise: number | null }
interface CostExtra { description: string; amountPaise: number }
interface JobCosts {
  lines: CostLine[];
  extras: CostExtra[];
  billedPaise: number;
  costPaise: number;
  linesWithoutCost: number;
  profitPaise: number;
  marginPct: number | null;
}

const EXTRA_SUGGESTIONS = ['Transport', 'Vehicle hire', 'Food for workers', 'Tools / consumables', 'Helper wages'];

export function profitColor(paise: number): string {
  return paise < 0 ? 'var(--danger-text)' : 'var(--success-text)';
}

export function JobProfitPanel({ jobId, billedPaise }: { jobId: string; billedPaise: number }) {
  const [costs, setCosts] = useState<JobCosts | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/civil/jobs/${jobId}/costs`);
    if (!res.ok) return;
    const j = (await res.json()) as { data: JobCosts };
    setCosts(j.data);
  }, [jobId]);

  // Reload when the billed amount changes (the job was edited).
  useEffect(() => { void load(); }, [load, billedPaise]);

  if (!costs) return <div className="skeleton h-28 w-full rounded-2xl" />;

  const nothingEntered = costs.costPaise === 0 && costs.extras.length === 0 && costs.linesWithoutCost === costs.lines.length;

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Profit</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Only you can see this — never on downloads or bills
          </span>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className={`${nothingEntered ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm`}>
          {nothingEntered ? 'Enter real costs' : 'Edit real costs'}
        </button>
      </div>

      {nothingEntered ? (
        <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Billed <b style={{ color: 'var(--text-heading)' }}>{formatRupees(costs.billedPaise)}</b>. Enter what each line really
          cost (and any costs you don&apos;t bill, like transport) to see this job&apos;s profit.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: 'var(--border-subtle)' }}>
          <Figure label="Billed" value={formatRupees(costs.billedPaise)} />
          <Figure label="Real cost" value={formatRupees(costs.costPaise)} />
          <Figure label="Profit" value={formatRupees(costs.profitPaise)} color={profitColor(costs.profitPaise)}
            icon={costs.profitPaise < 0 ? TrendingDown : TrendingUp} />
          <Figure label="Margin" value={costs.marginPct === null ? '—' : `${costs.marginPct}%`} color={profitColor(costs.profitPaise)} />
        </div>
      )}

      {!nothingEntered && costs.linesWithoutCost > 0 && (
        <div className="flex items-center gap-2 px-5 py-2.5 text-xs"
          style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {costs.linesWithoutCost} line{costs.linesWithoutCost !== 1 ? 's have' : ' has'} no real cost yet, so this profit is higher than it really is.
        </div>
      )}

      <CostsDialog open={open} costs={costs} jobId={jobId}
        onClose={() => setOpen(false)} onSaved={data => { setCosts(data); setOpen(false); }} />
    </div>
  );
}

function Figure({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: React.ElementType }) {
  return (
    <div className="px-5 py-3" style={{ background: 'var(--surface-card)' }}>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums" style={{ color: color ?? 'var(--text-heading)' }}>
        {Icon && <Icon className="h-4 w-4" />}{value}
      </p>
    </div>
  );
}

/* ── Enter real costs ──────────────────────────────────────────────────────── */

function CostsDialog({ open, costs, jobId, onClose, onSaved }: {
  open: boolean; costs: JobCosts; jobId: string; onClose: () => void; onSaved: (c: JobCosts) => void;
}) {
  const [lineCost, setLineCost] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<{ description: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh copy each time the dialog opens.
  const [openedFor, setOpenedFor] = useState<JobCosts | null>(null);
  if (open && openedFor !== costs) {
    setOpenedFor(costs);
    setLineCost(Object.fromEntries(costs.lines.map(l => [l.id, l.costPaise === null ? '' : paiseToInput(l.costPaise)])));
    setExtras(costs.extras.map(e => ({ description: e.description, amount: paiseToInput(e.amountPaise) })));
    setError(null);
  }
  if (!open && openedFor) setOpenedFor(null);

  const live = useMemo(() => {
    const lines = costs.lines.map(l => ({ costPaise: (lineCost[l.id] ?? '').trim() === '' ? null : inputToPaise(lineCost[l.id]) }));
    const extraRows = extras.filter(e => e.description.trim() || e.amount.trim()).map(e => ({ amountPaise: inputToPaise(e.amount) }));
    const c = jobCost(lines, extraRows);
    return { ...c, ...profitOf(costs.billedPaise, c.costPaise) };
  }, [costs, lineCost, extras]);

  async function save() {
    const filledExtras = extras.filter(e => e.description.trim() || e.amount.trim());
    if (filledExtras.some(e => !e.description.trim())) { setError('Give each extra cost a name, e.g. Transport.'); return; }
    const body: CivilJobCostsInput = {
      lines: costs.lines.map(l => {
        const v = (lineCost[l.id] ?? '').trim();
        return { id: l.id, costPaise: v === '' ? null : inputToPaise(v) };
      }),
      extras: filledExtras.map(e => ({ description: e.description.trim(), amountPaise: inputToPaise(e.amount) })),
    };
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/civil/jobs/${jobId}/costs`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError(await apiError(res, 'Could not save the costs.')); return; }
      onSaved(((await res.json()) as { data: JobCosts }).data);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Real costs</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Lock className="h-3 w-3" />Private — only you see these. The client&apos;s bill and downloads are not changed.
        </p>

        <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
          {/* Billed lines */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Billed line', 'Billed', 'Real cost', 'Profit'].map((h, i) => (
                    <th key={h} className={`px-3 py-2 text-xs font-semibold ${i ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costs.lines.map((l, i) => {
                  const v = (lineCost[l.id] ?? '').trim();
                  const p = v === '' ? null : l.amountPaise - inputToPaise(v);
                  return (
                    <tr key={l.id} style={{ borderBottom: i < costs.lines.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td className="px-3 py-2">
                        <span style={{ color: 'var(--text-primary)' }}>{l.description}</span>
                        <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={l.kind === 'labour'
                            ? { background: 'var(--warning-soft)', color: 'var(--warning-text)' }
                            : { background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                          {l.kind === 'labour' ? 'Labour' : 'Material'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatRupees(l.amountPaise)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          value={lineCost[l.id] ?? ''} inputMode="decimal" placeholder="not entered"
                          autoFocus={i === 0}
                          onChange={e => setLineCost(c => ({ ...c, [l.id]: e.target.value }))}
                          className="studio-input h-9 w-32 text-right text-sm tabular-nums" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums"
                        style={{ color: p === null ? 'var(--text-tertiary)' : profitColor(p) }}>
                        {p === null ? '—' : formatRupees(p)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Unbilled costs */}
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Other costs (not billed to the client)</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Money you spent on this job that isn&apos;t a line on the bill.</p>
            </div>
            <datalist id="civil-extra-costs">{EXTRA_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
            {extras.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input list="civil-extra-costs" value={e.description} placeholder="e.g. Transport"
                  onChange={ev => setExtras(x => x.map((r, j) => j === i ? { ...r, description: ev.target.value } : r))}
                  className="studio-input h-9 flex-1 text-sm" autoFocus={!e.description} />
                <input value={e.amount} inputMode="decimal" placeholder="0"
                  onChange={ev => setExtras(x => x.map((r, j) => j === i ? { ...r, amount: ev.target.value } : r))}
                  className="studio-input h-9 w-32 text-right text-sm tabular-nums" />
                <button type="button" onClick={() => setExtras(x => x.filter((_, j) => j !== i))}
                  className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]" title="Remove">
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setExtras(x => [...x, { description: '', amount: '' }])}
              className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
              <Plus className="h-4 w-4" />Add a cost
            </button>
          </div>

          {/* Live result */}
          <div className="grid grid-cols-2 gap-3 rounded-xl px-4 py-3 sm:grid-cols-4" style={{ background: 'var(--surface-muted)' }}>
            <Mini label="Billed" value={formatRupees(costs.billedPaise)} />
            <Mini label="Real cost" value={formatRupees(live.costPaise)} />
            <Mini label="Profit" value={formatRupees(live.profitPaise)} color={profitColor(live.profitPaise)} />
            <Mini label="Margin" value={live.marginPct === null ? '—' : `${live.marginPct}%`} color={profitColor(live.profitPaise)} />
          </div>
          {live.linesWithoutCost > 0 && (
            <p className="-mt-2 text-xs" style={{ color: 'var(--warning-text)' }}>
              {live.linesWithoutCost} line{live.linesWithoutCost !== 1 ? 's' : ''} still without a real cost — you can fill them in later.
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <DialogFooter>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save costs'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-base font-bold tabular-nums" style={{ color: color ?? 'var(--text-heading)' }}>{value}</p>
    </div>
  );
}
