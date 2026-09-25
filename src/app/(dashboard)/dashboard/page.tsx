'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/providers/user-provider';
import Link from 'next/link';
import {
  Users, FolderKanban, IndianRupee,
  Target, CheckCircle2, AlertCircle, Clock, ChevronRight,
  Calendar, MapPin, Home,
  CheckSquare, Truck, Activity, Bell,
  Plus, UserCheck, Plane, ListTodo, Loader2, ArrowRight,
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
interface PendingVendorDelivery {
  poNumber: string; vendorName: string | null; vendorContactName: string | null; expectedDeliveryAt: string | null;
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
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
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
function getFollowUpUrgency(dateStr: string): 'overdue' | 'today' | 'upcoming' {
  if (isToday(dateStr)) return 'today';
  if (new Date(dateStr) < new Date()) return 'overdue';
  return 'upcoming';
}
function stageLabel(stage: string): string {
  const MAP: Record<string, string> = {
    new: 'New', contacted: 'Contacted', qualified: 'Qualified',
    site_visit: 'Site Visit', measurement: 'Measurement', measured: 'Measured',
    booked: 'Booked', quotation: 'Quotation', negotiation: 'Negotiation',
    won: 'Won', lost: 'Lost',
  };
  return MAP[stage] ?? stage;
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

/* ── Donut Chart ────────────────────────────────────────────────────────── */
function DonutChart({ segments, size = 140 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return (
    <svg viewBox="0 0 140 140" width={size} height={size}>
      <circle cx={70} cy={70} r={54} fill="none" stroke="var(--border-subtle)" strokeWidth={16} />
      <text x={70} y={68} textAnchor="middle" fill="var(--text-tertiary)" fontSize={11}>No data</text>
    </svg>
  );
  const CX = 70, CY = 70, R_OUT = 54, R_IN = 36;
  let cursor = -90;
  const paths: { d: string; color: string }[] = [];
  segments.forEach(seg => {
    if (seg.value === 0) return;
    const angle = (seg.value / total) * 360;
    const start = cursor;
    const end   = cursor + angle - 0.5;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sx  = CX + R_OUT * Math.cos(toRad(start)), sy  = CY + R_OUT * Math.sin(toRad(start));
    const ex  = CX + R_OUT * Math.cos(toRad(end)),   ey  = CY + R_OUT * Math.sin(toRad(end));
    const sx2 = CX + R_IN  * Math.cos(toRad(end)),   sy2 = CY + R_IN  * Math.sin(toRad(end));
    const ex2 = CX + R_IN  * Math.cos(toRad(start)), ey2 = CY + R_IN  * Math.sin(toRad(start));
    const large = angle > 180 ? 1 : 0;
    paths.push({ color: seg.color, d: `M${sx},${sy} A${R_OUT},${R_OUT} 0 ${large} 1 ${ex},${ey} L${sx2},${sy2} A${R_IN},${R_IN} 0 ${large} 0 ${ex2},${ey2} Z` });
    cursor += angle;
  });
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} style={{ flexShrink: 0 }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.88} />
      ))}
      <text x={CX} y={CY - 7} textAnchor="middle" fill="var(--text-heading)" fontSize={22} fontWeight="bold">{total}</text>
      <text x={CX} y={CY + 11} textAnchor="middle" fill="var(--text-secondary)" fontSize={9.5}>total leads</text>
    </svg>
  );
}

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
  { key: 'lost',       label: 'Lost'        },
];
const FUNNEL_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];

const KPI_ACCENTS = {
  purple: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  blue:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)'   },
  orange: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)' },
  green:  { bg: 'var(--accent-green-bg)',  fg: 'var(--accent-green)'  },
} as const;

