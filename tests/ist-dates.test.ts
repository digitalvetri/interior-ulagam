import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  istDateOf, istToday, addDaysToDateStr, istStartOfDay, istYearMonth, istMonthRange,
} from '@/lib/dates/ist';

afterEach(() => { vi.useRealTimers(); });

describe('istDateOf / istToday', () => {
  it('00:00 IST is already the next calendar day (18:30Z previous day)', () => {
    expect(istDateOf(new Date('2026-10-03T18:30:00Z'))).toBe('2026-10-04');
  });

  it('just before 00:00 IST is still the previous day', () => {
    expect(istDateOf(new Date('2026-10-03T18:29:59Z'))).toBe('2026-10-03');
  });

  it('05:29 IST (still the previous UTC date) maps to the IST date', () => {
    expect(istDateOf(new Date('2026-10-03T23:59:00Z'))).toBe('2026-10-04');
  });

  it('istToday uses IST, not UTC, in the 00:00-05:30 window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z')); // 01:30 IST on 1 Jan
    expect(istToday()).toBe('2027-01-01');
  });
});

describe('addDaysToDateStr', () => {
  it('rolls over months and years without zone shift', () => {
    expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateStr('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('istStartOfDay', () => {
  it('returns 18:30Z of the previous UTC day', () => {
    expect(istStartOfDay('2026-10-04').toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });
});

describe('istYearMonth / istMonthRange', () => {
  it('01:00 IST on the 1st belongs to the new month', () => {
    expect(istYearMonth(new Date('2026-09-30T19:30:00Z'))).toEqual({ year: 2026, month: 10 });
  });

  it('builds [start, end) as UTC instants of IST month boundaries', () => {
    const { start, end } = istMonthRange(2026, 10);
    expect(start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  it('handles month underflow (0 = previous December)', () => {
    expect(istMonthRange(2027, 0).start.toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });
});
