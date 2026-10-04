'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Lock, UsersRound } from 'lucide-react';
import { useUser } from '@/components/providers/user-provider';
import { formatRupees } from '@/lib/utils';
import { apiError } from '@/components/civil/format';
import { STAGE_LABEL, type StaffWeek } from '@/components/money/types';

/* ── Week helpers (local time; the week starts on Monday) ─────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (x.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  x.setDate(x.getDate() - shift);
  return isoLocal(x);
}

function addDays(iso: string, n: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + n);
}

function weekLabel(monday: string): string {
  const a = addDays(monday, 0);
  const b = addDays(monday, 6);
  const left = `${String(a.getDate()).padStart(2, '0')} ${MONTHS[a.getMonth()]}`;
  const right = `${String(b.getDate()).padStart(2, '0')} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  return `Week ${left} – ${right}`;
}

/* ── Grid state ───────────────────────────────────────────────────────────────── */

const OFFICE = 'office';
type Grid = Record<string, Record<string, string>>; // userId → columnKey → typed text

function cellKey(projectId: string | null): string { return projectId ?? OFFICE; }

function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function gridFrom(week: StaffWeek): Grid {
  const g: Grid = {};
  for (const s of week.staff) g[s.id] = {};
  for (const l of week.logs) {
    if (!g[l.userId]) g[l.userId] = {};
    g[l.userId][cellKey(l.projectId)] = l.days ? String(l.days) : '';
  }
  return g;
}

/* ── Page ─────────────────────────────────────────────────────────────────────── */

