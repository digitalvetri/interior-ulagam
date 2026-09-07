'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck, Users, UserCheck, UserX, Clock, Plane,
  ChevronLeft, ChevronRight, Check, X, Plus, Search,
  AlertCircle, Loader2, SunMedium, CalendarDays,
} from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day' | 'late' | 'holiday';
type LeaveType = 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity' | 'paternity' | 'comp_off';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string | null;
}

interface EmployeeSummary {
  id: string;
  fullName: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  photoUrl: string | null;
  attendance: AttendanceRecord | null;
}

interface DailySummary {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  late: number;
  holiday: number;
  unmarked: number;
  employees: EmployeeSummary[];
}

interface LeaveRequest {
  id: string;
  userId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: { id: string; fullName: string; role: string; jobTitle: string | null; photoUrl: string | null } | null;
  reviewer: { id: string; fullName: string } | null;
}

interface StaffOption {
  id: string;
  fullName: string;
  jobTitle: string | null;
  role: string;
}

type Tab = 'daily' | 'leaves';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<AttendanceStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  present:  { label: 'Present',   bg: '#DCFCE7', color: '#16A34A', icon: UserCheck },
  absent:   { label: 'Absent',    bg: '#FEE2E2', color: '#DC2626', icon: UserX     },
  leave:    { label: 'On Leave',  bg: '#EDE9FE', color: '#7C3AED', icon: Plane     },
  half_day: { label: 'Half Day',  bg: '#FEF9C3', color: '#CA8A04', icon: SunMedium },
  late:     { label: 'Late',      bg: '#FFEDD5', color: '#C2410C', icon: Clock     },
  holiday:  { label: 'Holiday',   bg: '#F1F5F9', color: '#475569', icon: CalendarDays },
};

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual:    'Casual',
  sick:      'Sick',
  earned:    'Earned',
  unpaid:    'Unpaid',
  maternity: 'Maternity',
  paternity: 'Paternity',
  comp_off:  'Comp Off',
};

const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: '#FEF9C3', color: '#92400E' },
  approved:  { label: 'Approved',  bg: '#DCFCE7', color: '#16A34A' },
  rejected:  { label: 'Rejected',  bg: '#FEE2E2', color: '#DC2626' },
  cancelled: { label: 'Cancelled', bg: '#F1F5F9', color: '#475569' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function daysBetween(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86400000) + 1;
}

function Avatar({ name, photo, size = 32 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} width={size} height={size} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  }
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
      style={{ width: size, height: size, background: 'var(--accent-soft)', color: 'var(--accent-base)' }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function LeaveBadge({ status }: { status: LeaveStatus }) {
  const meta = LEAVE_STATUS_META[status];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-5 py-4 flex-1 min-w-0"
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: bg }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-heading)' }}>{value}</p>
        <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Mark Attendance Dialog ───────────────────────────────────────────────────

