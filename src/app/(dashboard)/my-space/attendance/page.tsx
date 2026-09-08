'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CalendarCheck, Clock, CheckCircle2, AlertCircle, XCircle,
  Plus, ChevronLeft, ChevronRight, Loader2, MapPin,
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

/* ── Helpers ───────────────────────────────────────────────────────────── */
const LEAVE_TYPES = [
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'earned',    label: 'Earned Leave' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
  { value: 'comp_off',  label: 'Comp Off' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusConfig(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    present:  { label: 'Present',   color: '#16a34a', bg: '#f0fdf4' },
    absent:   { label: 'Absent',    color: '#dc2626', bg: '#fef2f2' },
    leave:    { label: 'On Leave',  color: '#d97706', bg: '#fffbeb' },
    half_day: { label: 'Half Day',  color: '#7c3aed', bg: '#faf5ff' },
    late:     { label: 'Late',      color: '#ea580c', bg: '#fff7ed' },
    holiday:  { label: 'Holiday',   color: '#0891b2', bg: '#f0f9ff' },
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
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  return Math.ceil((t.getTime() - f.getTime()) / 86400000) + 1;
}

/* ── Month picker ───────────────────────────────────────────────────────── */
function MonthPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (m: number, y: number) => void;
}) {
  function prev() {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  }
  function next() {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
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
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/v1/me/attendance?from=${from}&to=${to}`);
      const json = await res.json();
      setRecords(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    present:  records.filter(r => r.status === 'present').length,
    late:     records.filter(r => r.status === 'late').length,
    absent:   records.filter(r => r.status === 'absent').length,
    leave:    records.filter(r => r.status === 'leave').length,
    holiday:  records.filter(r => r.status === 'holiday').length,
  };

  const totalHours = records.reduce((acc, r) => {
    if (r.checkInAt && r.checkOutAt) {
      const ms = new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime();
      return acc + ms;
    }
    return acc;
  }, 0);
  const totalH = Math.floor(totalHours / 3600000);
  const totalM = Math.floor((totalHours % 3600000) / 60000);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
        {totalH > 0 && (
          <span className="text-[13px] font-medium text-gray-500">
            Total: <strong className="text-gray-800">{totalH}h {totalM}m</strong>
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Present',  value: stats.present,  color: '#16a34a' },
          { label: 'Late',     value: stats.late,     color: '#ea580c' },
          { label: 'Absent',   value: stats.absent,   color: '#dc2626' },
          { label: 'On Leave', value: stats.leave,    color: '#d97706' },
          { label: 'Holiday',  value: stats.holiday,  color: '#0891b2' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: s.color + '0d', border: `1px solid ${s.color}28` }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center">
          <CalendarCheck size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500">No attendance records for this month.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check In</th>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check Out</th>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Hours</th>
                <th className="text-left px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {records.map(r => {
                const s = statusConfig(r.status);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{fmtTime(r.checkInAt)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{fmtTime(r.checkOutAt)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{fmtHours(r.checkInAt, r.checkOutAt)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {r.checkInLatitude && !r.checkInAddress ? (
                        <a
                          href={`https://www.google.com/maps?q=${r.checkInLatitude},${r.checkInLongitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
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
  );
}

/* ── Leave request form ─────────────────────────────────────────────────── */
function LeaveRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [leaveType, setLeaveType] = useState('casual');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [reason, setReason]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [open, setOpen]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      setError('All fields are required.');
      return;
    }
    if (fromDate > toDate) {
      setError('End date must be after start date.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/me/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, fromDate, toDate, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Submission failed');
        return;
      }
      setLeaveType('casual');
      setFromDate('');
      setToDate('');
      setReason('');
      setOpen(false);
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
        style={{ background: 'var(--accent-base)' }}
      >
        <Plus size={16} /> Apply for Leave
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: 'var(--accent-base)40', background: 'var(--accent-base)04' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[15px]">New Leave Request</h3>
        <button type="button" onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
            Leave Type
          </label>
          <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }}>
            {LEAVE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
            From Date
          </label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
            To Date
          </label>
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
        <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Please describe the reason for your leave..."
          className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white resize-none"
          style={{ borderColor: 'var(--border)' }}
        />
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
        <button type="button" onClick={() => setOpen(false)}
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/me/leave-requests?status=${filter}`);
      const json = await res.json();
      setRequests(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const leaveLabel = (t: string) => LEAVE_TYPES.find(x => x.value === t)?.label ?? t;

  function statusIcon(status: string) {
    if (status === 'approved')  return <CheckCircle2 size={16} className="text-green-500" />;
    if (status === 'rejected')  return <XCircle size={16} className="text-red-500" />;
    if (status === 'cancelled') return <XCircle size={16} className="text-gray-400" />;
    return <Clock size={16} className="text-amber-500" />;
  }

  // Summary stats
  const approved = requests.filter(r => r.status === 'approved');
  const totalApprovedDays = approved.reduce((acc, r) => acc + daysCount(r.fromDate, r.toDate), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-all"
              style={filter === s
                ? { background: 'white', color: 'var(--accent-base)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                : { color: '#6b7280' }}>
              {s}
            </button>
          ))}
        </div>
        <LeaveRequestForm onSuccess={load} />
      </div>

      {/* Summary */}
      {filter === 'all' && approved.length > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <CalendarCheck size={20} style={{ color: '#16a34a' }} />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {totalApprovedDays} leave day{totalApprovedDays !== 1 ? 's' : ''} approved this year
            </p>
            <p className="text-[12px] text-green-600">{approved.length} approved request{approved.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
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
              <div key={lr.id}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--border)' }}>
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
                        <p className="text-[12px] mt-1.5 italic"
                          style={{ color: sc.color }}>
                          Review note: {lr.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize"
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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Attendance & Leave</h1>
        <p className="text-[14px] text-gray-500 mt-1">Your attendance history and leave requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([
          { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { key: 'leave',      label: 'Leave Requests', icon: Clock },
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
