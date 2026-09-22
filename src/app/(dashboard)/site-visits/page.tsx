'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Calendar, CheckCircle2,
  Clock, XCircle, Loader2, AlertTriangle, UserX, Eye,
  MoreVertical, Trash2, Edit2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

interface SiteVisit {
  id: string;
  leadId: string;
  visitNumber: string | null;
  scheduledAt: string;
  completedAt: string | null;
  status: VisitStatus;
  purpose: string | null;
  locationJson: { address?: string } | null;
  photos: string[];
  notes: string | null;
  followUpNotes: string | null;
  designerId: string | null;
  designerName: string | null;
  leadName: string | null;
  leadPhone: string | null;
  customerName: string | null;
}

interface EmployeeOption {
  id: string;
  fullName: string | null;
}

interface Lead {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactCity: string | null;
  projectName: string | null;
  associatedProjectName: string | null;
  projectLocation: string | null;
  ownerId: string | null;
}

type VisitPurpose = 'initial' | 'measurement' | 'design_review' | 'site_inspection' | 'material_inspection' | 'final_inspection' | 'other';

const PURPOSE_LABELS: Record<VisitPurpose, string> = {
  initial:             'Initial Visit',
  measurement:         'Measurement',
  design_review:       'Design Review',
  site_inspection:     'Site Inspection',
  material_inspection: 'Material Inspection',
  final_inspection:    'Final Inspection',
  other:               'Other',
};

interface ScheduleForm {
  id?:         string;  // set when editing an existing visit
  leadId:      string;
  scheduledAt: string;
  address:     string;
  purpose:     VisitPurpose | '';
  designerId:  string;
  notes:       string;
}

const EMPTY_FORM: ScheduleForm = { leadId: '', scheduledAt: '', address: '', purpose: '', designerId: '', notes: '' };

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  no_show:     'No Show',
};

type StatusStyle = { bg: string; fg: string; border: string; strip: string; Icon: React.ElementType };

const STATUS_STYLES: Record<VisitStatus, StatusStyle> = {
  scheduled:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)',   border: 'rgba(37,99,235,0.22)',   strip: '#3B82F6', Icon: Clock        },
  in_progress: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)', border: 'rgba(194,65,12,0.22)',  strip: '#EA580C', Icon: Clock        },
  completed:   { bg: 'var(--success-soft)',      fg: 'var(--success-text)',  border: 'rgba(15,157,110,0.24)', strip: '#10B981', Icon: CheckCircle2 },
  cancelled:   { bg: '#FEE2E2',                 fg: '#B91C1C',              border: '#FCA5A5',               strip: '#9CA3AF', Icon: XCircle      },
  no_show:     { bg: '#FEF3C7',                 fg: '#92400E',              border: '#FDE68A',               strip: '#D97706', Icon: UserX        },
};