function MarkDialog({
  employee,
  date,
  existing,
  onClose,
  onSaved,
}: {
  employee: EmployeeSummary;
  date: string;
  existing: AttendanceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus]       = useState<AttendanceStatus>(existing?.status ?? 'present');
  const [checkIn, setCheckIn]     = useState(existing?.checkInAt ? new Date(existing.checkInAt).toTimeString().slice(0, 5) : '09:00');
  const [checkOut, setCheckOut]   = useState(existing?.checkOutAt ? new Date(existing.checkOutAt).toTimeString().slice(0, 5) : '18:00');
  const [notes, setNotes]         = useState(existing?.notes ?? '');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const showTimes = status === 'present' || status === 'late' || status === 'half_day';

  async function save() {
    setSaving(true);
    setError('');
    try {
      const toISO = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        return d.toISOString();
      };

      const body = {
        userId: employee.id,
        date,
        status,
        checkInAt:  showTimes && checkIn  ? toISO(checkIn)  : null,
        checkOutAt: showTimes && checkOut ? toISO(checkOut) : null,
        notes: notes || null,
      };

      const res = await fetch('/api/v1/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to save');
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={employee.fullName} photo={employee.photoUrl} size={36} />
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>{employee.fullName}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{employee.jobTitle ?? employee.role} · {formatDate(date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status picker */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Status</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS_META) as AttendanceStatus[]).map(s => {
                const m = STATUS_META[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="rounded-xl px-3 py-2 text-[12px] font-semibold transition-all"
                    style={{
                      background: active ? m.bg : 'var(--surface-muted)',
                      color:      active ? m.color : 'var(--text-secondary)',
                      border:     active ? `2px solid ${m.color}` : '2px solid transparent',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Check-in / out */}
          {showTimes && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Check In</label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={e => setCheckIn(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-[13px]"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Check Out</label>
                <input
                  type="time"
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-[13px]"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any remarks..."
              className="w-full resize-none rounded-xl px-3 py-2 text-[13px]"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-70"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent-base)', color: '#fff' }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? 'Update' : 'Mark'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Leave Request Dialog ─────────────────────────────────────────────────

function AddLeaveDialog({
  staff,
  onClose,
  onSaved,
}: {
  staff: StaffOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId,    setUserId]    = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [fromDate,  setFromDate]  = useState(todayISO());
  const [toDate,    setToDate]    = useState(todayISO());
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  async function save() {
    if (!userId) { setError('Select an employee'); return; }
    if (reason.trim().length < 5) { setError('Reason must be at least 5 characters'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/attendance/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, leaveType, fromDate, toDate, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to submit');
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-heading)' }}>Add Leave Request</p>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Employee</label>
            <select value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-[13px]"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <option value="">Select employee</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.fullName}{s.jobTitle ? ` — ${s.jobTitle}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Leave Type</label>
            <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)}
              className="w-full rounded-xl px-3 py-2 text-[13px]"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map(lt => (
                <option key={lt} value={lt}>{LEAVE_TYPE_LABEL[lt]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>To</label>
              <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Reason for leave..."
              className="w-full resize-none rounded-xl px-3 py-2 text-[13px]"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-70"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent-base)', color: '#fff' }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Daily Attendance Tab ─────────────────────────────────────────────────────

function DailyTab() {
  const [date, setDate]         = useState(todayISO());
  const [summary, setSummary]   = useState<DailySummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [markTarget, setMarkTarget] = useState<EmployeeSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/attendance/summary?date=${date}`);
      if (res.ok) setSummary((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, [date]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  const filtered = (summary?.employees ?? []).filter(e =>
    !search || e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (e.jobTitle ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<EmployeeSummary>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} photo={row.photoUrl} size={32} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-heading)' }}>{row.fullName}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{row.jobTitle ?? row.role}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => row.attendance
        ? <StatusBadge status={row.attendance.status} />
        : <span className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Not marked</span>,
    },
    {
      key: 'checkIn',
      header: 'Check In',
      render: (row) => (
        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {formatTime(row.attendance?.checkInAt ?? null)}
        </span>
      ),
    },
    {
      key: 'checkOut',
      header: 'Check Out',
      render: (row) => (
        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {formatTime(row.attendance?.checkOutAt ?? null)}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {row.attendance?.notes ?? '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          onClick={() => setMarkTarget(row)}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium hover:opacity-80"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
          {row.attendance ? 'Edit' : 'Mark'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => shiftDate(-1)}
          className="rounded-xl p-2 hover:opacity-70"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-xl px-3 py-2 text-[13px] font-medium"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
        />
        <button onClick={() => shiftDate(1)}
          disabled={date >= todayISO()}
          className="rounded-xl p-2 hover:opacity-70 disabled:opacity-30"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
          <ChevronRight className="h-4 w-4" />
        </button>
        {date !== todayISO() && (
          <button onClick={() => setDate(todayISO())}
            className="rounded-xl px-3 py-2 text-[12px] font-medium hover:opacity-70"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
            Today
          </button>
        )}
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          <KpiCard label="Total Staff"  value={summary.totalEmployees} icon={Users}     color="#475569" bg="#F1F5F9" />
          <KpiCard label="Present"      value={summary.present}        icon={UserCheck} color="#16A34A" bg="#DCFCE7" />
          <KpiCard label="Absent"       value={summary.absent}         icon={UserX}     color="#DC2626" bg="#FEE2E2" />
          <KpiCard label="On Leave"     value={summary.leave}          icon={Plane}     color="#7C3AED" bg="#EDE9FE" />
          <KpiCard label="Late"         value={summary.late}           icon={Clock}     color="#C2410C" bg="#FFEDD5" />
          <KpiCard label="Not Marked"   value={summary.unmarked}       icon={AlertCircle} color="#92400E" bg="#FEF9C3" />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <input
          placeholder="Search employee..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl pl-9 pr-4 py-2.5 text-[13px]"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={r => r.id}
        loading={loading}
        emptyState={
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 gap-3"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
            <CalendarCheck className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>No employees found</p>
          </div>
        }
      />

      {markTarget && (
        <MarkDialog
          employee={markTarget}
          date={date}
          existing={markTarget.attendance}
          onClose={() => setMarkTarget(null)}
          onSaved={() => { setMarkTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Leave Requests Tab ───────────────────────────────────────────────────────

function LeavesTab({ staff }: { staff: StaffOption[] }) {
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ req: LeaveRequest; action: 'approved' | 'rejected' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/attendance/leave-requests?status=${filter}`);
      if (res.ok) setRequests((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function review(id: string, action: 'approved' | 'rejected', note: string) {
    setActioning(id);
    try {
      await fetch(`/api/v1/attendance/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: note || null }),
      });
      setReviewDialog(null);
      setReviewNote('');
      load();
    } finally {
      setActioning(null);
    }
  }

  const FILTER_TABS: { key: typeof filter; label: string }[] = [
    { key: 'all',      label: 'All'      },
    { key: 'pending',  label: 'Pending'  },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.user?.fullName ?? '?'} photo={row.user?.photoUrl} size={32} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-heading)' }}>{row.user?.fullName ?? '—'}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{row.user?.jobTitle ?? row.user?.role ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {LEAVE_TYPE_LABEL[row.leaveType]}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row) => (
        <div>
          <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
            {formatDate(row.fromDate)}
            {row.fromDate !== row.toDate && <> — {formatDate(row.toDate)}</>}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {daysBetween(row.fromDate, row.toDate)} day{daysBetween(row.fromDate, row.toDate) !== 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="text-[12px] line-clamp-2" style={{ color: 'var(--text-secondary)', maxWidth: 240 }}>
          {row.reason}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <LeaveBadge status={row.status} />,
    },
    {
      key: 'reviewer',
      header: 'Reviewed by',
      render: (row) => (
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {row.reviewer ? row.reviewer.fullName : '—'}
          {row.reviewedAt && <><br /><span className="text-[10px]">{formatDate(row.reviewedAt)}</span></>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => {
        if (row.status !== 'pending') return null;
        const busy = actioning === row.id;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setReviewDialog({ req: row, action: 'approved' }); setReviewNote(''); }}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold hover:opacity-80 disabled:opacity-40"
              style={{ background: '#DCFCE7', color: '#16A34A' }}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </button>
            <button
              onClick={() => { setReviewDialog({ req: row, action: 'rejected' }); setReviewNote(''); }}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold hover:opacity-80 disabled:opacity-40"
              style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <X className="h-3 w-3" />
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filter tabs + add button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)' }}>
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{
                background: filter === t.key ? 'var(--surface-card)' : 'transparent',
                color:      filter === t.key ? 'var(--text-heading)'  : 'var(--text-secondary)',
                boxShadow:  filter === t.key ? 'var(--shadow-sm)'     : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--accent-base)', color: '#fff' }}>
          <Plus className="h-4 w-4" />
          Add Leave
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={requests}
        getRowKey={r => r.id}
        loading={loading}
        emptyState={
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 gap-3"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
            <Plane className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>No leave requests</p>
          </div>
        }
      />

      {showAdd && (
        <AddLeaveDialog
          staff={staff}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {/* Approve/Reject confirmation with note */}
      {reviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setReviewDialog(null); }}>
          <div className="w-full max-w-sm rounded-2xl shadow-xl"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                {reviewDialog.action === 'approved' ? 'Approve' : 'Reject'} Leave Request
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {reviewDialog.req.user?.fullName} · {LEAVE_TYPE_LABEL[reviewDialog.req.leaveType]} · {daysBetween(reviewDialog.req.fromDate, reviewDialog.req.toDate)} day(s)
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Note to employee (optional)
              </label>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3}
                placeholder="Add a note..."
                className="w-full resize-none rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setReviewDialog(null)}
                className="rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-70"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={() => review(reviewDialog.req.id, reviewDialog.action, reviewNote)}
                disabled={actioning === reviewDialog.req.id}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
                style={{
                  background: reviewDialog.action === 'approved' ? '#16A34A' : '#DC2626',
                  color: '#fff',
                }}>
                {actioning === reviewDialog.req.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {reviewDialog.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [tab, setTab]     = useState<Tab>('daily');
  const [staff, setStaff] = useState<StaffOption[]>([]);

  useEffect(() => {
    fetch('/api/v1/attendance/summary?date=' + todayISO())
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data?.employees) {
          setStaff(d.data.employees.map((e: EmployeeSummary) => ({
            id: e.id, fullName: e.fullName, jobTitle: e.jobTitle, role: e.role,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'daily',  label: 'Daily Attendance', icon: CalendarCheck },
    { key: 'leaves', label: 'Leave Requests',   icon: Plane         },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-heading)' }}>Attendance</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          Track check-ins, check-outs and manage leave requests for your team
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all -mb-px"
              style={{
                borderColor: active ? 'var(--accent-base)' : 'transparent',
                color:       active ? 'var(--accent-base)' : 'var(--text-secondary)',
              }}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'daily'  && <DailyTab />}
      {tab === 'leaves' && <LeavesTab staff={staff} />}
    </div>
  );
}
