'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin, Clock, CheckCircle2, LogIn, LogOut,
  ClipboardList, CalendarCheck, AlertCircle, Loader2,
  CheckSquare, FolderKanban, ChevronRight, Plus, CalendarPlus,
  Gift, Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AttendanceRecord {
  id: string; date: string; status: string;
  checkInAt: string | null; checkOutAt: string | null;
  checkInLatitude: string | null; checkInLongitude: string | null;
  checkInAddress: string | null;
}
interface UserProfile {
  fullName: string; role: string;
  jobTitle: string | null; department: string | null; photoUrl: string | null;
}
interface Task {
  id: string; title: string; dueAt: string | null;
  completedAt: string | null; relatedType: string | null;
}
interface LeaveRequest {
  id: string; leaveType: string; fromDate: string; toDate: string; status: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
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
    owner: 'Owner', designer: 'Designer', supervisor: 'Site Supervisor',
    accountant: 'Accountant', employee: 'Employee',
  };
  return map[role] ?? role;
}
function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

/* ── Quick-action dialogs ───────────────────────────────────────────────── */
const LEAVE_TYPES = [
  { value: 'casual',    label: 'Casual Leave'    },
  { value: 'sick',      label: 'Sick Leave'      },
  { value: 'earned',    label: 'Earned Leave'    },
  { value: 'unpaid',    label: 'Unpaid Leave'    },
  { value: 'comp_off',  label: 'Comp Off'        },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
];

function NewTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title,  setTitle]  = useState('');
  const [dueAt,  setDueAt]  = useState('');
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function handleClose() {
    setTitle(''); setDueAt(''); setNotes(''); setError(null);
    onClose();
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), dueAt: dueAt || null, notes: notes || null }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to create task'); return; }
      handleClose();
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="qt-title">Task title</Label>
            <Input
              id="qt-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave(); }}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qt-due">Due date <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input id="qt-due" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qt-notes">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea id="qt-notes" placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyLeaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [leaveType, setLeaveType] = useState('casual');
  const [fromDate,  setFromDate]  = useState('');
  const [toDate,    setToDate]    = useState('');
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const days = fromDate && toDate
    ? Math.max(0, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1)
    : 0;

  function handleClose() {
    setLeaveType('casual'); setFromDate(''); setToDate(''); setReason(''); setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!fromDate || !toDate || !reason.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, fromDate, toDate, reason: reason.trim() }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to submit request'); return; }
      handleClose();
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(lt => (
                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ql-from">From</Label>
              <Input
                id="ql-from"
                type="date"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value);
                  if (!toDate || e.target.value > toDate) setToDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ql-to">To</Label>
              <Input id="ql-to" type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          {days > 0 && (
            <p className="text-[13px] text-gray-500">{days} day{days !== 1 ? 's' : ''} selected</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ql-reason">Reason</Label>
            <Textarea
              id="ql-reason"
              placeholder="Brief reason for leave…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !fromDate || !toDate || !reason.trim()}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Greeting Banner (2/3 width) ──────────────────────────────────────── */
function GreetingBanner() {
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [taskCount, setTaskCount]       = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [showTask,  setShowTask]        = useState(false);
  const [showLeave, setShowLeave]       = useState(false);

  useEffect(() => {
    fetch('/api/v1/me/profile').then(r => r.json()).then(j => setProfile(j.data));
    fetch('/api/v1/me/tasks?status=pending').then(r => r.json()).then(j => setTaskCount((j.data ?? []).length));
    fetch('/api/v1/projects').then(r => r.json()).then(j => setProjectCount((j.data ?? []).length));
  }, []);

  const firstName = profile?.fullName?.split(' ')[0] ?? '';

  return (
    <div
      className="premium-card p-6 flex flex-col justify-between gap-6 h-full"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xl font-bold select-none"
          style={{ background: 'var(--accent-base)' }}
        >
          {profile ? avatarInitials(profile.fullName) : <span className="w-6 h-6 rounded bg-white/30 animate-pulse block" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-gray-500 mb-0.5">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight leading-snug">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {profile ? (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                style={{ background: 'var(--accent-base)14', color: 'var(--accent-base)' }}
              >
                {profile.jobTitle ?? roleLabel(profile.role)}
              </span>
            ) : (
              <span className="h-5 w-24 rounded-full bg-gray-100 animate-pulse inline-block" />
            )}
            {profile?.department && (
              <span className="text-[12px] text-gray-400">{profile.department}</span>
            )}
          </div>
        </div>
      </div>

      {/* At-a-glance context pills */}
      <div className="flex flex-wrap gap-2.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100">
          <FolderKanban size={15} className="text-purple-500 flex-shrink-0" />
          <span className="text-[13px] font-medium text-purple-700 whitespace-nowrap">
            {projectCount === null
              ? <span className="inline-block w-6 h-4 bg-purple-200 rounded animate-pulse align-middle" />
              : projectCount} Active Projects
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100">
          <ClipboardList size={15} className="text-orange-500 flex-shrink-0" />
          <span className="text-[13px] font-medium text-orange-700 whitespace-nowrap">
            {taskCount === null
              ? <span className="inline-block w-6 h-4 bg-orange-200 rounded animate-pulse align-middle" />
              : taskCount} Pending Tasks
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 border border-sky-100">
          <CalendarCheck size={15} className="text-sky-500 flex-shrink-0" />
          <span className="text-[13px] font-medium text-sky-700 whitespace-nowrap">
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2.5 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setShowTask(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: '#7c3aed14', color: '#7c3aed', border: '1px solid #ddd6fe' }}
        >
          <Plus size={15} />
          New Task
        </button>
        <button
          onClick={() => setShowLeave(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: '#0891b214', color: '#0284c7', border: '1px solid #bae6fd' }}
        >
          <CalendarPlus size={15} />
          Apply Leave
        </button>
      </div>

      <NewTaskDialog  open={showTask}  onClose={() => setShowTask(false)}  />
      <ApplyLeaveDialog open={showLeave} onClose={() => setShowLeave(false)} />
    </div>
  );
}

/* ── Check-in Card (1/3 width) ────────────────────────────────────────── */
function CheckInCard() {
  const [record, setRecord]   = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'fetching' | 'ok' | 'denied'>('idle');
  const [error, setError]     = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/me/check-in');
      const json = await res.json();
      setRecord(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  async function getLocation(): Promise<{ latitude?: number; longitude?: number }> {
    if (!navigator.geolocation) return {};
    setGeoStatus('fetching');
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => { setGeoStatus('ok'); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
        ()  => { setGeoStatus('denied'); resolve({}); },
        { timeout: 8000, maximumAge: 0 },
      );
    });
  }

  async function handleCheckIn() {
    setActing(true); setError(null);
    const loc = await getLocation();
    try {
      const res = await fetch('/api/v1/me/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loc),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Check-in failed'); return; }
      await loadToday();
    } catch { setError('Network error. Please try again.'); }
    finally { setActing(false); }
  }

  async function handleCheckOut() {
    setActing(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/check-out', { method: 'POST' });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Check-out failed'); return; }
      await loadToday();
    } catch { setError('Network error. Please try again.'); }
    finally { setActing(false); }
  }

  const isCheckedIn  = !!record?.checkInAt;
  const isCheckedOut = !!record?.checkOutAt;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between gap-4 h-full"
      style={{
        background: isCheckedIn
          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: `1.5px solid ${isCheckedIn ? '#bbf7d0' : '#bfdbfe'}`,
      }}
    >
      {/* Status */}
      <div>
        <p
          className="text-[12px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: isCheckedIn ? '#15803d' : '#1d4ed8' }}
        >
          {isCheckedIn ? 'Currently Working' : "Today's Attendance"}
        </p>

        {loading ? (
          <div className="h-8 w-28 rounded bg-white/60 animate-pulse" />
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
              <div className="flex items-center gap-1 mt-2">
                <MapPin size={12} style={{ color: '#16a34a' }} />
                <span className="text-[12px] text-gray-600 truncate">{record.checkInAddress}</span>
              </div>
            )}
            {record?.checkInLatitude && !record.checkInAddress && (
              <div className="flex items-center gap-1 mt-2">
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
          <p className="text-xl font-bold mt-1" style={{ color: '#1d4ed8' }}>Not checked in</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {!loading && (
          <>
            {!isCheckedIn && (
              <button
                onClick={handleCheckIn} disabled={acting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                style={{ background: '#2563eb' }}
              >
                {acting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Check In
              </button>
            )}
            {isCheckedIn && !isCheckedOut && (
              <button
                onClick={handleCheckOut} disabled={acting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                style={{ background: '#16a34a' }}
              >
                {acting ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                Check Out
              </button>
            )}
            {isCheckedOut && (
              <div
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: '#dcfce7', color: '#15803d' }}
              >
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Day complete</span>
              </div>
            )}
          </>
        )}
        {geoStatus === 'denied' && (
          <p className="text-[11px] text-amber-600 text-center">
            Location off — check-in recorded without GPS
          </p>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Clock size={13} className="text-gray-400" />
          <span className="text-[12px] text-gray-400">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Monthly Stats Strip ────────────────────────────────────────────────── */
function QuickStats() {
  const [stats, setStats] = useState<{
    present: number; absent: number; leave: number; pending: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const days  = new Date(year, now.getMonth() + 1, 0).getDate();
      const from  = `${year}-${month}-01`;
      const to    = `${year}-${month}-${String(days).padStart(2, '0')}`;

      const [attRes, taskRes] = await Promise.all([
        fetch(`/api/v1/me/attendance?from=${from}&to=${to}`),
        fetch('/api/v1/me/tasks?status=pending'),
      ]);
      const [att, task] = await Promise.all([attRes.json(), taskRes.json()]);
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

  const STAT_META = [
    { label: 'Days Present',  key: 'present' as const, accentBg: 'var(--accent-green-bg)',  accentFg: 'var(--accent-green)',  icon: CheckCircle2, sub: 'This month' },
    { label: 'Days Absent',   key: 'absent'  as const, accentBg: 'var(--accent-orange-bg)', accentFg: 'var(--accent-orange)', icon: AlertCircle,  sub: 'This month' },
    { label: 'On Leave',      key: 'leave'   as const, accentBg: 'var(--accent-blue-bg)',   accentFg: 'var(--accent-blue)',   icon: CalendarCheck, sub: 'This month' },
    { label: 'Tasks Pending', key: 'pending' as const, accentBg: 'var(--accent-purple-bg)', accentFg: 'var(--accent-purple)', icon: CheckSquare,  sub: 'All projects' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {STAT_META.map(s => (
        <div key={s.key} className="premium-card p-5">
          <div className="stat-badge mb-3" style={{ backgroundColor: s.accentBg }}>
            <s.icon className="h-4 w-4" style={{ color: s.accentFg }} />
          </div>
          {stats
            ? <p className="text-2xl font-bold leading-none mb-1" style={{ color: 'var(--text-heading)' }}>{stats[s.key]}</p>
            : <div className="skeleton h-7 w-12 mb-1" />
          }
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{s.label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Task Preview ────────────────────────────────────────────────────────── */
function TaskPreview() {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/me/tasks?status=pending')
      .then(r => r.json())
      .then(j => setTasks((j.data ?? []).slice(0, 6)))
      .finally(() => setLoading(false));
  }, []);

  const today     = new Date().toISOString().slice(0, 10);
  const isOverdue = (dueAt: string | null) => !!dueAt && dueAt.slice(0, 10) < today;

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px]">My Tasks</h3>
        <Link
          href="/my-space/tasks"
          className="flex items-center gap-1 text-[13px] font-medium"
          style={{ color: 'var(--accent-base)' }}
        >
          See all <ChevronRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-10 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
          <p className="text-sm text-gray-500">All caught up! No pending tasks.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div
                className="w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: isOverdue(task.dueAt) ? '#dc2626' : 'var(--accent-base)' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{task.title}</p>
                {task.dueAt && (
                  <p className="text-[11px] mt-0.5" style={{ color: isOverdue(task.dueAt) ? '#dc2626' : '#6b7280' }}>
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

/* ── Leave Preview ───────────────────────────────────────────────────────── */
function LeavePreview() {
  const [leaves, setLeaves]   = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/me/leave-requests')
      .then(r => r.json())
      .then(j => setLeaves((j.data ?? []).slice(0, 4)))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_COLOR: Record<string, string> = {
    pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', cancelled: '#6b7280',
  };
  const LEAVE_LABEL: Record<string, string> = {
    casual: 'Casual', sick: 'Sick', earned: 'Earned', unpaid: 'Unpaid',
    maternity: 'Maternity', paternity: 'Paternity', comp_off: 'Comp Off',
  };

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[15px]">Leave Requests</h3>
        <Link
          href="/my-space/attendance"
          className="flex items-center gap-1 text-[13px] font-medium"
          style={{ color: 'var(--accent-base)' }}
        >
          Apply / Manage <ChevronRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : leaves.length === 0 ? (
        <div className="py-10 text-center">
          <CalendarCheck size={30} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No leave requests yet.</p>
          <Link
            href="/my-space/attendance"
            className="text-[13px] font-medium mt-2 inline-block"
            style={{ color: 'var(--accent-base)' }}
          >
            Apply for leave →
          </Link>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {leaves.map(lr => {
            const from    = new Date(lr.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const to      = new Date(lr.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const sameDay = lr.fromDate === lr.toDate;
            const c       = STATUS_COLOR[lr.status] ?? '#6b7280';
            return (
              <div key={lr.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{LEAVE_LABEL[lr.leaveType] ?? lr.leaveType} Leave</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">{sameDay ? from : `${from} – ${to}`}</p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: c + '18', color: c }}
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

/* ── Referral Section ───────────────────────────────────────────────────── */
function ReferralSection() {
  return (
    <div className="premium-card p-6 flex items-center justify-between gap-6 flex-wrap">
      <div className="flex items-start gap-4">
        <div className="stat-badge flex-shrink-0" style={{ backgroundColor: 'var(--accent-purple-bg)' }}>
          <Gift className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} />
        </div>
        <div>
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-heading)' }}>Refer a Client</h3>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Know someone looking for interior design services? Refer them and earn a bonus when they sign on as a client.
          </p>
        </div>
      </div>
      <Link
        href="/leads"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold whitespace-nowrap transition-all hover:opacity-90 active:scale-95"
        style={{ background: 'var(--accent-base)' }}
      >
        <Users size={16} />
        Refer a Client
      </Link>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function MySpacePage() {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">

      {/* Row 1 — Greeting (2/3) + Check-in (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <GreetingBanner />
        </div>
        <div className="flex flex-col">
          <CheckInCard />
        </div>
      </div>

      {/* Row 2 — Monthly stats (4 cols) */}
      <QuickStats />

      {/* Row 3 — Tasks + Leave (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TaskPreview />
        <LeavePreview />
      </div>

      {/* Row 4 — Referral */}
      <ReferralSection />

    </div>
  );
}
