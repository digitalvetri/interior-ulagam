'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { dmy, todayIso } from './format';

// The one-tap period chooser shared by Download and Profit:
// Today · This month · Last month · A day · A month · From–to.

export type Period = 'today' | 'this-month' | 'last-month' | 'day' | 'month' | 'range';

export interface PeriodRange { from: string; to: string; label: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First and last day of a yyyy-mm month. */
export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function usePeriod(initial: Period = 'this-month') {
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const lastMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); })();

  const [period, setPeriod] = useState<Period>(initial);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(thisMonth);
  const [rangeFrom, setRangeFrom] = useState(monthBounds(thisMonth).from);
  const [rangeTo, setRangeTo] = useState(today);

  const range = useMemo((): PeriodRange | null => {
    switch (period) {
      case 'today': return { from: today, to: today, label: `Today, ${dmy(today)}` };
      case 'this-month': return { ...monthBounds(thisMonth), label: monthLabel(thisMonth) };
      case 'last-month': return { ...monthBounds(lastMonth), label: monthLabel(lastMonth) };
      case 'day': return day ? { from: day, to: day, label: dmy(day) } : null;
      case 'month': return month ? { ...monthBounds(month), label: monthLabel(month) } : null;
      case 'range':
        return rangeFrom && rangeTo && rangeFrom <= rangeTo
          ? { from: rangeFrom, to: rangeTo, label: `${dmy(rangeFrom)} to ${dmy(rangeTo)}` } : null;
    }
  }, [period, day, month, rangeFrom, rangeTo, today, thisMonth, lastMonth]);

  return {
    period, setPeriod, day, setDay, month, setMonth, rangeFrom, setRangeFrom, rangeTo, setRangeTo,
    range, today, thisMonth, lastMonth,
  };
}

export type PeriodState = ReturnType<typeof usePeriod>;

/** Six big tiles; picking A day / A month / From–to reveals its date box. `columns` 6 lays them in one row. */
export function PeriodPicker({ state, columns = 3 }: { state: PeriodState; columns?: 3 | 6 }) {
  const { period, setPeriod, today, thisMonth, lastMonth } = state;
  const choices: { key: Period; label: string; sub: string }[] = [
    { key: 'today', label: 'Today', sub: dmy(today) },
    { key: 'this-month', label: 'This month', sub: monthLabel(thisMonth) },
    { key: 'last-month', label: 'Last month', sub: monthLabel(lastMonth) },
    { key: 'day', label: 'A day', sub: 'Pick a date' },
    { key: 'month', label: 'A month', sub: 'Pick a month' },
    { key: 'range', label: 'From – to', sub: 'Any dates' },
  ];

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${columns === 6 ? 'grid-cols-3 lg:grid-cols-6' : 'grid-cols-3'}`}>
        {choices.map(c => {
          const on = period === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setPeriod(c.key)}
              className="rounded-xl border px-3 py-2.5 text-left transition-colors"
              style={on
                ? { background: 'var(--accent-base)', borderColor: 'var(--accent-base)', color: '#fff' }
                : { background: 'var(--surface-card)', borderColor: 'var(--border-strong)', color: 'var(--text-heading)' }}>
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="block text-[11px]" style={{ color: on ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)' }}>
                {c.sub}
              </span>
            </button>
          );
        })}
      </div>

      {period === 'day' && (
        <label className="flex items-center gap-2 pt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <CalendarDays className="h-4 w-4" />
          <input type="date" value={state.day} max={today} onChange={e => state.setDay(e.target.value)}
            className="studio-input h-9 text-sm" autoFocus />
        </label>
      )}
      {period === 'month' && (
        <label className="flex items-center gap-2 pt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <CalendarDays className="h-4 w-4" />
          <input type="month" value={state.month} max={thisMonth} onChange={e => state.setMonth(e.target.value)}
            className="studio-input h-9 text-sm" autoFocus />
        </label>
      )}
      {period === 'range' && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <CalendarRange className="h-4 w-4" />
          <input type="date" value={state.rangeFrom} onChange={e => state.setRangeFrom(e.target.value)} className="studio-input h-9 text-sm" />
          <span>to</span>
          <input type="date" value={state.rangeTo} onChange={e => state.setRangeTo(e.target.value)} className="studio-input h-9 text-sm" />
        </div>
      )}
    </div>
  );
}