const STATUS_ORDER: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVisitNumber(v: SiteVisit): string {
  if (v.visitNumber) return v.visitNumber;
  return `SV-${v.id.slice(0, 6).toUpperCase()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
          : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
      }
    >
      {label}
      <span className="tnum text-[11px]" style={{ opacity: 0.8 }}>{count}</span>
    </button>
  );
}

// ─── Visit row with 3-dots menu ───────────────────────────────────────────────

function VisitRow({
  v,
  onView,
  onEdit,
  onDelete,
}: {
  v: SiteVisit;
  onView: (id: string) => void;
  onEdit: (v: SiteVisit) => void;
  onDelete: (v: SiteVisit) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.closest('[data-menu-root]')?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
    } else if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      setMenuOpen(true);
    }
  }

  const s = STATUS_STYLES[v.status] ?? STATUS_STYLES.scheduled;
  const clientLabel  = v.customerName ?? v.leadName ?? '—';
  const purposeLabel = v.purpose ? (PURPOSE_LABELS[v.purpose as VisitPurpose] ?? v.purpose) : '—';
  const isTerminal   = v.status === 'completed' || v.status === 'cancelled' || v.status === 'no_show';

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-subtle)', borderLeft: `3px solid ${s.strip}` }}
      className="transition-colors cursor-pointer"
      onClick={() => onView(v.id)}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Number + Date */}
      <td className="px-4 py-3">
        <p className="font-semibold tnum text-[12px]" style={{ color: 'var(--accent-base)' }}>
          {fmtVisitNumber(v)}
        </p>
        <p className="text-[11px] tnum mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {fmtDate(v.scheduledAt)}
        </p>
        <p className="text-[11px] tnum" style={{ color: 'var(--text-tertiary)' }}>
          {fmtTime(v.scheduledAt)}
        </p>
      </td>

      {/* Purpose */}
      <td className="px-4 py-3">
        <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{purposeLabel}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase border"
          style={{ background: s.bg, color: s.fg, borderColor: s.border }}
        >
          <s.Icon className="h-2.5 w-2.5" />
          {STATUS_LABELS[v.status]}
        </span>
      </td>

      {/* Assigned To */}
      <td className="px-4 py-3">
        <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
          {v.designerName ?? '—'}
        </span>
      </td>

      {/* Project / Client */}
      <td className="px-4 py-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>
          {clientLabel}
        </span>
        {v.leadPhone && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{v.leadPhone}</p>
        )}
      </td>

      {/* Observations */}
      <td className="px-4 py-3 max-w-[200px]">
        <span className="truncate block text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {v.followUpNotes ?? v.notes ?? '—'}
        </span>
      </td>

      {/* Actions — 3-dots menu */}
      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            title="View details"
            onClick={() => onView(v.id)}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
          >
            <Eye className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
          <div data-menu-root>
            <button
              ref={btnRef}
              type="button"
              title="More actions"
              onClick={toggleMenu}
              className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
            >
              <MoreVertical className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
            {menuOpen && menuPos && (
              <div
                className="w-36 rounded-xl shadow-xl overflow-hidden"
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  right: menuPos.right,
                  zIndex: 9999,
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {!isTerminal && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onEdit(v); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--surface-muted)] transition-colors"
                    style={{ color: 'var(--text-heading)' }}
                  >
                    <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--accent-base)' }} />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(v); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--surface-muted)] transition-colors"
                  style={{ color: '#DC2626' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteVisitsPage() {
  const router = useRouter();

  const [visits,    setVisits]    = useState<SiteVisit[]>([]);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<VisitStatus | 'all'>('all');

  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [form,        setForm]        = useState<ScheduleForm>(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; visitId: string; label: string }>({ open: false, visitId: '', label: '' });
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, lRes, eRes] = await Promise.all([
        fetch('/api/v1/site-visits').then(r => r.json()),
        fetch('/api/v1/leads').then(r => r.json()),
        fetch('/api/v1/employees').then(r => r.json()),
      ]);
      setVisits(Array.isArray(vRes.data)   ? (vRes.data   as SiteVisit[])      : []);
      setLeads(Array.isArray(lRes.data)    ? (lRes.data   as Lead[])           : []);
      setEmployees(Array.isArray(eRes.data) ? (eRes.data  as EmployeeOption[]) : []);
    } catch {
      setError('Failed to load — please retry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter(v => {
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (!q) return true;
      return (
        (v.leadName    ?? '').toLowerCase().includes(q) ||
        (v.customerName ?? '').toLowerCase().includes(q) ||
        (v.designerName ?? '').toLowerCase().includes(q) ||
        (v.visitNumber  ?? '').toLowerCase().includes(q) ||
        (v.notes        ?? '').toLowerCase().includes(q) ||
        (v.locationJson?.address ?? '').toLowerCase().includes(q)
      );
    });
  }, [visits, filterStatus, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visits.length };
    STATUS_ORDER.forEach(s => { c[s] = visits.filter(v => v.status === s).length; });
    return c;
  }, [visits]);

  async function handleSchedule() {
    if (!form.id && !form.leadId) { setSubmitError('Select a lead.'); return; }
    if (!form.scheduledAt)        { setSubmitError('Choose a date and time.'); return; }
    if (!form.address.trim())     { setSubmitError('Enter an address.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isEdit = Boolean(form.id);
      const url    = isEdit ? `/api/v1/site-visits/${form.id}` : '/api/v1/site-visits';
      const method = isEdit ? 'PATCH' : 'POST';
      const body   = isEdit
        ? {
            scheduledAt: new Date(form.scheduledAt).toISOString(),
            address:     form.address.trim(),
            purpose:     form.purpose || undefined,
            designerId:  form.designerId || undefined,
            notes:       form.notes.trim() || undefined,
          }
        : {
            leadId:      form.leadId,
            scheduledAt: new Date(form.scheduledAt).toISOString(),
            address:     form.address.trim(),
            purpose:     form.purpose || undefined,
            designerId:  form.designerId || undefined,
            notes:       form.notes.trim() || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        setSubmitError(typeof b.error === 'string' ? b.error : isEdit ? 'Failed to update' : 'Failed to schedule');
        return;
      }
      const resBody = (await res.json()) as { data?: { id?: string } };
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      // Navigate to the new visit's detail page; for edits refresh the list
      if (!isEdit && resBody.data?.id) {
        router.push(`/site-visits/${resBody.data.id}`);
        return;
      }
      void fetch('/api/v1/site-visits')
        .then(r => r.json())
        .then((vRes: { data?: SiteVisit[] }) => {
          if (Array.isArray(vRes.data)) setVisits(vRes.data);
        });
    } catch {
      setSubmitError('Network error — try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(visitId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/site-visits/${visitId}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        alert(typeof b.error === 'string' ? b.error : 'Failed to delete');
        return;
      }
      setVisits(prev => prev.filter(v => v.id !== visitId));
      setDeleteConfirm({ open: false, visitId: '', label: '' });
    } catch {
      alert('Network error — try again');
    } finally {
      setDeleting(false);
    }
  }

  function openEditDialog(v: SiteVisit) {
    // Format scheduledAt for datetime-local input (YYYY-MM-DDTHH:MM)
    const dt = new Date(v.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({
      id:          v.id,
      leadId:      v.leadId,
      scheduledAt: local,
      address:     v.locationJson?.address ?? '',
      purpose:     (v.purpose as VisitPurpose) ?? '',
      designerId:  v.designerId ?? '',
      notes:       v.notes ?? '',
    });
    setSubmitError(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="page-title">Site Visits</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${visits.length} ${visits.length === 1 ? 'visit' : 'visits'} total`}
          </p>
        </div>
        <button
          onClick={() => { setSubmitError(null); setDialogOpen(true); }}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Schedule visit
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search visit, lead, designer…"
            className="studio-input w-full h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label="All" count={counts.all} />
          {STATUS_ORDER.map(s => counts[s] > 0 ? (
            <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} label={STATUS_LABELS[s]} count={counts[s]} />
          ) : null)}
        </div>
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            <button onClick={() => void loadData()} className="text-xs underline" style={{ color: 'var(--accent-base)' }}>Retry</button>
          </div>
        )}
        {!loading && !error && visits.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
              <Calendar className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No site visits yet</p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Schedule your first visit using the button above.</p>
          </div>
        )}
        {!loading && !error && visits.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No visits match your filters</p>
            <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className="text-[12px] underline" style={{ color: 'var(--accent-base)' }}>Clear filters</button>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {['Number', 'Purpose', 'Status', 'Assigned To', 'Project / Client', 'Observations', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <VisitRow
                    key={v.id}
                    v={v}
                    onView={id => router.push(`/site-visits/${id}`)}
                    onEdit={openEditDialog}
                    onDelete={visit => setDeleteConfirm({ open: true, visitId: visit.id, label: fmtVisitNumber(visit) })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule / Edit visit dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setForm(EMPTY_FORM); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit site visit' : 'Schedule site visit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {!form.id && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Lead *</label>
                <select
                  value={form.leadId}
                  onChange={e => {
                    const selectedLead = leads.find(l => l.id === e.target.value) ?? null;
                    setForm(f => ({
                      ...f,
                      leadId:     e.target.value,
                      address:    selectedLead?.projectLocation ?? selectedLead?.contactCity ?? f.address,
                      designerId: selectedLead?.ownerId ?? f.designerId,
                    }));
                  }}
                  className="studio-input h-9 w-full"
                >
                  <option value="">Choose a lead…</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {(l.associatedProjectName ?? l.projectName) || `${l.contactName || l.id.slice(0, 8)}${l.contactCity ? ` — ${l.contactCity}` : ''}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Date &amp; Time *</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="studio-input h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Address *</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Site address"
                className="studio-input h-9 w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Purpose</label>
                <select
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value as VisitPurpose | '' }))}
                  className="studio-input h-9 w-full"
                >
                  <option value="">Select…</option>
                  {(Object.keys(PURPOSE_LABELS) as VisitPurpose[]).map(p => (
                    <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Assigned To</label>
                <select
                  value={form.designerId}
                  onChange={e => setForm(f => ({ ...f, designerId: e.target.value }))}
                  className="studio-input h-9 w-full"
                >
                  <option value="">Unassigned</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName ?? emp.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                What to check on site <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Items to inspect, access instructions, client requests…"
                rows={2}
                className="studio-input w-full py-2 resize-none"
              />
            </div>
            {submitError && <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>{submitError}</p>}
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSchedule}
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50"
            >
              {form.id ? <Edit2 className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />}
              {submitting ? (form.id ? 'Saving…' : 'Scheduling…') : (form.id ? 'Save changes' : 'Schedule visit')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={open => { if (!open) setDeleteConfirm({ open: false, visitId: '', label: '' }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete site visit?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] py-2" style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-heading)' }}>{deleteConfirm.label}</strong> will be permanently deleted. This cannot be undone.
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteConfirm({ open: false, visitId: '', label: '' })}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDelete(deleteConfirm.visitId)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium disabled:opacity-50"
              style={{ background: '#DC2626', color: '#fff' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
