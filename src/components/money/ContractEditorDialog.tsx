'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Plus, Wand2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { apiError, inputToPaise, paiseToInput, todayIso } from '@/components/civil/format';
import { Field } from '@/components/civil/StatusActionDialog';
import { GST_RATES, PROJECT_STAGES, type ProjectContractInput } from '@/types/project-money';
import { STAGE_LABEL, type ProjectMoney } from './types';

type Stage = (typeof PROJECT_STAGES)[number];

interface AdditionRow { key: number; description: string; amount: string; addedOn: string }
interface MilestoneRow {
  key: number;
  id?: string;
  locked: boolean;
  label: string;
  pct: string;
  /** 'date' or a stage key */
  when: 'date' | Stage;
  dueOn: string;
}

let seq = 0;

function initialMilestones(money: ProjectMoney): MilestoneRow[] {
  return money.milestones.map(m => ({
    key: ++seq, id: m.id, locked: m.locked, label: m.label, pct: String(m.pctOfTotal),
    when: m.triggerStage ?? 'date', dueOn: m.dueOn ?? '',
  }));
}

/** Screen ②: contract value (ex-GST), GST, dates, additions and milestones. Owner only. */
export function ContractEditorDialog({ open, money, onClose, onSaved }: {
  open: boolean;
  money: ProjectMoney;
  onClose: () => void;
  onSaved: (m: ProjectMoney) => void;
}) {
  const [contract, setContract] = useState(paiseToInput(money.contract.contractPaise ?? 0));
  const [gstPct, setGstPct] = useState<(typeof GST_RATES)[number]>(
    (GST_RATES as readonly number[]).includes(money.project.gstPct) ? money.project.gstPct as (typeof GST_RATES)[number] : 18,
  );
  const [startedAt, setStartedAt] = useState(money.project.startedAt ?? '');
  const [expectedEndAt, setExpectedEndAt] = useState(money.project.expectedEndAt ?? '');
  const [additions, setAdditions] = useState<AdditionRow[]>(() => money.contract.additions.map(a => ({
    key: ++seq, description: a.description, amount: paiseToInput(a.amountPaise), addedOn: a.addedOn,
  })));
  const [milestones, setMilestones] = useState<MilestoneRow[]>(() => initialMilestones(money));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the saved state each time the dialog opens.
  const [openedFor, setOpenedFor] = useState<ProjectMoney | null>(null);
  if (open && openedFor !== money) {
    setOpenedFor(money);
    setContract(paiseToInput(money.contract.contractPaise ?? 0));
    setGstPct((GST_RATES as readonly number[]).includes(money.project.gstPct) ? money.project.gstPct as (typeof GST_RATES)[number] : 18);
    setStartedAt(money.project.startedAt ?? '');
    setExpectedEndAt(money.project.expectedEndAt ?? '');
    setAdditions(money.contract.additions.map(a => ({ key: ++seq, description: a.description, amount: paiseToInput(a.amountPaise), addedOn: a.addedOn })));
    setMilestones(initialMilestones(money));
    setError(null);
  }
  if (!open && openedFor) setOpenedFor(null);

  const revisedPaise = useMemo(
    () => inputToPaise(contract) + additions.reduce((s, a) => s + inputToPaise(a.amount), 0),
    [contract, additions],
  );
  const pctTotal = milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0);
  const gstPaise = Math.round((revisedPaise * gstPct) / 100);

  function applyDefaults() {
    const lockedRows = milestones.filter(m => m.locked);
    if (lockedRows.length) {
      setError('Some milestones already have payments — edit them one by one instead.');
      return;
    }
    setMilestones([
      { key: ++seq, locked: false, label: 'Booking', pct: '10', when: 'date', dueOn: startedAt || todayIso() },
      { key: ++seq, locked: false, label: 'Design sign-off', pct: '40', when: 'design_approved', dueOn: '' },
      { key: ++seq, locked: false, label: 'Material delivery', pct: '40', when: 'procurement', dueOn: '' },
      { key: ++seq, locked: false, label: 'Handover', pct: '10', when: 'handover', dueOn: '' },
    ]);
  }

  function updateMilestone(key: number, patch: Partial<MilestoneRow>) {
    setMilestones(ms => ms.map(m => (m.key === key ? { ...m, ...patch } : m)));
  }

  async function save() {
    setError(null);
    if (!contract.trim()) { setError('Enter the contract value (without GST).'); return; }
    const badAddition = additions.find(a => !a.description.trim() || !a.addedOn);
    if (badAddition) { setError('Each addition needs a description and a date.'); return; }
    const badMilestone = milestones.find(m => !m.label.trim() || (m.when === 'date' && !m.dueOn));
    if (badMilestone) { setError('Each milestone needs a name, and a date when it falls due on a date.'); return; }
    if (milestones.length && pctTotal !== 100) { setError(`Milestones must add up to 100% (now ${pctTotal}%).`); return; }

    const body: ProjectContractInput = {
      contractPaise: inputToPaise(contract),
      gstPct,
      startedAt: startedAt || null,
      expectedEndAt: expectedEndAt || null,
      additions: additions.map(a => ({ description: a.description.trim(), amountPaise: inputToPaise(a.amount), addedOn: a.addedOn })),
      milestones: milestones.map(m => ({
        ...(m.id ? { id: m.id } : {}),
        label: m.label.trim(),
        pctOfTotal: Number(m.pct) || 0,
        triggerStage: m.when === 'date' ? null : m.when,
        dueOn: m.when === 'date' ? m.dueOn : null,
      })),
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${money.project.id}/money`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError(await apiError(res, 'Could not save the contract.')); return; }
      const json = (await res.json()) as { data: ProjectMoney };
      onSaved(json.data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contract &amp; milestones · {money.project.name}</DialogTitle>
        </DialogHeader>

        <form className="space-y-6 py-1" onSubmit={e => { e.preventDefault(); void save(); }}>
          {/* Contract */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Contract value (without GST)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-tertiary)' }}>₹</span>
                  <input value={contract} onChange={e => setContract(e.target.value)} inputMode="decimal" autoFocus
                    placeholder="10,00,000" className="studio-input h-9 w-full pl-7 text-sm tabular-nums" />
                </div>
              </Field>
            </div>
            <Field label="GST">
              <select value={gstPct} onChange={e => setGstPct(Number(e.target.value) as (typeof GST_RATES)[number])}
                className="studio-input h-9 w-full text-sm">
                {[18, 12, 5, 28, 0].map(r => <option key={r} value={r}>{r === 0 ? 'No GST' : `${r}%`}</option>)}
              </select>
            </Field>
            <div className="flex flex-col justify-end text-xs pb-1" style={{ color: 'var(--text-tertiary)' }}>
              <span>Revised {formatRupees(revisedPaise)}</span>
              <span>+ GST {formatRupees(gstPaise)}</span>
            </div>
            <Field label="Start date">
              <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)} className="studio-input h-9 w-full text-sm" />
            </Field>
            <Field label="Planned handover">
              <input type="date" value={expectedEndAt} onChange={e => setExpectedEndAt(e.target.value)} className="studio-input h-9 w-full text-sm" />
            </Field>
          </div>

          {/* Additions */}
          <section className="space-y-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Additions (extra work agreed later)</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Added to the contract; milestone amounts grow with it.</p>
            </div>
            {additions.map(a => (
              <div key={a.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input value={a.description} placeholder="e.g. Extra wardrobe in guest room"
                  onChange={e => setAdditions(xs => xs.map(x => x.key === a.key ? { ...x, description: e.target.value } : x))}
                  className="studio-input h-9 min-w-0 flex-1 text-sm" />
                <input value={a.amount} inputMode="decimal" placeholder="0"
                  onChange={e => setAdditions(xs => xs.map(x => x.key === a.key ? { ...x, amount: e.target.value } : x))}
                  className="studio-input h-9 w-28 text-right text-sm tabular-nums" />
                <input type="date" value={a.addedOn}
                  onChange={e => setAdditions(xs => xs.map(x => x.key === a.key ? { ...x, addedOn: e.target.value } : x))}
                  className="studio-input h-9 w-36 text-sm" />
                <button type="button" onClick={() => setAdditions(xs => xs.filter(x => x.key !== a.key))}
                  className="rounded-lg p-2 hover:bg-[var(--surface-muted)]" title="Remove">
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            ))}
            <button type="button"
              onClick={() => setAdditions(xs => [...xs, { key: ++seq, description: '', amount: '', addedOn: todayIso() }])}
              className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
              <Plus className="h-4 w-4" />Add addition
            </button>
          </section>

          {/* Milestones */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Milestones — what the client pays when</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Each falls due on a date, or when the project reaches a stage.</p>
              </div>
              <button type="button" onClick={applyDefaults} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Wand2 className="h-3.5 w-3.5" />Use 10 / 40 / 40 / 10
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Name', '%', 'Falls due when', 'Amount', ''].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-xs font-semibold ${i === 3 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {milestones.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No milestones yet — use the 10 / 40 / 40 / 10 default or add your own.
                    </td></tr>
                  )}
                  {milestones.map(m => (
                    <tr key={m.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-1.5">
                        <input value={m.label} onChange={e => updateMilestone(m.key, { label: e.target.value })}
                          className="studio-input h-8 w-full text-sm" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input value={m.pct} inputMode="numeric" onChange={e => updateMilestone(m.key, { pct: e.target.value.replace(/[^0-9]/g, '') })}
                          className="studio-input h-8 w-16 text-right text-sm tabular-nums" />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={m.when} onChange={e => updateMilestone(m.key, { when: e.target.value as MilestoneRow['when'] })}
                            className="studio-input h-8 text-sm">
                            <option value="date">On a date</option>
                            {PROJECT_STAGES.map(s => <option key={s} value={s}>Stage reached: {STAGE_LABEL[s]}</option>)}
                          </select>
                          {m.when === 'date' && (
                            <input type="date" value={m.dueOn} onChange={e => updateMilestone(m.key, { dueOn: e.target.value })}
                              className="studio-input h-8 text-sm" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(Math.round((revisedPaise * (Number(m.pct) || 0)) / 100))}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {m.locked ? (
                          <span title="Has payments — can be renamed but not removed" className="inline-flex p-2">
                            <Lock className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </span>
                        ) : (
                          <button type="button" onClick={() => setMilestones(ms => ms.filter(x => x.key !== m.key))}
                            className="rounded-lg p-2 hover:bg-[var(--surface-muted)]" title="Remove">
                            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button"
                onClick={() => setMilestones(ms => [...ms, { key: ++seq, locked: false, label: '', pct: '0', when: 'date', dueOn: todayIso() }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
                <Plus className="h-4 w-4" />Add milestone
              </button>
              {milestones.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: pctTotal === 100 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {pctTotal === 100 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {pctTotal}% {pctTotal === 100 ? '' : '— must be 100%'}
                  <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                    {formatRupees(revisedPaise)} + GST {formatRupees(gstPaise)}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Milestones with payments are locked (<Lock className="inline h-3 w-3" />) — rename them freely, but they can&apos;t be removed.
            </p>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <DialogFooter>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save contract'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
