'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Plus, FolderKanban, ChevronDown, AlertTriangle, MapPin, User, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Project } from '@/types/quotes';
import { Lead } from '@/types/leads';
import { formatRupees } from '@/lib/utils';
import { STAGE_STYLE_MAP, LIFECYCLE_STAGE_ORDER as STAGE_ORDER } from '@/types/deliverables';
import type { ProjectStage } from '@/types/deliverables';

type LifecycleStage = ProjectStage;

interface ProjectRow extends Project {
  customerFullName?:  string | null;
  leadContactName?:   string | null;
  projectLocation?:   string | null;
  collectedPaise:     number;
  nextMilestoneLabel: string | null;
}

function daysDiff(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86_400_000);
}

interface NewProjectForm {
  noLead: boolean;
  leadId: string;
  leadLabel: string;
  clientName: string;
  clientPhone: string;
  name: string;
  totalContractRupees: string;
}

const INITIAL_FORM: NewProjectForm = {
  noLead: false, leadId: '', leadLabel: '', clientName: '', clientPhone: '', name: '', totalContractRupees: '',
};

// ─── Lead Search Combobox ─────────────────────────────────────────────────────

function LeadSelector({
  value,
  onChange,
}: {
  value: { id: string; label: string };
  onChange: (id: string, label: string) => void;
}) {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const rootRef               = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/leads')
      .then(r => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        setLeads(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return l.contactName.toLowerCase().includes(q) || l.contactPhone.includes(q);
  });

  function select(lead: Lead) {
    onChange(lead.id, `${lead.contactName} · ${lead.contactPhone}`);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="studio-input flex items-center justify-between gap-2 cursor-pointer h-9 w-full text-[13px]"
      >
        {value.id ? (
          <span style={{ color: 'var(--text-primary)' }} className="truncate">{value.label}</span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Search and select a lead…</span>
        )}
        <ChevronDown
          className="h-3.5 w-3.5 flex-shrink-0 transition-transform"
          style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 overflow-hidden rounded-lg"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 24px rgba(22,20,15,0.08)' }}
        >
          <div className="p-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or phone…"
                className="studio-input w-full h-8 text-[13px]"
                style={{ paddingLeft: '2rem' }}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Loading leads…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {search ? 'No leads match your search.' : 'No leads found.'}
              </div>
            ) : (
              filtered.map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full text-left px-3 py-2 transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => select(lead)}
                >
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{lead.contactName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] tnum" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</span>
                    {lead.budgetBand && (
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>· {lead.budgetBand}</span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                      {lead.stage.replace(/_/g, ' ')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: ProjectRow; onClick: () => void }) {
  const stage = STAGE_STYLE_MAP[project.lifecycleStage];
  const clientName = project.customerFullName ?? project.leadContactName;
  const isComplete = project.lifecycleStage === 'complete';
  const overdueDays = !isComplete && project.expectedEndAt
    ? daysDiff(project.expectedEndAt)
    : null;
  const isOverdue = overdueDays !== null && overdueDays > 0;

  let dateLabel: { text: string; color: string } | null = null;
  if (!isComplete) {
    if (project.expectedEndAt) {
      if (isOverdue) {
        dateLabel = { text: `Overdue by ${overdueDays}d`, color: 'var(--danger, #DC2626)' };
      } else {
        const due = new Date(project.expectedEndAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dateLabel = { text: `Due ${due}`, color: 'var(--text-secondary)' };
      }
    } else if (project.startedAt) {
      const started = new Date(project.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
      dateLabel = { text: `Started ${started}`, color: 'var(--text-tertiary)' };
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl text-left overflow-hidden"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${stage.border}`,
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,20,15,0.07)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(22,20,15,0.15)';
        (e.currentTarget as HTMLElement).style.borderLeftColor = stage.border;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLElement).style.borderLeftColor = stage.border;
      }}
    >
      <div className="p-4">
        {/* Stage badge + date row */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: stage.bg, color: stage.fg }}
          >
            {stage.label}
          </span>
          {dateLabel && (
            <span className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0" style={{ color: dateLabel.color }}>
              {isOverdue && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
              {!isOverdue && dateLabel.text.startsWith('Due') && <Clock className="h-3 w-3 flex-shrink-0" />}
              {dateLabel.text}
            </span>
          )}
        </div>

        {/* Project name */}
        <p className="text-[14px] font-semibold leading-tight truncate"
           style={{ color: 'var(--text-heading)' }}>
          {project.name}
        </p>

        {/* Client + location */}
        <div className="mt-1 space-y-0.5">
          {clientName && (
            <p className="flex items-center gap-1 text-[12px] truncate"
               style={{ color: 'var(--text-secondary)' }}>
              <User className="h-3 w-3 flex-shrink-0" />
              {clientName}
            </p>
          )}
          {project.projectLocation && (
            <p className="flex items-center gap-1 text-[12px] truncate"
               style={{ color: 'var(--text-secondary)' }}>
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {project.projectLocation}
            </p>
          )}
        </div>

      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects]     = useState<ProjectRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch]           = useState('');
  const [filterStage, setFilterStage] = useState<LifecycleStage | 'all'>(() => {
    const s = searchParams.get('lifecycleStage');
    return STAGE_ORDER.includes(s as LifecycleStage) ? (s as LifecycleStage) : 'all';
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<NewProjectForm>(INITIAL_FORM);
  const [creating, setCreating]     = useState(false);
  const [errors, setErrors]         = useState<Partial<Record<keyof NewProjectForm, string>>>({});
  const [apiError, setApiError]     = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/v1/projects');
      const json = await res.json() as { data: ProjectRow[] };
      setProjects(json.data ?? []);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadProjects(); }, [loadProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      if (filterStage !== 'all' && p.lifecycleStage !== filterStage) return false;
      if (!q) return true;
      const clientName = (p.customerFullName ?? p.leadContactName ?? '').toLowerCase();
      return p.name.toLowerCase().includes(q) || clientName.includes(q);
    });
  }, [projects, search, filterStage]);

  function openDialog() {
    setForm(INITIAL_FORM);
    setErrors({});
    setApiError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof NewProjectForm>(key: K, value: NewProjectForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  const handleLeadSelect = useCallback((id: string, label: string) => {
    setForm(prev => ({ ...prev, leadId: id, leadLabel: label }));
    setErrors(prev => ({ ...prev, leadId: undefined }));
  }, []);

  async function handleCreate() {
    const newErrors: Partial<Record<keyof NewProjectForm, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Project name is required.';
    if (form.noLead) {
      if (!form.clientName.trim()) newErrors.clientName = 'Client name is required.';
      if (!form.clientPhone.trim()) newErrors.clientPhone = 'Client phone is required.';
    } else {
      if (!form.leadId) newErrors.leadId = 'Please select a lead.';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const totalContractPaise = form.totalContractRupees
      ? Math.round(Number(form.totalContractRupees) * 100)
      : undefined;

    setCreating(true);
    setApiError(null);
    try {
      const payload: Record<string, unknown> = { name: form.name.trim() };
      if (form.noLead) {
        payload.clientName  = form.clientName.trim();
        payload.clientPhone = form.clientPhone.trim();
      } else {
        payload.leadId = form.leadId;
      }
      if (totalContractPaise !== undefined) payload.totalContractPaise = totalContractPaise;

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setApiError(body.error ?? 'Failed to create project. Please try again.');
        return;
      }
      setDialogOpen(false);
      await loadProjects();
    } catch {
      setApiError('Network error — please check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  const activeCount    = projects.filter(p => p.lifecycleStage !== 'complete').length;
  const completedCount = projects.filter(p => p.lifecycleStage === 'complete').length;
  const totalContract  = projects.reduce((s, p) => s + (p.totalContractPaise ?? 0), 0);
  const overdueCount   = projects.filter(p =>
    p.lifecycleStage !== 'complete' && !!p.expectedEndAt && daysDiff(p.expectedEndAt) > 0
  ).length;
  const isEmpty        = !loading && !fetchError && projects.length === 0;
  const noResults      = !loading && !fetchError && projects.length > 0 && filteredProjects.length === 0;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
            Projects
          </h1>
          {!loading && projects.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
            >
              {projects.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New project
        </button>
      </div>

      {/* Search + stage filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="studio-search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="studio-input w-full h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={filterStage === 'all'} onClick={() => setFilterStage('all')} label="All" count={projects.length} />
          {STAGE_ORDER.map(stage => {
            const cnt = projects.filter(p => p.lifecycleStage === stage).length;
            if (cnt === 0) return null;
            return (
              <FilterChip
                key={stage}
                active={filterStage === stage}
                onClick={() => setFilterStage(stage)}
                label={STAGE_STYLE_MAP[stage].label}
                count={cnt}
              />
            );
          })}
        </div>
      </div>

      {/* KPI summary */}
      {!loading && !fetchError && projects.length > 0 && (
        <div className={`grid gap-3 ${overdueCount > 0 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total</p>
            <p className="text-[22px] font-bold tnum" style={{ color: 'var(--text-heading)' }}>{projects.length}</p>
          </div>
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Active</p>
            <p className="text-[22px] font-bold tnum" style={{ color: 'var(--accent-base)' }}>{activeCount}</p>
          </div>
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Completed</p>
            <p className="text-[22px] font-bold tnum" style={{ color: 'var(--success)' }}>{completedCount}</p>
          </div>
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Contract Value</p>
            <p className="text-[18px] font-bold tnum leading-tight" style={{ color: 'var(--text-heading)' }}>
              {totalContract > 0 ? formatRupees(totalContract) : '—'}
            </p>
          </div>
          {overdueCount > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)' }}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#DC2626' }}>Overdue</p>
              <p className="text-[22px] font-bold tnum" style={{ color: '#DC2626' }}>{overdueCount}</p>
            </div>
          )}
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="premium-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{fetchError}</p>
          <button onClick={() => void loadProjects()} className="text-[12px] font-medium underline-offset-4 hover:underline" style={{ color: 'var(--accent-base)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="premium-card flex flex-col items-center justify-center gap-3 p-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
            <FolderKanban className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No projects yet</p>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Turn a lead into a project to start tracking it.</p>
          <button type="button" onClick={openDialog} className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New project
          </button>
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div className="premium-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No projects match your filters</p>
          <button onClick={() => { setSearch(''); setFilterStage('all'); }} className="text-[12px] font-medium underline-offset-4 hover:underline" style={{ color: 'var(--accent-base)' }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Card grid */}
      {!fetchError && !isEmpty && (
        loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 animate-pulse"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="h-5 w-24 rounded-full mb-3" style={{ background: 'var(--surface-muted)' }} />
                <div className="h-4 w-40 rounded mb-2" style={{ background: 'var(--surface-muted)' }} />
                <div className="h-3 w-28 rounded" style={{ background: 'var(--surface-muted)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/projects/${project.id}`)}
              />
            ))}
          </div>
        )
      )}

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...INITIAL_FORM, noLead: !prev.noLead, name: prev.name, totalContractRupees: prev.totalContractRupees }))}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium border transition-colors"
                style={
                  form.noLead
                    ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-base)' }
                    : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                }
              >
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                No linked lead
              </button>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                {form.noLead ? 'Enter client details manually' : 'Link to an existing lead'}
              </span>
            </div>

            {form.noLead ? (
              <>
                <FormField label="Client name" required error={errors.clientName}>
                  <input type="text" placeholder="e.g. Priya Sharma" value={form.clientName} onChange={e => setField('clientName', e.target.value)} className="studio-input w-full h-9" />
                </FormField>
                <FormField label="Client phone" required error={errors.clientPhone}>
                  <input type="tel" placeholder="e.g. 9876543210" value={form.clientPhone} onChange={e => setField('clientPhone', e.target.value)} className="studio-input w-full h-9 tnum" />
                </FormField>
              </>
            ) : (
              <FormField label="Lead" required error={errors.leadId}>
                <LeadSelector value={{ id: form.leadId, label: form.leadLabel }} onChange={handleLeadSelect} />
              </FormField>
            )}

            <FormField label="Project name" required error={errors.name}>
              <input id="proj-name" type="text" placeholder="e.g. Sharma Residence — 3BHK" value={form.name} onChange={e => setField('name', e.target.value)} className="studio-input w-full h-9" />
            </FormField>

            <FormField label="Total contract" hint="Optional, in ₹">
              <input
                id="proj-contract"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 1500000"
                value={form.totalContractRupees}
                onChange={e => setField('totalContractRupees', e.target.value)}
                className="studio-input w-full h-9 tnum"
              />
              {form.totalContractRupees && Number(form.totalContractRupees) > 0 && (
                <p className="mt-1 text-[11px] tnum" style={{ color: 'var(--accent-text)' }}>
                  = ₹{Number(form.totalContractRupees).toLocaleString('en-IN')}
                </p>
              )}
            </FormField>

            {apiError && (
              <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                {apiError}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50"
            >
              {creating ? 'Creating…' : (
                <>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Create project
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
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
      <span className="tnum text-[11px] font-medium" style={{ color: active ? 'var(--accent-base)' : 'var(--text-secondary)', opacity: active ? 1 : 0.7 }}>
        {count}
      </span>
    </button>
  );
}

function FormField({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
          {label}
          {required && <span style={{ color: 'var(--accent-base)' }}> *</span>}
        </label>
        {hint && <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] font-medium" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  );
}
