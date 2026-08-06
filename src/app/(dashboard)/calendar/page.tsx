'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Loader2, CalendarDays, MapPin, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays, addMonths, endOfMonth, endOfWeek, formatHour, formatMonthYear, formatWeekRange,
  hoursInDay, isToday, monthGridDays, startOfMonth, startOfWeek, weekDays,
} from '@/lib/calendar/date-utils';

type ViewMode = 'month' | 'week';

interface CalendarEvent {
  id: string;
  source: 'site_visit' | 'lead_activity' | 'lead_followup';
  title: string;
  subtitle: string | null;
  start: string;
  end: string | null;
  href: string;
  color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'slate';
}

const COLOR_CLASSES: Record<CalendarEvent['color'], { chip: string; dot: string }> = {
  blue:   { chip: 'bg-blue-100 text-blue-800 hover:bg-blue-200',           dot: 'bg-blue-500'    },
  green:  { chip: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',  dot: 'bg-emerald-500' },
  amber:  { chip: 'bg-amber-100 text-amber-800 hover:bg-amber-200',        dot: 'bg-amber-500'   },
  violet: { chip: 'bg-violet-100 text-violet-800 hover:bg-violet-200',     dot: 'bg-violet-500'  },
  rose:   { chip: 'bg-rose-100 text-rose-800 hover:bg-rose-200',           dot: 'bg-rose-500'    },
  slate:  { chip: 'bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',        dot: 'bg-slate-400'   },
};

const SOURCE_ICON: Record<CalendarEvent['source'], typeof CalendarDays> = {
  site_visit:    MapPin,
  lead_activity: Phone,
  lead_followup: CalendarDays,
};

export default function CalendarPage() {
  const [view,   setView]   = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // Increment to force a refetch without changing the date range (e.g. on tab focus).
  const [fetchTick, setFetchTick] = useState(0);

  const range = useMemo(() => {
    if (view === 'month') {
      return { from: startOfWeek(startOfMonth(anchor)), to: endOfWeek(endOfMonth(anchor)) };
    }
    return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
  }, [view, anchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/calendar/events?from=${range.from.toISOString()}&to=${range.to.toISOString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        setEvents(res.data ?? []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, fetchTick]);

  // Refetch when the user returns to this tab so follow-up changes from other pages are visible.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') setFetchTick(t => t + 1);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  function shift(delta: number) {
    if (view === 'month') setAnchor((d) => addMonths(d, delta));
    else                  setAnchor((d) => addDays(d, delta * 7));
  }

  const title = view === 'month' ? formatMonthYear(anchor) : formatWeekRange(anchor);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 sm:px-6 py-3 ">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <div className="flex items-center">
            <button
              onClick={() => shift(-1)}
              aria-label="Previous"
              className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-heading)] "
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => shift(1)}
              aria-label="Next"
              className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-heading)] "
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <h1 className="text-lg font-semibold text-[var(--text-heading)] ">{title}</h1>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-0.5 text-xs ">
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                'rounded px-3 py-1 font-medium capitalize transition-colors ' +
                (view === v
                  ? 'bg-[var(--surface-card)] text-white '
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] ')
              }
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'month'
          ? <MonthView anchor={anchor} eventsByDay={eventsByDay} />
          : <WeekView  anchor={anchor} eventsByDay={eventsByDay} />}
      </div>

      <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 sm:px-6 py-2 text-xs text-[var(--text-secondary)] ">
        <Legend color="blue"   label="Site visit"      />
        <Legend color="green"  label="Call / WhatsApp" />
        <Legend color="violet" label="Meeting"         />
        <Legend color="amber"  label="Follow-up"         />
        <Legend color="rose"   label="Overdue follow-up" />
        <Legend color="slate"  label="Completed / note"  />
        <span className="ml-auto">
          {events.length} event{events.length === 1 ? '' : 's'} in view
        </span>
      </footer>
    </div>
  );
}

