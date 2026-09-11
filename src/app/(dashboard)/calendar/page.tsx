'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Loader2, CalendarDays, MapPin, Phone, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays, addMonths, endOfMonth, endOfWeek, formatHour, formatMonthYear, formatWeekRange,
  hoursInDay, isToday, monthGridDays, startOfMonth, startOfWeek, weekDays,
} from '@/lib/calendar/date-utils';

type ViewMode = 'month' | 'week' | 'day';

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

interface LeadOption {
  id: string;
  contactName: string;
  stage: string;
}

// Chip colours for the day panel + week view
const COLOR_CLASSES: Record<CalendarEvent['color'], { chip: string; dot: string }> = {
  blue:   { chip: 'bg-blue-100 text-blue-800 hover:bg-blue-200',            dot: 'bg-blue-500'    },
  green:  { chip: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',   dot: 'bg-emerald-500' },
  amber:  { chip: 'bg-amber-100 text-amber-800 hover:bg-amber-200',         dot: 'bg-amber-500'   },
  violet: { chip: 'bg-violet-100 text-violet-800 hover:bg-violet-200',      dot: 'bg-violet-500'  },
  rose:   { chip: 'bg-rose-100 text-rose-800 hover:bg-rose-200',            dot: 'bg-rose-500'    },
  slate:  { chip: 'bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]', dot: 'bg-slate-400' },
};

// Month-cell bar colours (flat, no rounding pill)
const BAR_CLASSES: Record<CalendarEvent['color'], string> = {
  blue:   'bg-blue-50   text-blue-700   hover:bg-blue-100',
  green:  'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  amber:  'bg-amber-50  text-amber-700  hover:bg-amber-100',
  violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  rose:   'bg-rose-50   text-rose-700   hover:bg-rose-100',
  slate:  'bg-slate-50  text-slate-600  hover:bg-slate-100',
};

const SOURCE_ICON: Record<CalendarEvent['source'], typeof CalendarDays> = {
  site_visit:    MapPin,
  lead_activity: Phone,
  lead_followup: CalendarDays,
};

export default function CalendarPage() {
  const [view,      setView]      = useState<ViewMode>('month');
  const [anchor,    setAnchor]    = useState<Date>(new Date());
  const [events,    setEvents]    = useState<CalendarEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  // Selected day
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // New follow-up form
  const [showNewFU,    setShowNewFU]    = useState(false);
  const [leadOptions,  setLeadOptions]  = useState<LeadOption[]>([]);
  const [fuLeadId,     setFULeadId]     = useState('');
  const [fuDate,       setFUDate]       = useState('');
  const [fuTime,       setFUTime]       = useState('10:00');
  const [fuNote,       setFUNote]       = useState('');
  const [fuSaving,     setFUSaving]     = useState(false);
  const [fuError,      setFUError]      = useState<string | null>(null);

  // ── data fetching ────────────────────────────────────────────
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
      .then(r => r.json())
      .then(res => { if (!cancelled) { setEvents(res.data ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, fetchTick]);

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

  // ── navigation ───────────────────────────────────────────────
  function shift(delta: number) {
    if (view === 'month') setAnchor(d => addMonths(d, delta));
    else                  setAnchor(d => addDays(d, delta * 7));
  }

  const title = view === 'month' ? formatMonthYear(anchor) : formatWeekRange(anchor);

  // ── selected day ─────────────────────────────────────────────
  const selectedKey    = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const selectedLabel  = selectedDay.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const selectedShortLabel = selectedDay.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // ── new follow-up ────────────────────────────────────────────
  function openNewFU() {
    const isoDate = [
      selectedDay.getFullYear(),
      String(selectedDay.getMonth() + 1).padStart(2, '0'),
      String(selectedDay.getDate()).padStart(2, '0'),
    ].join('-');
    setFUDate(isoDate);
    setFUTime('10:00');
    setFULeadId(''); setFUNote(''); setFUError(null);
    setShowNewFU(true);
    if (leadOptions.length === 0) {
      fetch('/api/v1/leads?limit=100')
        .then(r => r.json())
        .then((res: { data?: LeadOption[] }) => setLeadOptions(res.data ?? []))
        .catch(() => {});
    }
  }

  async function submitNewFU() {
    if (!fuLeadId || !fuDate) return;
    setFUSaving(true); setFUError(null);
    try {
      const [h, m] = fuTime.split(':');
      const dt = new Date(`${fuDate}T${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:00`);
      const res = await fetch(`/api/v1/leads/${fuLeadId}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpDate: dt.toISOString(),
          stage: 'contacted',
          clientStatus: 'callback',
          comments: fuNote.trim() || null,
          addToCalendar: true,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? 'Failed');
      }
      setShowNewFU(false);
      setFetchTick(t => t + 1);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule');
    } finally {
      setFUSaving(false);
    }
  }

  // ── render ───────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--surface-muted)' }}>
      <div className="px-4 sm:px-6 py-6 space-y-4">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Follow-ups and scheduled site visits across all leads and projects.
          </p>
        </div>

        {/* ── Calendar card ─────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>

            {/* View toggle — left */}
            <div className="flex items-center overflow-hidden rounded-lg text-xs" style={{ border: '1px solid var(--border-subtle)' }}>
              {(['Month', 'Week', 'Day'] as const).map((v, i) => {
                const active = view === v.toLowerCase();
                return (
                  <button
                    key={v}
                    onClick={() => setView(v.toLowerCase() as ViewMode)}
                    className={'px-3 py-1.5 font-medium transition-colors ' + (i > 0 ? 'border-l ' : '')}
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: active ? 'var(--surface-muted)' : 'transparent',
                      color: active ? 'var(--text-heading)' : 'var(--text-secondary)',
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>

            {/* Navigation — center */}
            <div className="flex flex-1 items-center justify-center gap-1">
              <button onClick={() => shift(-1)}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]">
                <ChevronLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="min-w-[170px] text-center text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                {title}
                {loading && <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin opacity-40" />}
              </span>
              <button onClick={() => shift(1)}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]">
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                onClick={() => { setAnchor(new Date()); setSelectedDay(new Date()); }}>
                Today
              </Button>
              <button onClick={openNewFU}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: 'var(--accent-base)', color: '#fff' }}>
                <Plus className="h-4 w-4" />
                New follow-up
              </button>
            </div>
          </div>

          {/* Grid */}
          {view === 'month' && (
            <MonthView
              anchor={anchor}
              eventsByDay={eventsByDay}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          )}
          {view === 'week' && (
            <WeekView anchor={anchor} eventsByDay={eventsByDay} />
          )}
          {view === 'day' && (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select a date in the Month view to see its events below.
            </div>
          )}
        </div>

        {/* ── Day panel card ─────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              {isToday(selectedDay) && (
                <span className="font-semibold" style={{ color: 'var(--accent-base)' }}>Today · </span>
              )}
              {selectedLabel}
            </p>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {selectedEvents.length} item{selectedEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--surface-muted)' }}>
                <CalendarDays className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nothing scheduled for this day.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(ev => {
                const c = COLOR_CLASSES[ev.color];
                const Icon = SOURCE_ICON[ev.source] ?? CalendarDays;
                const time = new Date(ev.start).toLocaleTimeString('en-IN', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                });
                return (
                  <Link key={ev.id} href={ev.href}
                    className={'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ' + c.chip}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      {ev.subtitle && <p className="text-xs opacity-70 truncate">{ev.subtitle}</p>}
                    </div>
                    <span className="flex-shrink-0 text-xs tabular-nums opacity-70">{time}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── New follow-up form card (no overlap — stacked below) ── */}
        {showNewFU && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            {/* Form header */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                New Follow-up · {selectedShortLabel}
              </p>
              <button onClick={() => setShowNewFU(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]">
                <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lead */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
                  LEAD *
                </label>
                <select value={fuLeadId} onChange={e => setFULeadId(e.target.value)}
                  className="studio-input w-full h-10 text-sm px-3">
                  <option value="">— select a lead —</option>
                  {leadOptions.map(l => (
                    <option key={l.id} value={l.id}>{l.contactName}</option>
                  ))}
                </select>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    DATE
                  </label>
                  <input type="date" value={fuDate} onChange={e => setFUDate(e.target.value)}
                    className="studio-input w-full h-10 text-sm px-3" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    TIME
                  </label>
                  <input type="time" value={fuTime} onChange={e => setFUTime(e.target.value)}
                    className="studio-input w-full h-10 text-sm px-3" />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
                  NOTE
                </label>
                <input type="text" value={fuNote} onChange={e => setFUNote(e.target.value)}
                  placeholder="What's this follow-up about?"
                  className="studio-input w-full h-10 text-sm px-3" />
              </div>
            </div>

            {fuError && (
              <p className="mt-3 text-sm text-red-600">{fuError}</p>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowNewFU(false)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={submitNewFU} disabled={!fuLeadId || !fuDate || fuSaving}
                className="px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: 'var(--accent-base)', color: '#fff' }}>
                {fuSaving ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  anchor, eventsByDay, selectedDay, onSelectDay,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
}) {
  const days   = monthGridDays(anchor);
  const selKey = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
  const inMonth = (d: Date) => d.getMonth() === anchor.getMonth();

  return (
    <div className="flex min-h-[440px] flex-col">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b text-xs font-medium uppercase tracking-wide"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="border-r px-2 py-2.5 last:border-r-0"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
        {days.map((day, i) => {
          const key      = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayEvs   = eventsByDay.get(key) ?? [];
          const today    = isToday(day);
          const dim      = !inMonth(day);
          const selected = key === selKey;
          const isLastCol = (i + 1) % 7 === 0;
          const isLastRow = i >= 35;

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              className={
                'relative cursor-pointer min-h-[72px] sm:min-h-[90px] overflow-hidden p-1.5 text-[11px] transition-colors ' +
                (isLastCol ? '' : 'border-r ') +
                (isLastRow ? '' : 'border-b ')
              }
              style={{
                borderColor: 'var(--border-subtle)',
                background: selected && !dim
                  ? 'rgba(13,127,110,0.06)'
                  : dim
                    ? 'var(--surface-muted)'
                    : 'var(--surface-card)',
              }}
            >
              {/* Date number */}
              <div className="mb-1">
                <span
                  className={
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ' +
                    (today
                      ? 'text-white '
                      : dim
                        ? ''
                        : '')
                  }
                  style={{
                    background: today ? 'var(--accent-base)' : 'transparent',
                    color: today ? '#fff' : dim ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  }}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Event bars */}
              <div className="space-y-0.5">
                {dayEvs.slice(0, 3).map(ev => (
                  <MonthEventBar key={ev.id} ev={ev} />
                ))}
                {dayEvs.length > 3 && (
                  <span className="block px-1 text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    +{dayEvs.length - 3} more
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

function MonthEventBar({ ev }: { ev: CalendarEvent }) {
  return (
    <Link
      href={ev.href}
      onClick={e => e.stopPropagation()}
      title={ev.title}
      className={'block w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ' + BAR_CLASSES[ev.color]}
    >
      {ev.title}
    </Link>
  );
}

// ─── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  anchor, eventsByDay,
}: { anchor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const days   = weekDays(anchor);
  const hours  = hoursInDay();
  const HOUR_H = 48;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 8 * HOUR_H, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="flex min-h-[440px] flex-col">
      {/* Day header */}
      <div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
        <div />
        {days.map(d => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="border-l px-2 py-3 text-center"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                {d.toLocaleDateString('en-IN', { weekday: 'short' })}
              </div>
              <div className="mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: today ? 'var(--accent-base)' : 'transparent', color: today ? '#fff' : 'var(--text-heading)' }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          {/* Hour labels */}
          <div className="col-span-1">
            {hours.map(h => (
              <div key={h}
                className="relative border-b pr-2 text-right text-[11px]"
                style={{ height: HOUR_H, borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                <span className="absolute -top-2 right-2 px-0.5"
                  style={{ background: 'var(--surface-card)', color: 'var(--text-tertiary)' }}>
                  {formatHour(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const key     = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvs  = eventsByDay.get(key) ?? [];
            return (
              <div key={day.toISOString()} className="relative border-l"
                style={{ borderColor: 'var(--border-subtle)' }}>
                {hours.map(h => (
                  <div key={h} className="border-b"
                    style={{ height: HOUR_H, borderColor: 'var(--border-subtle)' }} />
                ))}
                {dayEvs.map(ev => (
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
  const c     = COLOR_CLASSES[ev.color];
  const start = new Date(ev.start);
  const end   = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60 * 1000);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const durMin   = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  const top    = (startMin / 60) * hourHeight;
  const height = (durMin / 60) * hourHeight - 2;
  const timeText = start.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const Icon = SOURCE_ICON[ev.source] ?? CalendarDays;

  return (
    <Link href={ev.href} style={{ top, height, left: 4, right: 4 }}
      className={'absolute overflow-hidden rounded-md border border-black/5 px-2 py-1 text-[11px] shadow-sm transition-colors ' + c.chip}
      title={`${timeText} · ${ev.title}`}>
      <div className="flex items-center gap-1 font-semibold">
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{ev.title}</span>
      </div>
      <div className="tabular-nums opacity-80">{timeText}</div>
      {ev.subtitle && <div className="mt-0.5 truncate text-[10px] opacity-70">{ev.subtitle}</div>}
    </Link>
  );
}
