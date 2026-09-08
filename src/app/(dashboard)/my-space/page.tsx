'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin, Clock, CheckCircle2, LogIn, LogOut,
  ClipboardList, CalendarCheck, User, ChevronRight,
  Briefcase, AlertCircle, Loader2,
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
}
interface UserProfile {
  fullName: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  photoUrl: string | null;
}
interface Task {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  relatedType: string | null;
}
interface LeaveRequest {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: 'Owner', designer: 'Designer',
    supervisor: 'Site Supervisor', accountant: 'Accountant', employee: 'Employee',
  };
  return map[role] ?? role;
}

function statusChip(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    present:  { label: 'Present',  color: '#16a34a' },
    absent:   { label: 'Absent',   color: '#dc2626' },
    leave:    { label: 'On Leave', color: '#d97706' },
    half_day: { label: 'Half Day', color: '#7c3aed' },
    late:     { label: 'Late',     color: '#ea580c' },
    holiday:  { label: 'Holiday',  color: '#0891b2' },
  };
  const s = map[status] ?? { label: status, color: '#6b7280' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.color + '18', color: s.color }}
    >
      {s.label}
    </span>
  );
}

/* ── Check-in card ─────────────────────────────────────────────────────── */
function CheckInCard() {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'fetching' | 'ok' | 'denied'>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/me/check-in');
      const json = await res.json();
      setRecord(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  async function getLocation(): Promise<{ latitude?: number; longitude?: number; address?: string }> {
    if (!navigator.geolocation) return {};
    setGeoStatus('fetching');
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGeoStatus('ok');
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          setGeoStatus('denied');
          resolve({});
        },
        { timeout: 8000, maximumAge: 0 },
      );
    });
  }

  async function handleCheckIn() {
    setActing(true);
    setError(null);
    const loc = await getLocation();
    try {
      const res = await fetch('/api/v1/me/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Check-in failed');
        return;
      }
      await loadToday();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActing(false);
    }
  }

  async function handleCheckOut() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/me/check-out', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Check-out failed');
        return;
      }
      await loadToday();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActing(false);
    }
  }

  const isCheckedIn  = !!record?.checkInAt;
  const isCheckedOut = !!record?.checkOutAt;

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: isCheckedIn
          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: `1.5px solid ${isCheckedIn ? '#bbf7d0' : '#bfdbfe'}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: isCheckedIn ? '#15803d' : '#1d4ed8' }}>
            {isCheckedIn ? 'Currently Working' : "Today's Attendance"}
          </p>
          {loading ? (
            <div className="h-8 w-32 rounded bg-white/60 animate-pulse mt-2" />
          ) : isCheckedIn ? (
            <div>
              <p className="text-2xl font-bold" style={{ color: '#15803d' }}>
                {fmtTime(record!.checkInAt)}
                {isCheckedOut && (
                  <span className="text-base font-medium text-gray-500 ml-2">
                    → {fmtTime(record!.checkOutAt)}
                  </span>
                )}
              </p>
              {isCheckedOut && (
                <p className="text-sm font-medium mt-0.5" style={{ color: '#15803d' }}>
                  Total: {fmtHours(record!.checkInAt, record!.checkOutAt)}
                </p>
              )}
              {record?.checkInAddress && (
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin size={12} style={{ color: '#16a34a' }} />
                  <span className="text-[12px] text-gray-600 truncate max-w-[220px]">
                    {record.checkInAddress}
                  </span>
                </div>
              )}
              {record?.checkInLatitude && !record.checkInAddress && (
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin size={12} style={{ color: '#16a34a' }} />
                  <a
                    href={`https://www.google.com/maps?q=${record.checkInLatitude},${record.checkInLongitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[12px] underline" style={{ color: '#16a34a' }}
                  >
                    View location
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-2xl font-bold mt-1" style={{ color: '#1d4ed8' }}>Not checked in</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {!loading && (
            <>
              {!isCheckedIn && (
                <button
                  onClick={handleCheckIn}
                  disabled={acting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: '#2563eb' }}
                >
                  {acting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  Check In
                </button>
              )}
              {isCheckedIn && !isCheckedOut && (
                <button
                  onClick={handleCheckOut}
                  disabled={acting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: '#16a34a' }}
                >
                  {acting ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  Check Out
                </button>
              )}
              {isCheckedOut && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                  style={{ background: '#dcfce7', color: '#15803d' }}>
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">Day complete</span>
                </div>
              )}
            </>
          )}
          {geoStatus === 'denied' && (
            <p className="text-[11px] text-amber-600 text-right max-w-[140px]">
              Location unavailable — check-in recorded without GPS
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Quick stats ────────────────────────────────────────────────────────── */
function QuickStats() {
  const [stats, setStats] = useState<{
    present: number; absent: number; leave: number; pending: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const year  = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const from  = `${year}-${month}-01`;
      const to    = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      const [attRes, leaveRes, taskRes] = await Promise.all([
        fetch(`/api/v1/me/attendance?from=${from}&to=${to}`),
        fetch('/api/v1/me/leave-requests?status=pending'),
        fetch('/api/v1/me/tasks?status=pending'),
      ]);
      const [att, leave, task] = await Promise.all([attRes.json(), leaveRes.json(), taskRes.json()]);
      const rows = (att.data ?? []) as { status: string }[];
      setStats({
        present: rows.filter(r => r.status === 'present' || r.status === 'late').length,
        absent:  rows.filter(r => r.status === 'absent').length,
        leave:   rows.filter(r => r.status === 'leave').length,
        pending: (task.data ?? []).length,
      });
    }
    load();
  }, []);

  const items = [
    { label: 'Days present', value: stats?.present ?? '—', color: '#16a34a', icon: CheckCircle2 },
    { label: 'Days absent',  value: stats?.absent  ?? '—', color: '#dc2626', icon: AlertCircle },
    { label: 'Days on leave',value: stats?.leave   ?? '—', color: '#d97706', icon: CalendarCheck },
    { label: 'Tasks pending',value: stats?.pending ?? '—', color: '#7c3aed', icon: ClipboardList },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <div
          key={item.label}
          className="rounded-xl p-4"
          style={{ background: item.color + '0d', border: `1px solid ${item.color}28` }}
        >
          <item.icon size={18} style={{ color: item.color }} className="mb-2" />
          <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
          <p className="text-[12px] text-gray-500 mt-0.5">{item.label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">This month</p>
        </div>
      ))}
    </div>
  );
}

