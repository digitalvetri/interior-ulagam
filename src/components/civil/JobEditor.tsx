'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Lock, Plus, X } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { sumLines } from '@/lib/civil/totals';
import type { CivilJobInput, CivilLineKind } from '@/types/civil';
import type {
  CivilBranchOption, CivilJobDetail, CivilManager, CivilSuggestions,
} from './types';
import { apiError, inputToPaise, paiseToInput, todayIso } from './format';
import { Field } from './StatusActionDialog';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Props {
  job?: CivilJobDetail;
  initialBranchId?: string;
  onSaved: (job: { id: string }) => void;
  /** Shown as a Cancel button — used when editing an existing job from its sheet view. */
  onCancel?: () => void;
}

interface Row {
  key: number;
  /** Saved line id, sent back so the line keeps its private real cost. */
  id?: string;
  description: string;
  kind: CivilLineKind;
  amount: string;
}

let rowSeq = 0;
const newRow = (r?: Partial<Row>): Row => ({ key: ++rowSeq, description: '', kind: 'material', amount: '', ...r });

/* ── Editor ─────────────────────────────────────────────────────────────────── */

export function JobEditor({ job, initialBranchId, onSaved, onCancel }: Props) {
  const locked = job?.status === 'billed' || job?.status === 'paid';

  const [branches,    setBranches]    = useState<CivilBranchOption[]>([]);
  const [managers,    setManagers]    = useState<CivilManager[]>([]);
  const [suggestions, setSuggestions] = useState<CivilSuggestions>({ headings: [], descriptions: [] });

  const [branchId,  setBranchId]  = useState(job?.branchId ?? initialBranchId ?? '');
  const [jobDate,   setJobDate]   = useState(job?.jobDate?.slice(0, 10) ?? todayIso());
  const [managerId, setManagerId] = useState(job?.managerId ?? '');
  const [heading,   setHeading]   = useState(job?.heading ?? '');
  const [remark,    setRemark]    = useState(job?.remark ?? '');
  const [rows,      setRows]      = useState<Row[]>(() =>
    job?.lines.length
      ? job.lines.map(l => newRow({ id: l.id, description: l.description, kind: l.kind, amount: paiseToInput(Number(l.amountPaise)) }))
      : [newRow()],
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const descRefs = useRef(new Map<number, HTMLInputElement>());
  const focusKey = useRef<number | null>(null);

  /* ── Load options ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    void (async () => {
      const [b, m, s] = await Promise.all([
        fetch('/api/v1/civil/branches').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/civil/managers').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/civil/suggestions').then(r => r.json()).catch(() => ({ data: null })),
      ]);
      setBranches((b.data ?? []) as CivilBranchOption[]);
      setManagers((m.data ?? []) as CivilManager[]);
      if (s.data) setSuggestions(s.data as CivilSuggestions);
    })();
  }, []);

  // Focus a freshly added row once it renders.
  useEffect(() => {
    if (focusKey.current === null) return;
    descRefs.current.get(focusKey.current)?.focus();
    focusKey.current = null;
  }, [rows]);

  const branchGroups = useMemo(() => {
    const groups = new Map<string, CivilBranchOption[]>();
    for (const b of branches) {
      const label = `${b.companyName} · ${b.cityName}`;
      groups.set(label, [...(groups.get(label) ?? []), b]);
    }
    return [...groups.entries()];
  }, [branches]);

  const managerOptions = useMemo(
    () => managers.filter(m => m.active || m.id === job?.managerId),
    [managers, job?.managerId],
  );

  const totals = useMemo(
    () => sumLines(rows.map(r => ({ kind: r.kind, amountPaise: inputToPaise(r.amount) }))),
    [rows],
  );

  /* ── Row editing ──────────────────────────────────────────────────────────── */

  function update(key: number, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const r = newRow();
    focusKey.current = r.key;
    setRows(prev => [...prev, r]);
  }

  function removeRow(key: number) {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : [newRow()]));
  }

  /* ── Save ─────────────────────────────────────────────────────────────────── */

  const save = useCallback(async () => {
    if (saving) return;
    setError(null);
    if (!branchId) { setError('Pick a branch.'); return; }
    if (!heading.trim()) { setError('Enter the work heading.'); return; }

    const filled = rows.filter(r => r.description.trim() || r.amount.trim());
    if (filled.some(r => !r.description.trim())) { setError('Every line with an amount needs a description.'); return; }
    if (!filled.length) { setError('Add at least one line.'); return; }

    const body: CivilJobInput = {
      branchId,
      jobDate,
      heading: heading.trim(),
      remark: remark.trim() || null,
      managerId: managerId || null,
      lines: filled.map(r => ({ id: r.id, description: r.description.trim(), kind: r.kind, amountPaise: inputToPaise(r.amount) })),
    };

    setSaving(true);
    try {
      const res = await fetch(job ? `/api/v1/civil/jobs/${job.id}` : '/api/v1/civil/jobs', {
        method: job ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(await apiError(res, 'Could not save the job.')); return; }
      const json = (await res.json()) as { data: { id: string } };
      setSavedAt(Date.now());
      onSaved(json.data);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }, [saving, branchId, heading, rows, jobDate, remark, managerId, job, onSaved]);

  // Ctrl/Cmd+S saves, like a spreadsheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="rounded-2xl border p-5 space-y-5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Branch" required>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="studio-input h-9 w-full text-sm">
            <option value="">Select branch…</option>
            {branchGroups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Date" required>
          <input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} className="studio-input h-9 w-full text-sm" />
        </Field>
        <Field label="Manager">
          <select value={managerId} onChange={e => setManagerId(e.target.value)} className="studio-input h-9 w-full text-sm">
            <option value="">— none —</option>
            {managerOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Work heading" required>
        <HeadingInput value={heading} onChange={setHeading} options={suggestions.headings} />
      </Field>

      {/* Lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Lines</span>
          {!locked && (
            <span className="hidden text-[11px] sm:inline" style={{ color: 'var(--text-tertiary)' }}>
              Tab to move · M / L switches type · Enter on the last amount adds a line · Ctrl+S saves
            </span>
          )}
        </div>

        {locked && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            <Lock className="h-3.5 w-3.5 flex-shrink-0" />
            Billed jobs keep their amounts. Move the job back to Done to change lines.
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="w-8 px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>#</th>
                <th className="px-2 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
                <th className="w-40 px-2 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="w-36 px-2 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount ₹</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.key} style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td className="px-3 py-1.5 text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      ref={el => { if (el) descRefs.current.set(r.key, el); else descRefs.current.delete(r.key); }}
                      value={r.description} disabled={locked} list="civil-line-suggestions"
                      onChange={e => update(r.key, { description: e.target.value })}
                      placeholder="e.g. Coupling change in washing area"
                      className="studio-input h-9 w-full text-sm disabled:opacity-70"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <KindToggle value={r.kind} disabled={locked} onChange={kind => update(r.key, { kind })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.amount} disabled={locked} inputMode="decimal" placeholder="0"
                      onChange={e => update(r.key, { amount: e.target.value.replace(/[^\d.,]/g, '') })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !locked) {
                          e.preventDefault();
                          if (idx === rows.length - 1) addRow();
                          else descRefs.current.get(rows[idx + 1].key)?.focus();
                        }
                      }}
                      className="studio-input h-9 w-full text-right text-sm tabular-nums disabled:opacity-70"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {!locked && (
                      <button type="button" onClick={() => removeRow(r.key)} tabIndex={-1}
                        title="Remove line" className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]">
                        <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="civil-line-suggestions">
          {suggestions.descriptions.map(d => <option key={d.text} value={d.text} />)}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!locked ? (
            <button type="button" onClick={addRow}
              className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-base)' }}>
              <Plus className="h-4 w-4" />Add line
            </button>
          ) : <span />}
          <div className="flex items-baseline gap-5 text-sm tabular-nums">
            <span style={{ color: 'var(--text-secondary)' }}>Material {formatRupees(totals.materialPaise)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Labour {formatRupees(totals.labourPaise)}</span>
            <span className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
              Total {formatRupees(totals.totalPaise)}
            </span>
          </div>
        </div>
      </div>

      <Field label="Remark">
        <textarea value={remark} rows={2} onChange={e => setRemark(e.target.value)}
          placeholder="Anything the office should know about this job"
          className="studio-input w-full resize-none text-sm" />
      </Field>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {savedAt && !saving && !error && (
          <span className="text-xs" style={{ color: 'var(--success-text)' }}>Saved</span>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary px-5 py-2.5 text-sm">
            Cancel
          </button>
        )}
        <button type="button" onClick={() => void save()} disabled={saving}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : job ? 'Save changes' : 'Save job'}
        </button>
      </div>
    </div>
  );
}

/* ── Material / Labour toggle ───────────────────────────────────────────────── */

function KindToggle({ value, disabled, onChange }: {
  value: CivilLineKind; disabled?: boolean; onChange: (k: CivilLineKind) => void;
}) {
  const options: [CivilLineKind, string][] = [['material', 'Material'], ['labour', 'Labour']];
  return (
    <div
      role="radiogroup" tabIndex={disabled ? -1 : 0}
      onKeyDown={e => {
        if (disabled) return;
        const k = e.key.toLowerCase();
        if (k === 'm') { e.preventDefault(); onChange('material'); }
        if (k === 'l') { e.preventDefault(); onChange('labour'); }
        if (k === ' ' || k === 'arrowleft' || k === 'arrowright') {
          e.preventDefault(); onChange(value === 'material' ? 'labour' : 'material');
        }
      }}
      className="inline-flex overflow-hidden rounded-lg border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-base)]"
      style={{ borderColor: 'var(--border-strong)', opacity: disabled ? 0.7 : 1 }}
    >
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <button
            key={k} type="button" role="radio" aria-checked={on} tabIndex={-1} disabled={disabled}
            onClick={() => onChange(k)}
            className="px-2.5 py-1.5 transition-colors"
            style={{
              background: on ? 'var(--accent-base)' : 'transparent',
              color: on ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Heading input with autosuggest ─────────────────────────────────────────── */

function HeadingInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: CivilSuggestions['headings'];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    // Only after typing: an open list on an empty field covers the lines grid,
    // and a click meant for the first description would pick a heading instead.
    if (!q) return [];
    return options.filter(o => o.text.toLowerCase().includes(q) && o.text.toLowerCase() !== q).slice(0, 6);
  }, [value, options]);

  const show = open && matches.length > 0;

  function pick(text: string) {
    onChange(text);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % matches.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + matches.length) % matches.length); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active].text); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        placeholder="e.g. PLUMBING AND BLOCKAGE"
        className="studio-input h-10 w-full text-sm font-semibold tracking-wide"
        autoComplete="off"
      />
      {show && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border shadow-lg"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-strong)' }}>
          {matches.map((m, i) => (
            <button
              key={m.text} type="button"
              onMouseDown={e => { e.preventDefault(); pick(m.text); }}
              onMouseEnter={() => setActive(i)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
              style={{ background: i === active ? 'var(--accent-soft)' : 'transparent', color: 'var(--text-primary)' }}
            >
              <span className="truncate">{m.text}</span>
              <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>used {m.uses}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