/* ── Sparkline ──────────────────────────────────────────────────────────── */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 52, H = 18;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={W} height={H} style={{ flexShrink: 0, overflow: 'visible' }}>
      <polyline fill="none" stroke={isUp ? 'var(--success)' : 'var(--danger)'}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, accent = 'purple', loading, sparkline, href,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: keyof typeof KPI_ACCENTS; loading: boolean; sparkline?: number[]; href?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const inner = (
    <div
      className="premium-card p-5 group cursor-default"
      style={{ transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="stat-badge transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: a.bg, width: '2.5rem', height: '2.5rem' }}>
          <Icon className="h-4 w-4" style={{ color: a.fg }} strokeWidth={2} />
        </div>
        {sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} />}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {loading
        ? <div className="skeleton h-8 w-24 mb-2" />
        : <p className="text-[28px] font-bold leading-none mb-2" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>{value}</p>
      }
      <div className="h-[2px] w-8 rounded-full mb-2" style={{ background: a.fg, opacity: 0.6 }} />
      {loading
        ? <div className="skeleton h-3 w-20" />
        : sub && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
      }
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

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

/* ── Page ───────────────────────────────────────────────────────────────── */
interface FollowUpCounts { overdue: number; dueToday: number; upcoming: number; total: number; }

export default function DashboardPage() {
  const router = useRouter();
  const { isAdmin: contextAdmin, id: contextId, fullName: contextFullName, roleLoaded } = useUser();
  const [firstName,  setFirstName]  = useState('');
  const [isAdmin,    setIsAdmin]    = useState(false);

  // Admin state
  const [leadStats,    setLeadStats]    = useState<LeadStats | null>(null);
  const [leadBudgets,  setLeadBudgets]  = useState<Record<string, number>>({});
  const [allProjects,  setAllProjects]  = useState<Project[]>([]);
  const [receivables,  setReceivables]  = useState<ReceivablesData>({
    items: [], totalOutstandingPaise: 0, totalOverduePaise: 0,
  });
  const [trendData,         setTrendData]         = useState<number[]>([]);
  const [totalRevenuePaise, setTotalRevenuePaise] = useState(0);
  const [upcomingPOs,       setUpcomingPOs]       = useState<PendingVendorDelivery[]>([]);
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
        const [ls, ps, rs, ao, pos, rl] = await Promise.all([
          fetch('/api/v1/leads/stats').then(r => r.json()),
          fetch('/api/v1/projects').then(r => r.json()),
          fetch('/api/v1/accounts/receivables').then(r => r.json()),
          fetch('/api/v1/analytics/overview').then(r => r.json()),
          fetch('/api/v1/purchase-orders?limit=20').then(r => r.json()),
          fetch('/api/v1/leads?limit=15').then(r => r.json()),
        ]);
        if (ls?.data?.counts) setLeadStats(ls.data.counts);
        if (ls?.data?.budgets) setLeadBudgets(ls.data.budgets);
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
        if (Array.isArray(ao?.data?.trend30d)) {
          setTrendData(ao.data.trend30d.map((d: { amountPaise: number }) => d.amountPaise));
        }
        if (Array.isArray(pos?.data)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const soon = new Date(today.getTime() + 7 * 86400_000);
          const PO_EXCLUDE = new Set(['draft', 'complete', 'cancelled']);
          setUpcomingPOs(pos.data
            .filter((po: { expectedDeliveryAt: string | null; status: string }) =>
              !PO_EXCLUDE.has(po.status) && po.expectedDeliveryAt && new Date(po.expectedDeliveryAt) <= soon)
            .slice(0, 4));
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

  // Activity items: today's visits + overdue receivables
  interface ActivityItem {
    key: string; Icon: React.ElementType; iconBg: string; iconFg: string;
    title: string; sub: string; badge: string; badgeBg: string; badgeFg: string;
    href: string;
  }
  const activityItems: ActivityItem[] = [
    ...receivables.items
      .filter(r => r.paymentStatus === 'overdue')
      .slice(0, 3)
      .map(r => ({
        key: r.id,
        Icon: AlertCircle,
        iconBg: 'var(--danger-soft)',
        iconFg: 'var(--danger)',
        title: r.projectName,
        sub: `${r.label} · ${fmt(r.amountPaise)}`,
        badge: 'Overdue',
        badgeBg: 'var(--danger-soft)',
        badgeFg: 'var(--danger)',
        href: '/finance',
      })),
    ...todayVisits.slice(0, 3).map(v => {
      const time = new Date(v.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const isDone = !!v.completedAt;
      return {
        key: v.id,
        Icon: Home,
        iconBg: isDone ? 'var(--success-soft)' : 'var(--accent-soft)',
        iconFg: isDone ? 'var(--success-text)' : 'var(--accent-base)',
        title: v.locationJson?.address ?? 'Site visit',
        sub: `Scheduled · ${time}`,
        badge: isDone ? 'Done' : 'Today',
        badgeBg: isDone ? 'var(--success-soft)' : 'var(--accent-soft)',
        badgeFg: isDone ? 'var(--success-text)' : 'var(--accent-text)',
        href: v.leadId ? `/leads/${v.leadId}` : '/site-visits',
      };
    }),
  ];

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

        {/* Page heading */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}>
              Studio at a glance
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold leading-none"
              style={{ color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
              Dashboard
            </h1>
          </div>
          <NewLeadDialog
            onSuccess={(lead: Lead) => router.push(`/leads/${lead.id}`)}
            triggerClassName="btn-primary flex items-center gap-2 flex-shrink-0 px-3.5 py-2 text-sm rounded-xl"
            triggerLabel="+ New Lead"
          />
        </div>

        {/* Hero banner */}
        <div className="rounded-2xl relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #131545 0%, #1e2268 55%, #252a7a 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Content */}
          <div className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
              <span className="text-xs font-medium" style={{ color: '#cbd5e1' }} suppressHydrationWarning>{todayLabel()}</span>
            </div>
            <p className="text-sm mb-1" style={{ color: '#94a3b8' }} suppressHydrationWarning>
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </p>
            {loading ? (
              <div className="h-7 w-72 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
            ) : (
              <h2 className="text-2xl font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
                {overdueCount > 0
                  ? `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''} to follow up.`
                  : activeLeads > 0
                    ? `${activeLeads} active lead${activeLeads !== 1 ? 's' : ''} in your pipeline.`
                    : 'All caught up. Great work!'}
              </h2>
            )}
            {!loading && (
              <div className="flex flex-wrap gap-2">
                {activeLeads > 0 && (
                  <Link href="/leads"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <Users className="h-3 w-3" />{activeLeads} active lead{activeLeads !== 1 ? 's' : ''}
                  </Link>
                )}
                {overdueCount > 0 && (
                  <Link href="/finance"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }}>
                    <AlertCircle className="h-3 w-3" />{overdueCount} overdue
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Total Leads"
            value={String(totalLeads)}
            sub={`${activeLeads} active · ${leadStats?.won ?? 0} won`}
            icon={Users} accent="purple" loading={loading} href="/leads"
          />
          <KpiCard
            label="Active Projects"
            value={String(activeProjects.length)}
            sub={`${allProjects.length} total`}
            icon={FolderKanban} accent="orange" loading={loading} href="/projects"
          />
          <KpiCard
            label="Revenue"
            value={fmtCompact(totalRevenuePaise)}
            sub={`${allProjects.length} project${allProjects.length !== 1 ? 's' : ''}`}
            icon={IndianRupee} accent="blue" loading={loading} sparkline={trendData} href="/projects"
          />
          <KpiCard
            label="Outstanding"
            value={fmtCompact(receivables.totalOutstandingPaise)}
            sub={overdueCount > 0 ? `${overdueCount} overdue` : 'No overdue'}
            icon={AlertCircle} accent="green" loading={loading} href="/finance"
          />
        </div>

        {/* Row A: Lead Pipeline (3/5) | Today's Follow-ups (2/5) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

          {/* Lead Pipeline */}
          <div className="lg:col-span-3 premium-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="section-title">Lead Pipeline</h3>
              <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-6">
                <div className="skeleton rounded-full" style={{ width: 120, height: 120, flexShrink: 0 }} />
                <div className="flex-1 space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-5 rounded" />)}
                </div>
              </div>
            ) : !leadStats || totalLeads === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Target className="h-10 w-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>No leads yet</p>
                <NewLeadDialog
                  onSuccess={(lead: Lead) => router.push(`/leads/${lead.id}`)}
                  triggerClassName="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg"
                  triggerLabel="+ Add Enquiry"
                />
              </div>
            ) : (
              <div className="flex items-start gap-5">
                <DonutChart segments={FUNNEL_STAGES.map((s, i) => ({
                  value: funnelCount(s.key),
                  color: FUNNEL_COLORS[i],
                  label: s.label,
                }))} size={120} />
                <div className="flex-1 min-w-0 space-y-2.5">
                  {FUNNEL_STAGES.map((s, i) => {
                    const count = funnelCount(s.key);
                    const pct   = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                    return (
                      <div key={s.key}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: FUNNEL_COLORS[i] }} />
                          <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                          <span className="text-[12px] font-bold tabular-nums w-5 text-right" style={{ color: 'var(--text-heading)' }}>{count}</span>
                          <span className="text-[11px] w-7 text-right" style={{ color: 'var(--text-tertiary)' }}>{pct}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: FUNNEL_COLORS[i] }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      Won <strong style={{ color: 'var(--text-heading)' }}>{leadStats.won}</strong>
                      &nbsp;· Lost <strong style={{ color: 'var(--text-heading)' }}>{leadStats.lost ?? 0}</strong>
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--accent-base)' }}>{conversionPct}% converted</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Today's Follow-ups */}
          <div className="lg:col-span-2 premium-card p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">Follow-ups</h3>
                {(followUps?.dueToday ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
                    {followUps!.dueToday}
                  </span>
                )}
              </div>
              <Link href="/leads" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                All leads →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2 flex-1">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
              </div>
            ) : followUpLeads.length === 0 ? (
              <div className="flex-1 flex flex-col">
                {/* Count summary rows */}
                <div className="flex-1">
                  {[
                    { label: 'Overdue',   value: followUps?.overdue  ?? 0, color: 'var(--danger)',       href: '/leads?followup=overdue'  },
                    { label: 'Due today', value: followUps?.dueToday ?? 0, color: 'var(--warning)',      href: '/leads?followup=today'    },
                    { label: 'Upcoming',  value: followUps?.upcoming  ?? 0, color: 'var(--accent-base)', href: '/leads?followup=upcoming' },
                  ].map((r, idx) => (
                    <Link key={r.label} href={r.href}
                      className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity"
                      style={idx > 0 ? { borderTop: '1px solid var(--border-subtle)' } : {}}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: r.value > 0 ? r.color : 'var(--text-tertiary)' }}>
                        {r.value}
                      </span>
                    </Link>
                  ))}
                </div>
                {(followUps?.total ?? 0) === 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5"
                    style={{ background: 'var(--success-soft)' }}>
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--success-text)' }}>All follow-ups done!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="space-y-1.5 flex-1">
                  {followUpLeads.map(l => {
                    const urgency = getFollowUpUrgency(l.followUpDate!);
                    const urgencyConfig = {
                      overdue:  { color: 'var(--danger)',       bg: 'var(--danger-soft)',  label: 'Overdue' },
                      today:    { color: 'var(--warning)',      bg: 'var(--warning-soft)', label: 'Today'   },
                      upcoming: { color: 'var(--accent-base)',  bg: 'var(--accent-soft)',  label: 'Soon'    },
                    }[urgency];
                    return (
                      <Link key={l.id} href={`/leads/${l.id}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--surface-muted)]">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: urgencyConfig.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                            {l.contactName}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {stageLabel(l.stage)}
                            {l.followUpDate && (
                              <span className="ml-1.5">
                                · {new Date(l.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0"
                          style={{ background: urgencyConfig.bg, color: urgencyConfig.color }}>
                          {urgencyConfig.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {/* Summary pills */}
                <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {(followUps?.overdue ?? 0) > 0 && (
                    <Link href="/leads?followup=overdue"
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                      {followUps!.overdue} overdue
                    </Link>
                  )}
                  {(followUps?.dueToday ?? 0) > 0 && (
                    <Link href="/leads?followup=today"
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
                      {followUps!.dueToday} today
                    </Link>
                  )}
                  {(followUps?.upcoming ?? 0) > 0 && (
                    <Link href="/leads?followup=upcoming"
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                      {followUps!.upcoming} upcoming
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row B: Recent Projects (3/5) | Activity Feed (2/5) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

          {/* Recent Projects table */}
          <div className="lg:col-span-3 premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">Recent Projects</h3>
              </div>
              <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded" />)}
              </div>
            ) : allProjects.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FolderKanban className="h-10 w-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[420px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Project', 'Client', 'Stage', 'Value', 'Deadline'].map((h, i) => (
                        <th key={h}
                          className={`pb-2.5 text-[10px] font-bold uppercase tracking-wider ${i >= 3 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--text-tertiary)', paddingLeft: i === 0 ? 4 : 8, paddingRight: 8 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allProjects.slice(0, 6).map((p, rowIdx) => {
                      const s = STAGE_META[p.lifecycleStage] ?? { label: p.lifecycleStage, bg: 'var(--surface-muted)', text: 'var(--text-secondary)' };
                      const client = p.customerFullName || p.leadContactName;
                      return (
                        <tr key={p.id}
                          className="group"
                          style={{ borderBottom: rowIdx < Math.min(allProjects.length, 6) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td className="py-3 pr-2 pl-1">
                            <Link href={`/projects/${p.id}`}
                              className="text-[13px] font-semibold truncate max-w-[160px] block hover:underline"
                              style={{ color: 'var(--text-heading)', maxWidth: 160 }}>
                              {p.name}
                            </Link>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-[12px] truncate block" style={{ color: 'var(--text-secondary)', maxWidth: 100 }}>
                              {client ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                              style={{ backgroundColor: s.bg, color: s.text }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-heading)' }}>
                              {p.totalContractPaise ? fmtCompact(p.totalContractPaise) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </span>
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                              {p.expectedEndAt
                                ? new Date(p.expectedEndAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2 premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
                <h3 className="section-title">Today&apos;s Activity</h3>
              </div>
              <Link href="/site-visits" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent-base)' }}>
                Visits →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
              </div>
            ) : activityItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: 'var(--success-text)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>All clear for today</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>No overdue payments or site visits</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activityItems.slice(0, 6).map(item => (
                  <Link key={item.key} href={item.href}
                    className="flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-[var(--surface-muted)]">
                    <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: item.iconBg }}>
                      <item.Icon className="h-3.5 w-3.5" style={{ color: item.iconFg }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{item.title}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{item.sub}</p>
                    </div>
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap"
                      style={{ background: item.badgeBg, color: item.badgeFg }}>
                      {item.badge}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Vendor deliveries appended if any */}
            {!loading && upcomingPOs.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Deliveries due
                  </p>
                </div>
                <div className="space-y-1.5">
                  {upcomingPOs.map((po, i) => (
                    <Link key={i} href="/purchase-orders"
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ background: 'var(--surface-muted)' }}>
                      <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                        {po.vendorName ?? po.vendorContactName ?? 'Vendor'}
                      </span>
                      {po.expectedDeliveryAt && (
                        <span className="text-[11px] font-semibold ml-2 flex-shrink-0" style={{ color: 'var(--warning-text)' }}>
                          {new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

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
      <div className="rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #131545 0%, #1e2268 55%, #252a7a 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-5 p-5 lg:p-6" style={{ position: 'relative', zIndex: 1 }}>

          {/* Left: Avatar + greeting + quick actions */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-white select-none"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
                <span className="text-xs font-medium" style={{ color: '#94a3b8' }} suppressHydrationWarning>{todayLabel()}</span>
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
                  <span className="text-sm font-normal mx-1.5" style={{ color: '#64748b' }}>→</span>
                  {todayAttd.checkOutAt ? fmtTime(todayAttd.checkOutAt) : <span style={{ color: '#64748b' }}>—</span>}
                </p>
                {totalWorkMin > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{fmtDuration(totalWorkMin)}</p>
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
                <p className="text-xs mb-2" style={{ color: '#64748b' }}>Not checked in yet</p>
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
            style={{ background: '#ede9fe' }}>
            <ListTodo className="h-5 w-5" style={{ color: '#7c3aed' }} />
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
