/**
 * India Standard Time (Asia/Kolkata, UTC+05:30, no DST) date helpers.
 *
 * The studio works in IST while the server and Postgres run in UTC, so any
 * "today" / "this month" computed with toISOString() or new Date(y, m, 1) on
 * the server is off by a day between 00:00 and 05:30 IST. These helpers are
 * pure (no Node / DOM APIs beyond Intl) and safe in both browser and server.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' calendar date of the given instant in IST. */
export function istDateOf(d: Date): string {
  return ymdFormatter.format(d);
}

/** 'YYYY-MM-DD' for the current date in IST. */
export function istToday(): string {
  return istDateOf(new Date());
}

/** Adds whole days to a 'YYYY-MM-DD' string (pure calendar math, no zone shift). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 IST on the given 'YYYY-MM-DD' date. */
export function istStartOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/** IST calendar year and month (1-12) of the given instant (default: now). */
export function istYearMonth(d: Date = new Date()): { year: number; month: number } {
  const [y, m] = istDateOf(d).split('-').map(Number);
  return { year: y, month: m };
}

/**
 * UTC instants bounding an IST calendar month: [start, end).
 * `month` is 1-12 and may overflow/underflow (e.g. 0 = previous December).
 */
export function istMonthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
  };
}
