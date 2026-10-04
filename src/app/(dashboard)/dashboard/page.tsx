'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/providers/user-provider';
import Link from 'next/link';
import Image from 'next/image';
import {
  FolderKanban, IndianRupee,
  Target, CheckCircle2, AlertCircle, Clock, ChevronRight,
  Calendar, MapPin, Home,
  CheckSquare, Bell,
  Plus, UserCheck, Plane, ListTodo, Loader2, ArrowRight,
  Check, CalendarDays, UsersRound, Folder, Building2,
} from 'lucide-react';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import type { Lead } from '@/types/leads';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface LeadStats {
  new: number; contacted: number; qualified: number;
  site_visit: number; measurement: number; quotation: number;
  negotiation: number; won: number; lost: number;
}
interface RecentLead {
  id: string; contactName: string; stage: string;
  followUpDate: string | null; projectName: string | null;
  projectValuePaise: number | null; priority: string | null;
  lastActivityAt: string | null;
}
interface Project {
  id: string; name: string; lifecycleStage: string;
  totalContractPaise: number | null;
  customerFullName: string | null; leadContactName: string | null;
  expectedEndAt: string | null;
  projectLocation?: string | null; propertyType?: string | null;
}
interface ReceivableItem {
  id: string; projectName: string; label: string; amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue'; daysSinceCreation: number;
}
interface ReceivablesData {
  items: ReceivableItem[]; totalOutstandingPaise: number; totalOverduePaise: number;
}
interface SiteVisit {
  id: string; leadId: string | null;
  scheduledAt: string; completedAt: string | null;
  status: string;
  locationJson: { address?: string } | null;
  visitNumber: string | null;
  leadName: string | null;
  purpose: string | null;
}
interface Task {
  id: string; title: string; dueAt: string | null; completedAt: string | null;
  status: string; createdBy: string | null; relatedType: string | null;
}
interface AttendanceRecord {
  id: string; date: string; status: string;
  checkInAt: string | null; checkOutAt: string | null;
}
interface LeaveRequest {
  id: string; leaveType: string; fromDate: string; toDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null; createdAt: string; userId: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`;
  if (r >= 100_000)    return `₹${(r / 100_000).toFixed(1)}L`;
  if (r >= 1_000)      return `₹${(r / 1_000).toFixed(0)}K`;
  return `₹${Math.round(r)}`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
function headerDate(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getFollowUpUrgency(dateStr: string): 'overdue' | 'today' | 'upcoming' {
  if (isToday(dateStr)) return 'today';
  if (new Date(dateStr) < new Date()) return 'overdue';
  return 'upcoming';
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}
const LEAVE_TYPE_LABEL: Record<string, string> = {
  casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
  unpaid: 'Unpaid Leave', maternity: 'Maternity Leave', paternity: 'Paternity Leave', comp_off: 'Comp Off',
};

/* ── Stage config ───────────────────────────────────────────────────────── */
const STAGE_PROGRESS: Record<string, number> = {
  design_pending: 10, design_in_progress: 30, design_approved: 45,
  procurement: 55, execution: 70, snagging: 85, handover: 93, complete: 100,
};
const STAGE_META: Record<string, { label: string; bg: string; text: string }> = {
  design_pending:     { label: 'Design Pending',  bg: 'var(--surface-muted)', text: 'var(--text-secondary)' },
  design_in_progress: { label: 'Designing',       bg: 'var(--accent-soft)',   text: 'var(--accent-text)'   },
  design_approved:    { label: 'Design ✓',        bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
  procurement:        { label: 'Procurement',      bg: 'var(--warning-soft)',  text: 'var(--warning-text)'  },
  execution:          { label: 'Execution',        bg: 'var(--accent-soft)',   text: 'var(--accent-text)'   },
  snagging:           { label: 'Snagging',         bg: 'var(--warning-soft)',  text: 'var(--warning-text)'  },
  handover:           { label: 'Handover',         bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
  complete:           { label: 'Complete',         bg: 'var(--success-soft)',  text: 'var(--success-text)'  },
};

const FUNNEL_STAGES = [
  { key: 'new',        label: 'New Enquiry' },
  { key: 'site_visit', label: 'Site Visit'  },
  { key: 'won',        label: 'Won'         },
];
const FUNNEL_COLORS = ['var(--info)', 'var(--warning)', 'var(--accent-base)'];

/* ── Upcoming visits widget ────────────────────────────────────────────── */
function TodayVisitsWidget({ todayVisits, loading }: { todayVisits: SiteVisit[]; loading: boolean }) {
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <h3 className="section-title">Upcoming Site Visits</h3>
          {todayVisits.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              {todayVisits.length}
            </span>
          )}
        </div>
        <Link href="/site-visits" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
          All →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
        </div>
      ) : todayVisits.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--surface-muted)', border: '1px dashed var(--border-subtle)' }}>
          <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No upcoming site visits</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {todayVisits.map(v => {
            const d = new Date(v.scheduledAt);
            const dateLabel = isToday(v.scheduledAt)
              ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const address = v.locationJson?.address;
            return (
              <Link
                key={v.id}
                href={`/site-visits/${v.id}`}
                className="group flex gap-3 rounded-xl border p-3 transition-colors hover:border-[var(--accent-base)]"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)' }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--accent-soft)' }}>
                  <Clock className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                    {v.leadName ?? dateLabel}
                  </p>
                  <p className="text-[11px] tnum mt-0.5" style={{ color: 'var(--text-secondary)' }}>{dateLabel}</p>
                  {address && (
                    <div className="flex items-start gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{address}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── My tasks widget (employee view) ───────────────────────────────────── */
function MyTasksWidget({
  myTasks, loading, myUserId, onTasksChange,
}: {
  myTasks: Task[];
  loading: boolean;
  myUserId: string;
  onTasksChange: (tasks: Task[]) => void;
}) {
  const [patching, setPatching] = useState<string | null>(null);

  async function patchStatus(task: Task, newStatus: 'in_progress' | 'done') {
    setPatching(task.id);
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      if (newStatus === 'done') {
        onTasksChange(myTasks.filter(t => t.id !== task.id));
      } else {
        const json = await res.json();
        onTasksChange(myTasks.map(t => t.id === task.id ? { ...t, ...json.data } : t));
      }
    } finally { setPatching(null); }
  }

  const now           = new Date();
  const todayEnd      = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const activeCount   = myTasks.length;
  const overdueCount  = myTasks.filter(t => t.dueAt && new Date(t.dueAt) < now).length;
  const dueTodayCount = myTasks.filter(t => {
    if (!t.dueAt) return false;
    const d = new Date(t.dueAt);
    return d >= now && d <= todayEnd;
  }).length;

  return (
    <div className="premium-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>My Tasks</h3>
        </div>
        <Link href="/tasks"
          className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
          style={{ color: 'var(--accent-base)' }}>
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary chips */}
      {!loading && activeCount > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent-base)' }} />
            {activeCount} Active
          </span>
          {dueTodayCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
              <Clock className="h-2.5 w-2.5" />
              {dueTodayCount} Due Today
            </span>
          )}
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <AlertCircle className="h-2.5 w-2.5" />
              {overdueCount} Overdue
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-[52px] rounded-lg" />)}
        </div>
      ) : myTasks.length === 0 ? (
        <div className="flex flex-col items-center py-5 text-center">
          <div className="h-9 w-9 rounded-full flex items-center justify-center mb-2"
            style={{ background: 'var(--success-soft)' }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success-text)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>All clear!</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>No active tasks assigned to you</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {myTasks.slice(0, 5).map(t => {
            const dueDate    = t.dueAt ? new Date(t.dueAt) : null;
            const overdue    = !!(dueDate && dueDate < now);
            const dueToday   = !!(dueDate && !overdue && dueDate <= todayEnd);
            const isAssigned = !!(t.createdBy && t.createdBy !== myUserId);
            const inProgress = t.status === 'in_progress';
            const isPatching = patching === t.id;

            const borderColor = overdue    ? 'var(--danger)'
                              : inProgress ? 'var(--accent-base)'
                              : dueToday   ? 'var(--warning-text)'
                              : 'var(--border-subtle)';

            return (
              <div key={t.id}
                className="rounded-lg px-3 py-2.5 flex items-center gap-2.5"
                style={{ background: 'var(--surface-muted)', borderLeft: `3px solid ${borderColor}` }}>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--text-heading)' }}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {inProgress && (
                      <span className="text-[10px] font-bold rounded-full px-1.5 py-0"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                        In Progress
                      </span>
                    )}
                    {t.relatedType && (
                      <span className="text-[10px] capitalize" style={{ color: 'var(--text-tertiary)' }}>
                        {t.relatedType}
                      </span>
                    )}
                    {dueDate && (
                      <span className="text-[10px]"
                        style={{ color: overdue ? 'var(--danger)' : dueToday ? 'var(--warning-text)' : 'var(--text-tertiary)' }}>
                        {overdue   ? `Overdue · ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                         : dueToday ? 'Due today'
                         : `Due ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                      </span>
                    )}
                    {isAssigned && !inProgress && (
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Assigned</span>
                    )}
                  </div>
                </div>

                {isPatching ? (
                  <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                ) : t.status === 'pending' ? (
                  <button type="button" onClick={() => patchStatus(t, 'in_progress')}
                    className="flex-shrink-0 text-[11px] font-bold rounded-md px-2.5 py-1 whitespace-nowrap"
                    style={{ border: '1px solid var(--accent-base)', color: 'var(--accent-base)', background: 'transparent' }}>
                    Start
                  </button>
                ) : inProgress ? (
                  <button type="button" onClick={() => patchStatus(t, 'done')}
                    className="flex-shrink-0 text-[11px] font-bold rounded-md px-2.5 py-1 whitespace-nowrap"
                    style={{ background: 'var(--success)', color: '#fff' }}>
                    Done ✓
                  </button>
                ) : null}
              </div>
            );
          })}
          {myTasks.length > 5 && (
            <Link href="/tasks"
              className="block text-center text-[11px] font-semibold pt-1 hover:underline"
              style={{ color: 'var(--text-secondary)' }}>
              +{myTasks.length - 5} more tasks
            </Link>
          )}
        </div>
      )}
    </div>
  );
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

function NewTaskDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
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
        body: JSON.stringify({
          title: title.trim(),
          // Input type="date" gives "YYYY-MM-DD"; route requires full ISO datetime
          dueAt: dueAt ? new Date(dueAt + 'T00:00:00').toISOString() : null,
          notes: notes || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to create task'); return; }
      handleClose();
      onCreated();
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
            <Label htmlFor="dt-title">Task title</Label>
            <Input id="dt-title" placeholder="What needs to be done?" value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave(); }}
              autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dt-due">Due date <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input id="dt-due" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dt-notes">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea id="dt-notes" placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
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

function ApplyLeaveDialog({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [leaveType, setLeaveType] = useState('casual');
  const [fromDate,  setFromDate]  = useState('');
  const [toDate,    setToDate]    = useState('');
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const days = fromDate && toDate
    ? Math.max(0, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86_400_000) + 1)
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
      onSubmitted();
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(lt => (
                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dl-from">From</Label>
              <Input id="dl-from" type="date" value={fromDate}
                onChange={e => { setFromDate(e.target.value); if (!toDate || e.target.value > toDate) setToDate(e.target.value); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dl-to">To</Label>
              <Input id="dl-to" type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          {days > 0 && <p className="text-[13px] text-gray-500">{days} day{days !== 1 ? 's' : ''} selected</p>}
          <div className="space-y-1.5">
            <Label htmlFor="dl-reason">Reason</Label>
            <Textarea id="dl-reason" placeholder="Brief reason for leave…" value={reason}
              onChange={e => setReason(e.target.value)} rows={3} />
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

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — components
   ══════════════════════════════════════════════════════════════════════════ */

/** Faint architectural line-work drawn over the hero's green panel. */
function BlueprintArt() {
  return (
    <svg
      viewBox="0 0 420 240" fill="none" aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-[30%] hidden h-[92%] w-auto md:block"
      stroke="rgba(255,255,255,0.09)" strokeWidth="0.9"
    >
      {/* elevation — upper storey */}
      <path d="M150 40h170v70H150z" />
      <path d="M150 58h170M150 76h170M150 94h170" strokeOpacity=".6" />
      <path d="M185 40v70M220 40v70M255 40v70M290 40v70" strokeOpacity=".6" />
      {/* ground storey + cantilever */}
      <path d="M110 110h250v90H110z" />
      <path d="M130 130h60v70h-60zM210 130h40v35h-40zM270 130h70v50h-70z" />
      <path d="M110 200h250" />
      {/* perspective lines */}
      <path d="M40 220 150 110M40 220h360M60 240 200 110" strokeOpacity=".5" />
      <path d="M320 40 380 12M360 110l40-22M360 200l40-26M380 12v162" strokeOpacity=".7" />
      <path d="M0 150h110M0 180h110M30 120v100M70 120v100" strokeOpacity=".35" />
      {/* dimension ticks */}
      <path d="M150 28h170M150 24v8M320 24v8M235 24v8" strokeOpacity=".5" />
    </svg>
  );
}

function HeroBanner({
  firstName, status, loading,
}: {
  firstName: string;
  status: { tone: 'ok' | 'attention'; label: string; href?: string };
  loading: boolean;
}) {
  const pill = (
    <span
      className="inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-white"
      style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}
    >
      {status.tone === 'ok'
        ? <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white"><Check className="h-3 w-3" style={{ color: 'var(--hero-from)' }} strokeWidth={3} /></span>
        : <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ background: 'var(--accent-gold)' }}><AlertCircle className="h-3 w-3 text-white" strokeWidth={2.5} /></span>}
      {status.label}
    </span>
  );

  return (
    <section
      className="relative isolate overflow-hidden rounded-2xl"
      style={{ background: 'linear-gradient(120deg, var(--hero-from) 0%, var(--hero-to) 100%)' }}
    >
      {/* Photo — full-bleed behind the copy on phones, the right half from md up */}
      <div className="absolute inset-0 -z-10 md:left-auto md:w-[50%]">
        <Image
          src="/dashboard/hero-building.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-center"
        />
        {/* Mobile: darken the whole photo so the copy stays legible */}
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(90deg, var(--hero-from) 10%, rgba(20,52,38,0.82) 60%, rgba(20,52,38,0.55) 100%)' }} />
        {/* md+: blend the photo's left edge into the green */}
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, var(--hero-to) 0%, rgba(20,52,38,0.55) 14%, rgba(20,52,38,0) 36%)' }} />
      </div>

      <BlueprintArt />

      <div className="relative flex min-h-[190px] flex-col justify-center px-6 py-6 sm:px-8 md:min-h-[204px] md:max-w-[62%] 2xl:min-h-[228px]">
        <p className="font-display text-[15px] sm:text-[16px] 2xl:text-[17px]" style={{ color: 'rgba(255,255,255,0.88)' }} suppressHydrationWarning>
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </p>
        <h2 className="font-display mt-1 text-[28px] font-medium leading-[1.1] tracking-[-0.015em] text-white sm:text-[34px] xl:text-[38px] 2xl:text-[44px]">
          Building better, together.
        </h2>
        <p className="font-display mt-2 text-[14.5px] sm:text-[15.5px] 2xl:text-[16.5px]" style={{ color: 'rgba(255,255,255,0.86)' }}>
          Your projects, people and progress. All in one place.
        </p>
        <div className="mt-5 h-[34px]">
          {loading
            ? <span className="inline-block h-[34px] w-36 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            : status.href ? <Link href={status.href} className="inline-block transition-opacity hover:opacity-90">{pill}</Link> : pill}
        </div>
      </div>

      {/* Studio motto — sits on the seam between panel and photo */}
      <div className="pointer-events-none absolute bottom-6 left-[calc(50%+22px)] hidden lg:block" aria-hidden="true">
        <p className="text-[9.5px] font-medium uppercase leading-[1.9] tracking-[0.32em]" style={{ color: 'rgba(255,255,255,0.78)' }}>
          People<br />Plans<br />Progress
        </p>
        <span className="mt-2 block h-[2px] w-7" style={{ background: 'var(--accent-gold)' }} />
      </div>
    </section>
  );
}

const STAT_TONES = {
  green: { bg: 'var(--success-soft)', fg: 'var(--accent-base)' },
  amber: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
} as const;

function StatCard({
  label, value, sub, icon: Icon, tone, loading, href,
}: {
  label: string; value: string; sub: string; icon: React.ElementType;
  tone: keyof typeof STAT_TONES; loading: boolean; href: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <Link
      href={href}
      className="dash-card group flex items-start gap-3.5 p-4 transition-colors hover:border-[var(--border-strong)] 2xl:gap-4 2xl:p-5"
    >
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ background: t.bg }}>
        <Icon className="h-5 w-5" style={{ color: t.fg }} strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--text-secondary)' }} />
        </div>
        {loading ? (
          <>
            <div className="skeleton mt-2 h-7 w-16 rounded" />
            <div className="skeleton mt-2.5 h-3.5 w-32 rounded" />
          </>
        ) : (
          <>
            <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.03em] tabular-nums 2xl:text-[30px]" style={{ color: 'var(--text-heading)' }}>
              {value}
            </p>
            <p className="mt-0.5 truncate text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
          </>
        )}
      </div>
    </Link>
  );
}

function CardHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="text-[16.5px] font-semibold tracking-[-0.015em] 2xl:text-[18px]" style={{ color: 'var(--text-heading)' }}>{title}</h3>
      <Link href={href} className="inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: 'var(--accent-text)' }}>
        {linkLabel}<ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Ring chart: one arc per stage, drawn on a soft track. */
function PipelineRing({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
  const R = 50, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative h-[124px] w-[124px] flex-shrink-0">
      <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90">
        <circle cx="74" cy="74" r={R} fill="none" stroke="var(--success-soft)" strokeWidth="16" />
        {total > 0 && segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i} cx="74" cy="74" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        {/* Soft highlight on the arc's start, echoing the design's two-tone ring */}
        {total > 0 && <circle cx="74" cy="74" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="16" strokeDasharray={`${C * 0.07} ${C}`} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: 'var(--text-heading)' }}>{total}</span>
        <span className="mt-1 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>Total leads</span>
      </div>
    </div>
  );
}

/** "Commercial – Office" → "Commercial". The list only has room for the category. */
function propertyCategory(value: string | null): string | null {
  if (!value) return null;
  return value.split(/[–-]/)[0].trim() || null;
}

/* ── Page ───────────────────────────────────────────────────────────────── */
interface FollowUpCounts { overdue: number; dueToday: number; upcoming: number; total: number; }

export default function DashboardPage() {
  const router = useRouter();
  const { isAdmin: contextAdmin, id: contextId, fullName: contextFullName, roleLoaded } = useUser();
  const [firstName,  setFirstName]  = useState('');
  const [isAdmin,    setIsAdmin]    = useState(false);

  // Admin state
  const [leadStats,    setLeadStats]    = useState<LeadStats | null>(null);
  const [allProjects,  setAllProjects]  = useState<Project[]>([]);
  const [receivables,  setReceivables]  = useState<ReceivablesData>({
    items: [], totalOutstandingPaise: 0, totalOverduePaise: 0,
  });
  const [totalRevenuePaise, setTotalRevenuePaise] = useState(0);
  const [recentLeads,       setRecentLeads]       = useState<RecentLead[]>([]);

  // Shared state
  const [todayVisits,  setTodayVisits]  = useState<SiteVisit[]>([]);
  const [myTasks,      setMyTasks]      = useState<Task[]>([]);
  const [myProjects,   setMyProjects]   = useState<Project[]>([]);

  const [myUserId, setMyUserId] = useState('');

  // Employee-only state
  const [todayAttd,   setTodayAttd]   = useState<AttendanceRecord | null>(null);
  const [monthAttd,   setMonthAttd]   = useState<AttendanceRecord[]>([]);
  const [myLeaves,    setMyLeaves]    = useState<LeaveRequest[]>([]);
  const [showTask,     setShowTask]     = useState(false);
  const [showLeave,    setShowLeave]    = useState(false);
  const [checkingIn,   setCheckingIn]   = useState(false);
  const [checkingOut,  setCheckingOut]  = useState(false);

  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [followUps,  setFollowUps]  = useState<FollowUpCounts | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    // Seed local state from the already-loaded user context (no extra /api/v1/me call)
    const admin = contextAdmin;
    setIsAdmin(admin);
    if (contextFullName) setFirstName(contextFullName.split(' ')[0]);
    if (contextId)       setMyUserId(contextId);
    try {
      const [sv] = await Promise.all([
        fetch('/api/v1/site-visits').then(r => r.json()),
      ]);

      const allVisits: SiteVisit[] = Array.isArray(sv?.data) ? sv.data : [];
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);
      setTodayVisits(
        allVisits
          .filter(v => {
            if (v.status !== 'scheduled') return false;
            const d = new Date(v.scheduledAt);
            return d >= now && d <= sevenDaysLater;
          })
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
      );
      fetch('/api/v1/dashboard/follow-ups')
        .then(r => r.ok ? r.json() : null)
        .then(j => j?.data && setFollowUps(j.data))
        .catch(() => {});

      if (admin) {
        const [ls, ps, rs, rl] = await Promise.all([
          fetch('/api/v1/leads/stats').then(r => r.json()),
          fetch('/api/v1/projects').then(r => r.json()),
          fetch('/api/v1/accounts/receivables').then(r => r.json()),
          fetch('/api/v1/leads?limit=15').then(r => r.json()),
        ]);
        if (ls?.data?.counts) setLeadStats(ls.data.counts);
        if (Array.isArray(ps?.data)) {
          setAllProjects(ps.data);
          setTotalRevenuePaise(
            (ps.data as { totalContractPaise: number | null }[])
              .reduce((sum, p) => sum + (p.totalContractPaise ?? 0), 0),
          );
        }
        if (rs?.data) {
          setReceivables({
            items: Array.isArray(rs.data.items) ? rs.data.items : [],
            totalOutstandingPaise: rs.data.totalOutstandingPaise ?? 0,
            totalOverduePaise: rs.data.totalOverduePaise ?? 0,
          });
        }
        if (Array.isArray(rl?.data)) setRecentLeads(rl.data);
      } else {
        const uid = contextId ?? '';
        const todayStr = new Date().toISOString().split('T')[0];
        const nowDate  = new Date();
        const monthStart = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-01`;