// ─── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  anchor, eventsByDay,
}: { anchor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const days = monthGridDays(anchor);
  const inMonth = (d: Date) => d.getMonth() === anchor.getMonth();

  return (
    <div className="flex h-full min-h-[420px] sm:min-h-[600px] flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)] ">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="border-r border-[var(--border-subtle)] px-1 sm:px-2 py-2 text-center sm:text-left last:border-r-0 ">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const today = isToday(day);
          const dim = !inMonth(day);
          const isLastCol = (i + 1) % 7 === 0;
          const isLastRow = i >= 35;

          return (
            <div
              key={i}
              className={
                'group relative min-h-[64px] sm:min-h-[110px] overflow-hidden p-1 sm:p-1.5 text-[11px] sm:text-xs transition-colors hover:bg-[var(--surface-muted)] ' +
                (isLastCol ? '' : 'border-r border-[var(--border-subtle)] ') +
                (isLastRow ? '' : 'border-b border-[var(--border-subtle)] ') +
                (dim ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface-card)] ')
              }
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={
                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ' +
                    (today
                      ? 'bg-blue-600 text-white'
                      : dim
                        ? 'text-[var(--text-tertiary)]'
                        : 'text-[var(--text-primary)] ')
                  }
                >
                  {day.getDate()}
                </span>
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <MonthEventChip key={ev.id} ev={ev} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-[10px] font-medium text-[var(--text-secondary)]">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthEventChip({ ev }: { ev: CalendarEvent }) {
  const c = COLOR_CLASSES[ev.color];
  const time = new Date(ev.start).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return (
    <Link
      href={ev.href}
      title={`${time} · ${ev.title}${ev.subtitle ? ' · ' + ev.subtitle : ''}`}
      className={
        'block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ' + c.chip
      }
    >
      <span className="mr-1 tabular-nums opacity-80">{time}</span>
      {ev.title}
    </Link>
  );
}

// ─── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  anchor, eventsByDay,
}: { anchor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const days  = weekDays(anchor);
  const hours = hoursInDay();
  const HOUR_H = 48;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 8 * HOUR_H, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="flex h-full min-h-[420px] sm:min-h-[600px] flex-col">
      <div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-[var(--border-subtle)] bg-[var(--surface-card)] ">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className="border-l border-[var(--border-subtle)] px-2 py-3 text-center "
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                {d.toLocaleDateString('en-IN', { weekday: 'short' })}
              </div>
              <div
                className={
                  'mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ' +
                  (today ? 'bg-blue-600 text-white' : 'text-[var(--text-heading)] ')
                }
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="col-span-1">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_H }}
                className="relative border-b border-[var(--border-subtle)] pr-2 text-right text-[11px] text-[var(--text-tertiary)] "
              >
                <span className="absolute -top-2 right-2 bg-[var(--surface-card)] px-0.5 ">
                  {formatHour(h)}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-[var(--border-subtle)] "
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_H }}
                    className="border-b border-[var(--border-subtle)] "
                  />
                ))}
                {dayEvents.map((ev) => (
                  <WeekEventBlock key={ev.id} ev={ev} hourHeight={HOUR_H} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekEventBlock({ ev, hourHeight }: { ev: CalendarEvent; hourHeight: number }) {
  const c = COLOR_CLASSES[ev.color];
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60 * 1000);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const durMin = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  const top = (startMin / 60) * hourHeight;
  const height = (durMin / 60) * hourHeight - 2;
  const timeText = start.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const Icon = SOURCE_ICON[ev.source] ?? CalendarDays;

  return (
    <Link
      href={ev.href}
      style={{ top, height, left: 4, right: 4 }}
      className={
        'absolute overflow-hidden rounded-md border border-black/5 px-2 py-1 text-[11px] shadow-sm transition-colors ' + c.chip
      }
      title={`${timeText} · ${ev.title}`}
    >
      <div className="flex items-center gap-1 font-semibold">
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{ev.title}</span>
      </div>
      <div className="opacity-80 tabular-nums">{timeText}</div>
      {ev.subtitle && (
        <div className="mt-0.5 truncate text-[10px] opacity-70">{ev.subtitle}</div>
      )}
    </Link>
  );
}

function Legend({ color, label }: { color: CalendarEvent['color']; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={'h-2 w-2 rounded-full ' + COLOR_CLASSES[color].dot} />
      {label}
    </span>
  );
}