export default function StaffDaysPage() {
  const { isAdmin, roleLoaded } = useUser();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<StaffWeek | null>(null);
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const load = useCallback(async (w: string) => {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch(`/api/v1/staff-days?week=${w}`);
      if (!res.ok) { setLoadError(await apiError(res, 'Could not load the week.')); setData(null); return; }
      const json = (await res.json()) as { data: StaffWeek };
      setData(json.data);
      setGrid(gridFrom(json.data));
      setDirty(false); setSavedAt(null); setSaveError(null);
    } catch {
      setLoadError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void load(week); }, [isAdmin, week, load]);

  function goWeek(delta: number) {
    if (dirty && !window.confirm('You have unsaved days for this week. Leave without saving?')) return;
    setWeek(w => isoLocal(addDays(w, delta * 7)));
  }

  function goThisWeek() {
    const w = mondayOf(new Date());
    if (w === week) return;
    if (dirty && !window.confirm('You have unsaved days for this week. Leave without saving?')) return;
    setWeek(w);
  }

  const columns = useMemo(() => [
    ...(data?.projects ?? []).map(p => ({ key: p.id, projectId: p.id as string | null, name: p.name, sub: STAGE_LABEL[p.stage] })),
    { key: OFFICE, projectId: null as string | null, name: 'Office / none', sub: 'Not on a project' },
  ], [data]);

  const staff = useMemo(() => data?.staff ?? [], [data]);

  function setCell(userId: string, col: string, value: string) {
    if (!/^\d*([.,]\d?)?$/.test(value)) return;
    setGrid(g => ({ ...g, [userId]: { ...(g[userId] ?? {}), [col]: value } }));
    setDirty(true); setSavedAt(null);
  }

  const rowDays = (userId: string) => columns.reduce((s, c) => s + toNum(grid[userId]?.[c.key]), 0);

  const colTotals = useMemo(() => columns.map(c => {
    let days = 0, cost = 0;
    for (const s of staff) {
      const d = toNum(grid[s.id]?.[c.key]);
      days += d; cost += d * s.dayRatePaise;
    }
    return { key: c.key, days, cost: Math.round(cost) };
  }), [columns, staff, grid]);

  const over = staff.filter(s => rowDays(s.id) > 7);
  const weekCost = colTotals.reduce((s, c) => s + c.cost, 0);

  function focusCell(r: number, c: number) {
    inputs.current.get(`${r}:${c}`)?.focus();
    inputs.current.get(`${r}:${c}`)?.select();
  }

  async function save() {
    if (!data) return;
    if (over.length) { setSaveError(`${over.map(s => s.fullName).join(', ')}: more than 7 days this week.`); return; }
    const hadLogs = new Set(data.logs.map(l => l.userId));
    const rows: { userId: string; projectId: string | null; days: number }[] = [];
    for (const s of staff) {
      const mine = columns
        .map(c => ({ userId: s.id, projectId: c.projectId, days: toNum(grid[s.id]?.[c.key]) }))
        .filter(r => r.days > 0);
      if (mine.length) rows.push(...mine);
      // A zero row clears a person's previously saved week (the API replaces the week per person sent).
      else if (hadLogs.has(s.id)) rows.push({ userId: s.id, projectId: null, days: 0 });
    }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch('/api/v1/staff-days', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekStart: week, rows }),
      });
      if (!res.ok) { setSaveError(await apiError(res, 'Could not save the week.')); return; }
      await load(week);
      setSavedAt(Date.now());
    } catch {
      setSaveError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────────── */

  if (roleLoaded && !isAdmin) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border py-16 text-center"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <Lock className="h-9 w-9" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Only the owner can log staff days.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Staff Days</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Days each salaried person spent on each project — it becomes the project&apos;s staff labour cost.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && !saving && (
            <span className="text-xs font-medium" style={{ color: 'var(--warning-text)' }}>Unsaved changes</span>
          )}
          {savedAt && !dirty && (
            <span className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>Saved</span>
          )}
          <button type="button" onClick={() => void save()} disabled={saving || !dirty || !data || staff.length === 0}
            className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save week'}
          </button>
        </div>
      </div>

      {/* Week picker */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => goWeek(-1)} aria-label="Previous week"
          className="btn-secondary inline-flex h-9 w-9 items-center justify-center p-0">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-semibold"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-strong)', color: 'var(--text-heading)' }}>
          <CalendarClock className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          {weekLabel(week)}
        </div>
        <button type="button" onClick={() => goWeek(1)} aria-label="Next week"
          className="btn-secondary inline-flex h-9 w-9 items-center justify-center p-0">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={goThisWeek} disabled={week === mondayOf(new Date())}
          className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
          This week
        </button>
      </div>

      {/* Grid card */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        {loading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton h-3.5 w-40 rounded" />
                <div className="skeleton h-8 flex-1 rounded" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm" style={{ color: 'var(--danger-text)' }}>
            <AlertTriangle className="h-4 w-4" />{loadError}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UsersRound className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              Set monthly salaries in Employees to log staff days.
            </p>
            <Link href="/employees" className="btn-secondary px-4 py-2 text-sm">Go to Employees</Link>
          </div>
        ) : (
          <>
            {(data?.projects.length ?? 0) === 0 && (
              <div className="px-5 py-3 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                No active projects this week — days can still be logged as Office / none.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="sticky left-0 z-10 min-w-[180px] px-4 py-3 text-left text-xs font-semibold"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>Staff</th>
                    {columns.map(c => (
                      <th key={c.key} className="min-w-[96px] max-w-[140px] px-2 py-3 text-center text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}>
                        <span className="block truncate" title={c.name}
                          style={{ color: c.projectId ? 'var(--text-heading)' : 'var(--text-secondary)' }}>{c.name}</span>
                        <span className="block truncate text-[10.5px] font-normal" style={{ color: 'var(--text-tertiary)' }}>{c.sub}</span>
                      </th>
                    ))}
                    {['Days', 'Day rate', 'Cost this week'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap"
                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s, r) => {
                    const days = rowDays(s.id);
                    const tooMany = days > 7;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="sticky left-0 z-10 px-4 py-2.5" style={{ background: 'var(--surface-card)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{s.fullName}</p>
                          <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}</p>
                        </td>
                        {columns.map((c, ci) => (
                          <td key={c.key} className="px-2 py-2 text-center">
                            <input
                              ref={el => { if (el) inputs.current.set(`${r}:${ci}`, el); else inputs.current.delete(`${r}:${ci}`); }}
                              type="text" inputMode="decimal" aria-label={`${s.fullName} — ${c.name}`}
                              value={grid[s.id]?.[c.key] ?? ''}
                              placeholder="0"
                              onChange={e => setCell(s.id, c.key, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); focusCell(r + 1 < staff.length ? r + 1 : 0, ci); }
                              }}
                              className="studio-input h-9 w-16 text-center text-sm tabular-nums"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap"
                          style={{ color: tooMany ? 'var(--danger-text)' : 'var(--text-heading)' }}>
                          {days || '—'}
                          {tooMany && <span className="block text-[10.5px] font-medium">over 7 days</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                          {formatRupees(s.dayRatePaise)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
                          {days ? formatRupees(Math.round(days * s.dayRatePaise)) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-muted)' }}>
                    <td className="sticky left-0 z-10 px-4 py-3 text-xs font-semibold"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-heading)' }}>Total</td>
                    {colTotals.map(t => (
                      <td key={t.key} className="px-2 py-3 text-center tabular-nums">
                        <span className="block text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {t.days ? `${t.days} d` : '—'}
                        </span>
                        <span className="block text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                          {t.cost ? formatRupees(t.cost) : ''}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                      {colTotals.reduce((s, t) => s + t.days, 0) || '—'}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                      {formatRupees(weekCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{saveError}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Day rate = monthly salary ÷ {data?.workingDays ?? 26} working days. Cost goes into each project&apos;s Staff labour.
        Half days allowed (0.5). Press Enter to move down a column.
      </p>
    </div>
  );
}
