'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CalendarCheck, Clock, CheckCircle2, AlertCircle, XCircle,
  Plus, ChevronLeft, ChevronRight, Loader2, MapPin, LogIn, LogOut,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLatitude: string | null;
  checkInLongitude: string | null;
  checkInAddress: string | null;
  notes: string | null;
}
interface LeaveRequest {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}
interface CheckInState {
  checkInAt: string | null;
  checkOutAt: string | null;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const LEAVE_TYPES = [
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'earned',    label: 'Earned Leave' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
  { value: 'comp_off',  label: 'Comp Off' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
];

const LEAVE_POLICY: Record<string, number> = {
  casual: 12, sick: 12, earned: 15, comp_off: 6,
};

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function statusConfig(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    present:  { label: 'Present',  color: '#16a34a', bg: '#f0fdf4' },
    absent:   { label: 'Absent',   color: '#dc2626', bg: '#fef2f2' },
    leave:    { label: 'On Leave', color: '#d97706', bg: '#fffbeb' },
    half_day: { label: 'Half Day', color: '#7c3aed', bg: '#faf5ff' },
    late:     { label: 'Late',     color: '#ea580c', bg: '#fff7ed' },
    holiday:  { label: 'Holiday',  color: '#0891b2', bg: '#f0f9ff' },
  };
  return map[status] ?? { label: status, color: '#6b7280', bg: '#f9fafb' };
}
function leaveStatusConfig(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Pending',   color: '#d97706' },
    approved:  { label: 'Approved',  color: '#16a34a' },
    rejected:  { label: 'Rejected',  color: '#dc2626' },
    cancelled: { label: 'Cancelled', color: '#6b7280' },
  };
  return map[status] ?? { label: status, color: '#6b7280' };
}
function daysCount(from: string, to: string): number {
  return Math.ceil((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000) + 1;
}

/* ── Today check-in strip — compact single row ──────────────────────────── */
function TodayCard() {
  const [state, setState] = useState<CheckInState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/me/check-in')
      .then(r => r.json())
      .then(j => setState(j.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function checkIn() {
    setBusy(true); setError(null);
    let lat: number | null = null, lng: number | null = null;
    if (navigator.geolocation) {
      await new Promise<void>(res => {
        navigator.geolocation.getCurrentPosition(
          p => { lat = p.coords.latitude; lng = p.coords.longitude; res(); },
          () => res(), { timeout: 5000 },
        );
      });
    }
    try {
      const r = await fetch('/api/v1/me/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Check-in failed'); return; }
      setState(j.data);
    } catch { setError('Network error.'); }
    finally { setBusy(false); }
  }

  async function checkOut() {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/v1/me/check-out', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Check-out failed'); return; }
      setState(prev => prev ? { ...prev, checkOutAt: j.data?.checkOutAt ?? new Date().toISOString() } : prev);
    } catch { setError('Network error.'); }
    finally { setBusy(false); }
  }

  const hasIn  = !!state?.checkInAt;
  const hasOut = !!state?.checkOutAt;
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="premium-card px-5 py-3.5">
      {/* Single horizontal strip — date | time chips | status + action */}
      <div className="flex items-center gap-4 flex-wrap">

        {/* Date */}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Today</p>
          <p className="font-semibold text-[14px] whitespace-nowrap" style={{ color: 'var(--text-heading)' }}>
            {todayLabel}
          </p>
        </div>

        <div className="h-8 w-px bg-gray-100 hidden sm:block flex-shrink-0" />

        {/* Compact time chips */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-gray-400 leading-none mb-0.5">In</p>
            <p className="text-[13px] font-bold" style={{ color: 'var(--accent-green)' }}>
              {loading ? '—' : fmtTime(state?.checkInAt ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 leading-none mb-0.5">Out</p>
            <p className="text-[13px] font-bold" style={{ color: 'var(--accent-orange)' }}>
              {loading ? '—' : fmtTime(state?.checkOutAt ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 leading-none mb-0.5">Hours</p>
            <p className="text-[13px] font-bold" style={{ color: 'var(--accent-blue)' }}>
              {loading ? '—' : fmtHours(state?.checkInAt ?? null, state?.checkOutAt ?? null)}
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status badge + action button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!loading && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full hidden xs:inline-flex"
              style={hasOut
                ? { background: '#f0fdf4', color: '#16a34a' }
                : hasIn
                  ? { background: '#fffbeb', color: '#d97706' }
                  : { background: '#fef2f2', color: '#dc2626' }}>
              {hasOut ? 'Complete' : hasIn ? 'Checked In' : 'Not Checked In'}
            </span>
          )}

          {!loading && !hasIn && (
            <button onClick={checkIn} disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
              style={{ background: '#16a34a' }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
              Check In
            </button>
          )}
          {!loading && hasIn && !hasOut && (
            <button onClick={checkOut} disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
              style={{ background: '#d97706' }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
              Check Out
            </button>
          )}
          {!loading && hasOut && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: '#16a34a' }}>
              <CheckCircle2 size={14} />
              {fmtHours(state?.checkInAt ?? null, state?.checkOutAt ?? null)} logged
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
    </div>
  );
}

/* ── Compact attendance calendar ────────────────────────────────────────── */
function AttendanceCalendar({ records, year, month }: {
  records: AttendanceRecord[]; year: number; month: number;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const today       = new Date().toISOString().slice(0, 10);
  const byDate      = new Map(records.map(r => [r.date, r.status]));

  const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string }> = {
    present:  { bg: '#dcfce7', dot: '#16a34a', text: '#15803d' },
    late:     { bg: '#ffedd5', dot: '#ea580c', text: '#c2410c' },
    absent:   { bg: '#fee2e2', dot: '#dc2626', text: '#b91c1c' },
    leave:    { bg: '#fef3c7', dot: '#d97706', text: '#b45309' },
    holiday:  { bg: '#e0f2fe', dot: '#0891b2', text: '#0369a1' },
    half_day: { bg: '#ede9fe', dot: '#7c3aed', text: '#6d28d9' },
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="premium-card p-4 h-full flex flex-col">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Calendar</p>

      {/* Weekday headers — single-letter compact */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells — fixed h-8, NOT aspect-square */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-8" />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status  = byDate.get(dateStr);
          const s       = status ? STATUS_STYLE[status] : null;
          const isToday  = dateStr === today;
          const isFuture = dateStr > today;
          return (
            <div
              key={idx}
              title={status ?? ''}
              className="h-8 flex flex-col items-center justify-center rounded-md"
              style={{
                background: s ? s.bg : isToday ? 'var(--accent-base)18' : 'transparent',
                border: isToday ? '1.5px solid var(--accent-base)' : '1px solid transparent',
              }}
            >
              <span className="text-[10px] font-semibold leading-none"
                style={{
                  color: isFuture ? '#d1d5db'
                    : s ? s.text
                    : isToday ? 'var(--accent-base)'
                    : '#6b7280',
                }}>
                {day}
              </span>
              {s && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: s.dot }} />}
            </div>
          );
        })}
      </div>

      {/* Compact legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {(['present', 'absent', 'late', 'leave', 'holiday'] as const).map(key => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_STYLE[key].dot }} />
            <span className="text-[10px] text-gray-500 capitalize">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Month picker ───────────────────────────────────────────────────────── */
function MonthPicker({ month, year, onChange }: {
  month: number; year: number; onChange: (m: number, y: number) => void;
}) {
  function prev() { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); }
  function next() {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(1, year + 1); else onChange(month + 1, year);
  }
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-[14px] font-semibold w-36 text-center">{label}</span>
      <button onClick={next} disabled={isCurrentMonth}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ── Attendance tab ─────────────────────────────────────────────────────── */
function AttendanceTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const from    = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to      = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const res  = await fetch(`/api/v1/me/attendance?from=${from}&to=${to}`);
      const json = await res.json();
      setRecords(json.data ?? []);
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    present: records.filter(r => r.status === 'present').length,
    late:    records.filter(r => r.status === 'late').length,
    absent:  records.filter(r => r.status === 'absent').length,
    leave:   records.filter(r => r.status === 'leave').length,
    holiday: records.filter(r => r.status === 'holiday').length,
  };
  const totalMs = records.reduce((acc, r) =>
    r.checkInAt && r.checkOutAt
      ? acc + new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()
      : acc, 0);
  const totalH = Math.floor(totalMs / 3600000);
  const totalM = Math.floor((totalMs % 3600000) / 60000);

  const STAT_ROWS = [
    { label: 'Present',  value: stats.present, color: '#16a34a' },
    { label: 'Late',     value: stats.late,    color: '#ea580c' },
    { label: 'Absent',   value: stats.absent,  color: '#dc2626' },
    { label: 'On Leave', value: stats.leave,   color: '#d97706' },
    { label: 'Holiday',  value: stats.holiday, color: '#0891b2' },
  ];

  return (
    <div className="space-y-5">
      {/* Today check-in card */}
      <TodayCard />

      {/* Month selector + total */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
        {totalH > 0 && (
          <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Month total: <strong style={{ color: 'var(--text-heading)' }}>{totalH}h {totalM}m</strong>
          </span>
        )}
      </div>

      {/* Horizontal stats strip — 5 chips, full width */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STAT_ROWS.map(s => (
          <div key={s.label}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: s.color + '0d', border: `1px solid ${s.color}28` }}>
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 leading-none truncate">{s.label}</p>
              <p className="text-[18px] font-bold leading-tight mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2-column: calendar left, attendance history right — equal height */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: calendar — stretches to match right ── */}
        <div className="h-full">
          {loading
            ? <div className="premium-card h-full min-h-64 animate-pulse" />
            : <AttendanceCalendar records={records} year={year} month={month} />
          }
        </div>

        {/* ── Right: Attendance History — equal height via flex ── */}
        <div className="lg:col-span-2">
          <div className="premium-card p-4 flex flex-col" style={{ height: '100%' }}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Attendance History
            </p>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                <CalendarCheck size={32} className="mb-2 text-gray-200" />
                <p className="text-[13px] text-gray-400">No records for this month.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b" style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">In</th>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Out</th>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Hours</th>
                      <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {records.map(r => {
                      const s = statusConfig(r.status);
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-[13px]">
                            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ background: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-gray-600 hidden sm:table-cell">{fmtTime(r.checkInAt)}</td>
                          <td className="px-4 py-3 text-[13px] text-gray-600 hidden sm:table-cell">{fmtTime(r.checkOutAt)}</td>
                          <td className="px-4 py-3 text-[13px] text-gray-600 hidden md:table-cell">{fmtHours(r.checkInAt, r.checkOutAt)}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {r.checkInLatitude && !r.checkInAddress ? (
                              <a href={`https://www.google.com/maps?q=${r.checkInLatitude},${r.checkInLongitude}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline text-[13px]">
                                <MapPin size={12} /> View
                              </a>
                            ) : r.checkInAddress ? (
                              <span className="text-[12px] text-gray-500 truncate max-w-[160px] block">{r.checkInAddress}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Leave balance row ──────────────────────────────────────────────────── */
function LeaveBalanceRow() {
  const [approved, setApproved] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    fetch('/api/v1/me/leave-requests?status=approved')
      .then(r => r.json())
      .then(j => setApproved(j.data ?? []));
  }, []);

  const currentYear = new Date().getFullYear();
  const yearReqs = approved.filter(r => r.fromDate.startsWith(String(currentYear)));

  const usedByType: Record<string, number> = {};
  yearReqs.forEach(r => {
    usedByType[r.leaveType] = (usedByType[r.leaveType] ?? 0) + daysCount(r.fromDate, r.toDate);
  });

  const SHOW: Array<keyof typeof LEAVE_POLICY> = ['casual', 'sick', 'earned', 'comp_off'];

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Leave Balance · {currentYear}
        </p>
        <span className="text-[11px] text-gray-400">Annual entitlement</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SHOW.map(type => {
          const allotted  = LEAVE_POLICY[type];
          const used      = usedByType[type] ?? 0;
          const remaining = Math.max(0, allotted - used);
          const pct       = Math.min(100, (used / allotted) * 100);
          const isLow     = remaining <= 2;
          const label     = LEAVE_TYPES.find(x => x.value === type)?.label ?? type;
          return (
            <div key={type} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[11px] font-semibold text-gray-400">{label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: isLow ? '#dc2626' : 'var(--text-heading)' }}>
                  {remaining}
                </span>
                <span className="text-[12px] text-gray-400">/ {allotted} days</span>
              </div>
              <p className="text-[11px] text-gray-400">{used} used this year</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: isLow ? '#dc2626' : '#16a34a' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Leave request form panel — full-width below controls row ───────────── */
function LeaveFormPanel({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [leaveType, setLeaveType] = useState('casual');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [reason, setReason]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) { setError('All fields are required.'); return; }
    if (fromDate > toDate) { setError('End date must be after start date.'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, fromDate, toDate, reason: reason.trim() }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Submission failed'); return; }
      onSuccess();
    } catch { setError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: 'var(--accent-base)40', background: 'var(--accent-base)04' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-heading)' }}>New Leave Request</h3>
        <button type="button" onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Leave Type</label>
          <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }}>
            {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">To Date</label>
          <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
      </div>

      {fromDate && toDate && fromDate <= toDate && (
        <p className="text-[12px] text-gray-500">
          Duration: <strong>{daysCount(fromDate, toDate)} day{daysCount(fromDate, toDate) > 1 ? 's' : ''}</strong>
        </p>
      )}

      <div>
        <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Reason</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
          placeholder="Please describe the reason for your leave..."
          className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white resize-none"
          style={{ borderColor: 'var(--border)' }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all hover:opacity-90"
          style={{ background: 'var(--accent-base)' }}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Submit Request
        </button>
        <button type="button" onClick={onClose}
          className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          style={{ borderColor: 'var(--border)' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Leave requests tab ─────────────────────────────────────────────────── */
function LeaveTab() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [applyOpen, setApplyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/me/leave-requests?status=${filter}`);
      const json = await res.json();
      setRequests(json.data ?? []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const leaveLabel = (t: string) => LEAVE_TYPES.find(x => x.value === t)?.label ?? t;

  function statusIcon(status: string) {
    if (status === 'approved')  return <CheckCircle2 size={16} className="text-green-500" />;
    if (status === 'rejected')  return <XCircle size={16} className="text-red-500" />;
    if (status === 'cancelled') return <XCircle size={16} className="text-gray-400" />;
    return <Clock size={16} className="text-amber-500" />;
  }

  return (
    <div className="space-y-5">
      {/* Leave balance — always visible */}
      <LeaveBalanceRow />

      {/* Controls row — filter tabs left, apply button right */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-all"
              style={filter === s
                ? { background: 'white', color: 'var(--accent-base)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                : { color: '#6b7280' }}>
              {s}
            </button>
          ))}
        </div>
        {/* Trigger only — form renders below, not inside this flex row */}
        {!applyOpen && (
          <button onClick={() => setApplyOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent-base)' }}>
            <Plus size={16} /> Apply for Leave
          </button>
        )}
      </div>

      {/* Form panel — full-width, below controls, not inside the flex */}
      {applyOpen && (
        <LeaveFormPanel
          onClose={() => setApplyOpen(false)}
          onSuccess={() => { setApplyOpen(false); load(); }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <CalendarCheck size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium">No leave requests</p>
          <p className="text-[13px] text-gray-400 mt-1">Click "Apply for Leave" to submit a request.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(lr => {
            const sc = leaveStatusConfig(lr.status);
            return (
              <div key={lr.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{statusIcon(lr.status)}</div>
                    <div>
                      <p className="font-semibold text-[14px]">{leaveLabel(lr.leaveType)}</p>
                      <p className="text-[13px] text-gray-500 mt-0.5">
                        {fmtDate(lr.fromDate)}
                        {lr.fromDate !== lr.toDate && ` – ${fmtDate(lr.toDate)}`}
                        <span className="mx-1.5 text-gray-300">·</span>
                        {daysCount(lr.fromDate, lr.toDate)} day{daysCount(lr.fromDate, lr.toDate) > 1 ? 's' : ''}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-1 line-clamp-2">{lr.reason}</p>
                      {lr.reviewNote && (
                        <p className="text-[12px] mt-1.5 italic" style={{ color: sc.color }}>
                          Review note: {lr.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize"
                    style={{ background: sc.color + '18', color: sc.color }}>
                    {lr.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function AttendancePage() {
  const [tab, setTab] = useState<'attendance' | 'leave'>('attendance');
  return (
    <main className="px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Attendance & Leave
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Track your time, manage leave requests, and monitor your balance
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([
          { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { key: 'leave',      label: 'Leave',      icon: Clock },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.key
              ? { background: 'white', color: 'var(--accent-base)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
              : { color: '#6b7280' }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'attendance' ? <AttendanceTab /> : <LeaveTab />}
    </main>
  );
}