        const [ts, ps, atdDay, atdMon, leaveData] = await Promise.all([
          fetch('/api/v1/tasks?assigned=me&status=active&limit=10').then(r => r.json()),
          fetch('/api/v1/projects?limit=20').then(r => r.json()),
          uid ? fetch(`/api/v1/attendance?date=${todayStr}&userId=${uid}`).then(r => r.json()).catch(() => null) : Promise.resolve(null),
          uid ? fetch(`/api/v1/attendance?from=${monthStart}&to=${todayStr}&userId=${uid}`).then(r => r.json()).catch(() => null) : Promise.resolve(null),
          fetch('/api/v1/attendance/leave-requests?mine=1').then(r => r.json()).catch(() => null),
        ]);

        if (Array.isArray(ts?.data)) setMyTasks(ts.data);
        if (Array.isArray(ps?.data)) {
          setMyProjects(ps.data.filter((p: Project) => p.lifecycleStage !== 'complete').slice(0, 5));
        }
        if (Array.isArray(atdDay?.data) && atdDay.data.length > 0) setTodayAttd(atdDay.data[0]);
        if (Array.isArray(atdMon?.data)) setMonthAttd(atdMon.data);
        if (Array.isArray(leaveData?.data)) setMyLeaves((leaveData.data as LeaveRequest[]).slice(0, 4));
      }
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, [contextAdmin, contextId, contextFullName]);

  // Only load data once we know the user's role — prevents the employee-view flash
  useEffect(() => { if (roleLoaded) load(); }, [roleLoaded, load]);

  /* ── Derived ──────────────────────────────────────────────────────── */
  function funnelCount(key: string): number {
    if (!leadStats) return 0;
    return leadStats[key as keyof LeadStats] ?? 0;
  }

  const totalLeads     = leadStats
    ? leadStats.new + leadStats.site_visit + leadStats.won + leadStats.lost
    : 0;
  const activeLeads    = leadStats ? leadStats.new + leadStats.site_visit : 0;
  const activeProjects = allProjects.filter(p => p.lifecycleStage !== 'complete');
  const conversionPct  = leadStats && totalLeads > 0
    ? Math.round((leadStats.won / totalLeads) * 100) : 0;
  const overdueCount   = receivables.items.filter(r => r.paymentStatus === 'overdue').length;

  // Follow-up leads: those with a set followUpDate, sorted overdue → today → upcoming
  const followUpLeads = recentLeads
    .filter(l => l.followUpDate)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
    .slice(0, 6);

  /* ── Role not yet confirmed — show a neutral skeleton so there is no flash ── */
  if (!roleLoaded) {
    return (
      <div className="p-4 lg:p-8 space-y-5 animate-pulse">
        <div className="h-8 w-48 rounded-lg skeleton" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 rounded-xl skeleton" />
          <div className="h-64 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     ADMIN VIEW
     ══════════════════════════════════════════════════════════════════════ */
  if (isAdmin) {
    const pendingFollowUps = (followUps?.overdue ?? 0) + (followUps?.dueToday ?? 0);
    const heroStatus: { tone: 'ok' | 'attention'; label: string; href?: string } =
      overdueCount > 0
        ? { tone: 'attention', label: `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''}`, href: '/finance' }
        : pendingFollowUps > 0
          ? { tone: 'attention', label: `${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? 's' : ''} due`, href: '/leads?followup=today' }
          : { tone: 'ok', label: 'All caught up' };

    const followUpRows = [
      { label: 'Overdue',   value: followUps?.overdue  ?? 0, color: 'var(--danger)',  href: '/leads?followup=overdue'  },
      { label: 'Due today', value: followUps?.dueToday ?? 0, color: 'var(--warning)', href: '/leads?followup=today'    },
      { label: 'Upcoming',  value: followUps?.upcoming ?? 0, color: 'var(--info)',    href: '/leads?followup=upcoming' },
    ];
    const shownProjects = activeProjects.slice(0, 3);

    return (
      <div className="animate-fade-in mx-auto max-w-[1600px] space-y-4 px-4 pb-8 pt-4 sm:px-6 lg:pt-5 2xl:space-y-5">

        {loadError && (
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Failed to load dashboard data.</span>
            <button type="button" onClick={load}
              className="ml-4 text-xs font-bold hover:underline" style={{ color: 'var(--danger)' }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Heading ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-none tracking-[-0.03em] sm:text-[32px] 2xl:text-[38px]" style={{ color: 'var(--text-heading)' }}>
              Dashboard
            </h1>
            <p className="font-display mt-1.5 text-[14.5px] sm:text-[15.5px] 2xl:text-[16.5px]" style={{ color: 'var(--text-secondary)' }}>
              A clear view of your business, from enquiry to execution.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center justify-between gap-4 sm:justify-end sm:gap-6">
            <span className="inline-flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--text-primary)' }} suppressHydrationWarning>
              <CalendarDays className="h-[18px] w-[18px]" style={{ color: 'var(--text-secondary)' }} strokeWidth={1.6} />
              {headerDate()}
            </span>
            <NewLeadDialog
              onSuccess={(lead: Lead) => router.push(`/leads/${lead.id}`)}
              triggerClassName="btn-primary inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-lg px-4 text-[14px]"
              triggerLabel={<><Plus className="h-4 w-4" strokeWidth={2.2} />New Lead</>}
            />
          </div>
        </div>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <HeroBanner firstName={firstName} status={heroStatus} loading={loading} />

        {/* ── KPIs ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4 2xl:gap-4">
          <StatCard
            label="Total Leads" value={String(totalLeads)}
            sub={`${activeLeads} active · ${leadStats?.won ?? 0} won`}
            icon={UsersRound} tone="green" loading={loading} href="/leads"
          />
          <StatCard
            label="Active Projects" value={String(activeProjects.length)}
            sub={`${activeProjects.length} project${activeProjects.length !== 1 ? 's' : ''} in progress`}
            icon={Folder} tone="amber" loading={loading} href="/projects"
          />
          <StatCard
            label="Revenue" value={fmtCompact(totalRevenuePaise)}
            sub={`Across ${allProjects.length} project${allProjects.length !== 1 ? 's' : ''}`}
            icon={IndianRupee} tone="green" loading={loading} href="/finance"
          />
          <StatCard
            label="Outstanding" value={fmtCompact(receivables.totalOutstandingPaise)}
            sub={overdueCount > 0 ? `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''}` : 'No overdue payments'}
            icon={Clock} tone="amber" loading={loading} href="/finance"
          />
        </div>

        {/* ── Pipeline | Follow-ups ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)] 2xl:gap-4">

          <section className="dash-card p-4 sm:p-5">
            <CardHeader title="Lead Pipeline" href="/leads" linkLabel="View all" />
            {loading ? (
              <div className="flex items-center gap-6">
                <div className="skeleton rounded-full" style={{ width: 124, height: 124, flexShrink: 0 }} />
                <div className="flex-1 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-5 rounded" />)}</div>
              </div>
            ) : totalLeads === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Target className="mb-3 h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
                <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No leads yet</p>
                <NewLeadDialog
                  onSuccess={(lead: Lead) => router.push(`/leads/${lead.id}`)}
                  triggerClassName="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm"
                  triggerLabel="+ Add Enquiry"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
                <PipelineRing
                  total={totalLeads}
                  segments={FUNNEL_STAGES.map((s, i) => ({ value: funnelCount(s.key), color: FUNNEL_COLORS[i] }))}
                />
                <div className="w-full min-w-0 flex-1">
                  {FUNNEL_STAGES.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2.5 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: FUNNEL_COLORS[i] }} />
                      <span className="flex-1 truncate text-[13.5px]" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                      <span className="text-[13.5px] font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{funnelCount(s.key)}</span>
                    </div>
                  ))}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--success-soft)' }}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${conversionPct}%`, background: 'var(--accent-base)' }} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                      Won <strong className="font-semibold" style={{ color: 'var(--text-heading)' }}>{leadStats?.won ?? 0}</strong>
                      <span className="mx-2">·</span>
                      Lost <strong className="font-semibold" style={{ color: 'var(--text-heading)' }}>{leadStats?.lost ?? 0}</strong>
                    </span>
                    <span className="text-[13.5px] font-semibold" style={{ color: 'var(--accent-text)' }}>{conversionPct}% converted</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="dash-card flex flex-col p-4 sm:p-5">
            <CardHeader title="Follow-ups" href="/leads" linkLabel="View leads" />
            {loading && !followUps ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
            ) : (
              <>
                <div>
                  {followUpRows.map(r => (
                    <Link key={r.label} href={r.href}
                      className="flex items-center gap-2.5 py-2 transition-opacity hover:opacity-80"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="flex-1 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                      <span className="text-[13.5px] font-medium tabular-nums" style={{ color: r.value > 0 ? r.color : 'var(--text-heading)' }}>{r.value}</span>
                    </Link>
                  ))}
                </div>
                {(followUps?.total ?? 0) === 0 ? (
                  <div className="mt-3 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5" style={{ background: 'var(--success-soft)' }}>
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--accent-base)' }} strokeWidth={1.8} />
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--accent-text)' }}>All follow-ups are complete</p>
                  </div>
                ) : followUpLeads.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {followUpLeads.slice(0, 3).map(l => {
                      const urgency = getFollowUpUrgency(l.followUpDate!);
                      const color = urgency === 'overdue' ? 'var(--danger)' : urgency === 'today' ? 'var(--warning)' : 'var(--info)';
                      return (
                        <Link key={l.id} href={`/leads/${l.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface-hover)]">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
                          <span className="flex-1 truncate text-[13.5px] font-medium" style={{ color: 'var(--text-heading)' }}>{l.contactName}</span>
                          <span className="flex-shrink-0 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(l.followUpDate!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ── Active projects ──────────────────────────────────────── */}
        <section className="dash-card p-4 sm:p-5">
          <CardHeader
            title={shownProjects.length === 1 ? 'Active project' : 'Active projects'}
            href="/projects" linkLabel="View all"
          />
          {loading ? (
            <div className="skeleton h-[66px] rounded-xl" />
          ) : shownProjects.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Folder className="mb-2 h-9 w-9" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active projects right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shownProjects.map(p => {
                const category = propertyCategory(p.propertyType ?? null);
                return (
                  <div key={p.id}
                    className="flex flex-col gap-3 rounded-xl border p-2 sm:flex-row sm:items-center sm:gap-4 sm:pr-4"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
                    <div className="relative h-32 w-full flex-shrink-0 overflow-hidden rounded-lg sm:h-[56px] sm:w-[136px]">
                      <Image src="/dashboard/hero-building.jpg" alt="" fill sizes="(min-width: 640px) 136px, 100vw" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 px-2 sm:px-0">
                      <Link href={`/projects/${p.id}`} className="block truncate text-[14.5px] font-semibold hover:underline" style={{ color: 'var(--text-heading)' }}>
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.7} />
                          <span className="truncate">{p.projectLocation || p.customerFullName || p.leadContactName || 'Location not set'}</span>
                        </span>
                        {category && (
                          <>
                            <span className="hidden h-4 w-px sm:inline-block" style={{ background: 'var(--border-strong)' }} />
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.7} />
                              {category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-2 pb-1 sm:contents">
                      <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium"
                        style={{ background: 'var(--success-soft)', color: 'var(--accent-text)' }}
                        title={STAGE_META[p.lifecycleStage]?.label}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                        In progress
                      </span>
                      <Link href={`/projects/${p.id}`}
                        className="inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-medium hover:underline sm:ml-5"
                        style={{ color: 'var(--accent-text)' }}>
                        View project<ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     EMPLOYEE VIEW
     ══════════════════════════════════════════════════════════════════════ */

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      // Collect GPS if available; proceed without it if denied or unavailable
      let gps: { latitude?: number; longitude?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch { /* geolocation denied or unavailable */ }

      const res = await fetch('/api/v1/me/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gps),
      });
      if (res.ok) {
        const json = await res.json();
        setTodayAttd(json.data);
      }
    } finally { setCheckingIn(false); }
  }

  async function handleCheckOut() {
    setCheckingOut(true);
    try {
      const res = await fetch('/api/v1/me/check-out', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setTodayAttd(json.data);
      }
    } finally { setCheckingOut(false); }
  }

  // Derived attendance stats
  const daysPresent  = monthAttd.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length;
  const daysAbsent   = monthAttd.filter(r => r.status === 'absent').length;
  const daysOnLeave  = monthAttd.filter(r => r.status === 'leave').length;
  const totalWorkMin = (todayAttd?.checkInAt && todayAttd?.checkOutAt)
    ? Math.round((new Date(todayAttd.checkOutAt).getTime() - new Date(todayAttd.checkInAt).getTime()) / 60_000)
    : 0;

  // Fixed "all caught up" — only true when genuinely nothing is pending
  const overdueFU  = followUps?.overdue  ?? 0;
  const dueTodayFU = followUps?.dueToday ?? 0;
  const hasAnyPending = myTasks.length > 0 || overdueFU > 0 || dueTodayFU > 0;
  const urgencySummary = [
    myTasks.length > 0 ? `${myTasks.length} task${myTasks.length !== 1 ? 's' : ''} pending` : '',
    overdueFU  > 0 ? `${overdueFU} overdue follow-up${overdueFU !== 1 ? 's' : ''}`            : '',
    dueTodayFU > 0 ? `${dueTodayFU} follow-up${dueTodayFU !== 1 ? 's' : ''} due today`       : '',
  ].filter(Boolean).join(' · ');

  const initials = firstName ? firstName[0].toUpperCase() : '?';

  return (
    <div className="space-y-5 animate-fade-in p-4 lg:p-8">

      {loadError && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Failed to load dashboard data.</span>
          <button type="button" onClick={load}
            className="text-xs font-bold hover:underline ml-4" style={{ color: 'var(--danger)' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── HEADER CARD ───────────────────────────────────────────────── */}
      <div className="rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(120deg, var(--hero-from) 0%, var(--hero-to) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-5 p-5 lg:p-6" style={{ position: 'relative', zIndex: 1 }}>

          {/* Left: Avatar + greeting + quick actions */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-white select-none"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-gold)' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.72)' }} suppressHydrationWarning>{todayLabel()}</span>
              </div>
              <h1 className="text-xl font-bold text-white leading-tight" suppressHydrationWarning>
                {greeting()}{firstName ? `, ${firstName}!` : '!'}
              </h1>
              <p className="text-sm mt-1 font-medium" style={{ color: hasAnyPending ? '#fca5a5' : '#6ee7b7' }}>
                {loading ? 'Loading…' : hasAnyPending ? urgencySummary : 'All caught up. Have a great day!'}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button type="button" onClick={() => setShowTask(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <Plus className="h-3.5 w-3.5" />New Task
                </button>
                <button type="button" onClick={() => setShowLeave(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <Plane className="h-3.5 w-3.5" />Apply Leave
                </button>
              </div>
            </div>
          </div>

          {/* Right: Attendance panel */}
          <div className="rounded-xl px-4 py-3 lg:min-w-[190px] self-start lg:self-stretch flex flex-col justify-center"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(52,211,153,0.20)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6ee7b7' }}>Attendance</p>
            {todayAttd?.checkInAt ? (
              <>
                <p className="text-base font-bold text-white leading-none" suppressHydrationWarning>
                  {fmtTime(todayAttd.checkInAt)}
                  <span className="text-sm font-normal mx-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>→</span>
                  {todayAttd.checkOutAt ? fmtTime(todayAttd.checkOutAt) : <span style={{ color: 'rgba(255,255,255,0.6)' }}>—</span>}
                </p>
                {totalWorkMin > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.72)' }}>{fmtDuration(totalWorkMin)}</p>
                )}
                <div className="mt-2">
                  {todayAttd.checkOutAt ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#6ee7b7' }} />
                      <span className="text-xs font-semibold" style={{ color: '#6ee7b7' }}>Day complete</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={checkingOut}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: '#6ee7b7', color: '#064e3b' }}>
                      {checkingOut ? 'Saving…' : 'Check Out'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Not checked in yet</p>
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: '#6ee7b7', color: '#064e3b' }}>
                  {checkingIn ? 'Saving…' : 'Check In'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Days Present */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--success-soft)' }}>
            <UserCheck className="h-5 w-5" style={{ color: 'var(--success-text)' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Days Present</p>
            {loading ? <div className="skeleton h-7 w-10 mt-1 rounded" /> : (
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{daysPresent}</p>
            )}
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>This month</p>
          </div>
        </div>

        {/* Days Absent */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--danger-soft)' }}>
            <AlertCircle className="h-5 w-5" style={{ color: 'var(--danger)' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Days Absent</p>
            {loading ? <div className="skeleton h-7 w-10 mt-1 rounded" /> : (
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{daysAbsent}</p>
            )}
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>This month</p>
          </div>
        </div>

        {/* On Leave */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--warning-soft)' }}>
            <Plane className="h-5 w-5" style={{ color: 'var(--warning-text)' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>On Leave</p>
            {loading ? <div className="skeleton h-7 w-10 mt-1 rounded" /> : (
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{daysOnLeave}</p>
            )}
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>This month</p>
          </div>
        </div>

        {/* Tasks Pending */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-soft)' }}>
            <ListTodo className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Tasks Pending</p>
            {loading ? <div className="skeleton h-7 w-10 mt-1 rounded" /> : (
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{myTasks.length}</p>
            )}
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Assigned to me</p>
          </div>
        </div>
      </div>

      {/* ── ROW 1: My Tasks + Site Visits ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyTasksWidget
          myTasks={myTasks}
          loading={loading}
          myUserId={myUserId}
          onTasksChange={setMyTasks}
        />
        <TodayVisitsWidget todayVisits={todayVisits} loading={loading} />
      </div>

      {/* ── ROW 2: My Projects + Follow-ups/Leave Requests ────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* My Projects */}
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
              <h3 className="section-title">My Projects</h3>
            </div>
            <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
              All →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
            </div>
          ) : myProjects.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
              No active projects assigned to you.
            </p>
          ) : (
            <div className="space-y-1.5">
              {myProjects.map(p => {
                const pct = STAGE_PROGRESS[p.lifecycleStage] ?? 0;
                const s   = STAGE_META[p.lifecycleStage] ?? { label: p.lifecycleStage, bg: 'var(--surface-muted)', text: 'var(--text-secondary)' };
                const client = p.customerFullName || p.leadContactName;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="block rounded-xl border p-2.5 transition-colors hover:border-[var(--accent-base)]"
                    style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-app)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                        style={{ backgroundColor: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </div>
                    {client && (
                      <p className="text-[11px] mb-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{client}</p>
                    )}
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-muted)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-base)' }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Follow-ups stacked over Leave Requests */}
        <div className="flex flex-col gap-4">

          {/* Follow-ups / Overdue Actions */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">Follow-ups &amp; Actions</h3>
              </div>
              <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                All leads →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 w-full rounded-lg" />)}
              </div>
            ) : !followUps || followUps.total === 0 ? (
              <p className="text-sm py-3 text-center" style={{ color: 'var(--text-secondary)' }}>No follow-ups scheduled.</p>
            ) : (
              <div className="space-y-2">
                {overdueFU > 0 && (
                  <Link href="/leads?followup=overdue"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:opacity-80"
                    style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                        {overdueFU} overdue follow-up{overdueFU !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--danger)' }} />
                  </Link>
                )}
                {dueTodayFU > 0 && (
                  <Link href="/leads?followup=today"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:opacity-80"
                    style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-text)' }}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>
                        {dueTodayFU} due today
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--warning-text)' }} />
                  </Link>
                )}
                {followUps.upcoming > 0 && (
                  <Link href="/leads?followup=upcoming"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:opacity-80"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {followUps.upcoming} upcoming
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Leave Requests */}
          <div className="premium-card p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">My Leave Requests</h3>
              </div>
              <Link href="/attendance" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                All →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
              </div>
            ) : myLeaves.length === 0 ? (
              <p className="text-sm py-3 text-center" style={{ color: 'var(--text-secondary)' }}>No leave requests yet.</p>
            ) : (
              <div className="space-y-2">
                {myLeaves.map(lr => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    pending:   { bg: 'var(--warning-soft)',  text: 'var(--warning-text)' },
                    approved:  { bg: 'var(--success-soft)',  text: 'var(--success-text)' },
                    rejected:  { bg: 'var(--danger-soft)',   text: 'var(--danger)' },
                    cancelled: { bg: 'var(--surface-muted)', text: 'var(--text-secondary)' },
                  };
                  const sc = statusColors[lr.status] ?? statusColors.cancelled;
                  return (
                    <div key={lr.id} className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-app)' }}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                          {LEAVE_TYPE_LABEL[lr.leaveType] ?? lr.leaveType}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {lr.fromDate} – {lr.toDate}
                        </p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ml-2"
                        style={{ background: sc.bg, color: sc.text }}>
                        {lr.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <NewTaskDialog
        open={showTask}
        onClose={() => setShowTask(false)}
        onCreated={() => {
          fetch('/api/v1/tasks?assigned=me&status=pending&limit=10').then(r => r.json())
            .then(j => { if (Array.isArray(j?.data)) setMyTasks(j.data); }).catch(() => {});
        }}
      />
      <ApplyLeaveDialog
        open={showLeave}
        onClose={() => setShowLeave(false)}
        onSubmitted={() => {
          fetch('/api/v1/attendance/leave-requests?mine=1').then(r => r.json())
            .then(j => { if (Array.isArray(j?.data)) setMyLeaves((j.data as LeaveRequest[]).slice(0, 4)); }).catch(() => {});
        }}
      />

    </div>
  );
}