/* ── Task preview ───────────────────────────────────────────────────────── */
function TaskPreview() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/me/tasks?status=pending')
      .then(r => r.json())
      .then(j => setTasks((j.data ?? []).slice(0, 5)))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  function isOverdue(dueAt: string | null): boolean {
    return !!dueAt && dueAt.slice(0, 10) < today;
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px]">My Tasks</h3>
        <Link href="/my-space/tasks"
          className="flex items-center gap-1 text-[13px] font-medium"
          style={{ color: 'var(--accent-base)' }}>
          See all <ChevronRight size={14} />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
          <p className="text-sm text-gray-500">All caught up! No pending tasks.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: isOverdue(task.dueAt) ? '#dc2626' : 'var(--accent-base)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{task.title}</p>
                {task.dueAt && (
                  <p className="text-[11px] mt-0.5"
                    style={{ color: isOverdue(task.dueAt) ? '#dc2626' : '#6b7280' }}>
                    Due {new Date(task.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {isOverdue(task.dueAt) && ' · Overdue'}
                  </p>
                )}
              </div>
              {task.relatedType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 capitalize">
                  {task.relatedType}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Leave preview ──────────────────────────────────────────────────────── */
function LeavePreview() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/me/leave-requests')
      .then(r => r.json())
      .then(j => setLeaves((j.data ?? []).slice(0, 3)))
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    pending:   '#d97706',
    approved:  '#16a34a',
    rejected:  '#dc2626',
    cancelled: '#6b7280',
  };
  const leaveLabel: Record<string, string> = {
    casual: 'Casual', sick: 'Sick', earned: 'Earned', unpaid: 'Unpaid',
    maternity: 'Maternity', paternity: 'Paternity', comp_off: 'Comp Off',
  };

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px]">Leave Requests</h3>
        <Link href="/my-space/attendance"
          className="flex items-center gap-1 text-[13px] font-medium"
          style={{ color: 'var(--accent-base)' }}>
          Manage <ChevronRight size={14} />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : leaves.length === 0 ? (
        <div className="py-6 text-center">
          <CalendarCheck size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No leave requests yet.</p>
          <Link href="/my-space/attendance"
            className="text-[13px] font-medium mt-2 inline-block"
            style={{ color: 'var(--accent-base)' }}>
            Apply for leave →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {leaves.map(lr => {
            const from = new Date(lr.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const to   = new Date(lr.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const sameDay = lr.fromDate === lr.toDate;
            return (
              <div key={lr.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-medium">{leaveLabel[lr.leaveType] ?? lr.leaveType} Leave</p>
                  <p className="text-[12px] text-gray-500">{sameDay ? from : `${from} – ${to}`}</p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: (statusColor[lr.status] ?? '#6b7280') + '18', color: statusColor[lr.status] ?? '#6b7280' }}
                >
                  {lr.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Module shortcut cards ─────────────────────────────────────────────── */
function ModuleCards() {
  const modules = [
    { href: '/my-space/tasks',      icon: ClipboardList, label: 'My Tasks',          desc: 'View & manage your tasks',       color: '#7c3aed' },
    { href: '/my-space/attendance', icon: CalendarCheck, label: 'Attendance & Leave', desc: 'History, leaves & requests',     color: '#0891b2' },
    { href: '/my-space/profile',    icon: User,          label: 'My Profile',         desc: 'Update your info & contacts',    color: '#16a34a' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {modules.map(m => (
        <Link
          key={m.href}
          href={m.href}
          className="group rounded-2xl p-5 border transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: m.color + '14' }}>
              <m.icon size={18} style={{ color: m.color }} />
            </div>
            <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
          <p className="font-semibold text-[14px]">{m.label}</p>
          <p className="text-[12px] text-gray-500 mt-0.5">{m.desc}</p>
        </Link>
      ))}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function MySpacePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/v1/me/profile')
      .then(r => r.json())
      .then(j => setProfile(j.data));
  }, []);

  const firstName = profile?.fullName?.split(' ')[0] ?? '';

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-gray-500 mb-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}!
          </h1>
          {profile && (
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                style={{ background: 'var(--accent-base)14', color: 'var(--accent-base)' }}
              >
                <Briefcase size={12} />
                {profile.jobTitle ?? roleLabel(profile.role)}
              </span>
              {profile.department && (
                <span className="text-[12px] text-gray-400">{profile.department}</span>
              )}
            </div>
          )}
        </div>
        {profile?.photoUrl && (
          <img
            src={profile.photoUrl}
            alt={profile.fullName}
            className="w-12 h-12 rounded-full object-cover border-2"
            style={{ borderColor: 'var(--border)' }}
          />
        )}
      </div>

      {/* ── Check-in / Check-out ── */}
      <CheckInCard />

      {/* ── Quick stats (this month) ── */}
      <section>
        <h2 className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">This Month</h2>
        <QuickStats />
      </section>

      {/* ── Modules ── */}
      <section>
        <h2 className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">My Modules</h2>
        <ModuleCards />
      </section>

      {/* ── Tasks + Leave side-by-side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskPreview />
        <LeavePreview />
      </div>
    </main>
  );
}
