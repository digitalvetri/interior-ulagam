'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, FolderKanban, ChevronDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Project } from '@/types/quotes';
import { Lead } from '@/types/leads';
import { formatRupees } from '@/lib/utils';

type LifecycleStage = Project['lifecycleStage'];

// Chip variant per lifecycle stage, using the design-system chip primitives.
const STAGE_CHIP: Record<LifecycleStage, { label: string; cls: string }> = {
  design_pending:     { label: 'Design pending',   cls: 'chip' },
  design_in_progress: { label: 'In progress',      cls: 'chip chip--warn' },
  design_approved:    { label: 'Design approved',  cls: 'chip chip--acc' },
  procurement:        { label: 'Procurement',      cls: 'chip chip--warn' },
  execution:          { label: 'Execution',        cls: 'chip chip--acc' },
  snagging:           { label: 'Snagging',         cls: 'chip chip--warn' },
  handover:           { label: 'Handover',         cls: 'chip chip--acc' },
  complete:           { label: 'Complete',         cls: 'chip chip--pos' },
};

interface NewProjectForm {
  leadId: string;
  leadLabel: string;
  selectedLead: Lead | null;
  name: string;
  nameWasEdited: boolean;
  totalContractRupees: string;
}

const INITIAL_FORM: NewProjectForm = {
  leadId: '',
  leadLabel: '',
  selectedLead: null,
  name: '',
  nameWasEdited: false,
  totalContractRupees: '',
};

/* ── Lead Search Combobox ─────────────────────────────────────────────────── */
function LeadSelector({
  value,
  onChange,
}: {
  value: { id: string; label: string };
  onChange: (lead: Lead) => void;
}) {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/leads');
        if (!res.ok) {
          setError(`Failed to load leads (${res.status})`);
          return;
        }
        const { data } = (await res.json()) as { data: Lead[] | null };
        setLeads(data ?? []);
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        const q = search.toLowerCase();
        return l.contactName.toLowerCase().includes(q) || l.contactPhone.includes(q);
      }),
    [leads, search],
  );

  function select(lead: Lead) {
    onChange(lead);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="studio-input w-full flex items-center justify-between text-sm cursor-pointer"
        aria-expanded={open}
      >
        <span style={{ color: value.id ? 'var(--ink)' : 'var(--ink-4)' }}>
          {value.id ? value.label : 'Search and select a lead…'}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ink-3)' }}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden card"
          style={{ padding: 0 }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="studio-input-group">
              <Search className="studio-input-icon h-3.5 w-3.5" strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type name or phone…"
                className="studio-input studio-input--icon w-full text-sm"
                style={{ padding: '0.4rem 0.75rem 0.4rem 2.25rem' }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--ink-3)' }}>
                Loading leads…
              </div>
            ) : error ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--neg)' }}>
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--ink-3)' }}>
                {search ? 'No leads match your search.' : 'No leads found.'}
              </div>
            ) : (
              filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{ borderBottom: '1px solid var(--line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-hi)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => select(lead)}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {lead.contactName}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs num" style={{ color: 'var(--ink-3)' }}>
                      {lead.contactPhone}
                    </span>
                    {lead.budgetBand && (
                      <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
                        {lead.budgetBand}
                      </span>
                    )}
                    <span className="chip" style={{ padding: '2px 6px', fontSize: 10 }}>
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

/* ── Project Card ─────────────────────────────────────────────────────────── */
function ProjectCard({ project }: { project: Project }) {
  const s = STAGE_CHIP[project.lifecycleStage] ?? { label: project.lifecycleStage, cls: 'chip' };
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="card p-5 h-full cursor-pointer group">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3
            className="text-[15px] font-semibold leading-snug group-hover:text-[color:var(--acc)] transition-colors"
            style={{ color: 'var(--ink)' }}
          >
            {project.name}
          </h3>
          <span className={s.cls}>{s.label}</span>
        </div>

        {project.totalContractPaise !== undefined && (
          <p className="text-lg font-semibold mb-2 num" style={{ color: 'var(--acc)', letterSpacing: '-0.02em' }}>
            {formatRupees(project.totalContractPaise)}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
          Created{' '}
          {new Date(project.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]         = useState<NewProjectForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors]     = useState<Partial<Record<keyof NewProjectForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/projects');
        if (!res.ok) {
          setLoadError(`Failed to load projects (${res.status})`);
          return;
        }
        const { data } = (await res.json()) as { data: Project[] };
        setProjects(data ?? []);
      } catch {
        setLoadError('Network error — please try again');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function openDialog() {
    setForm(INITIAL_FORM);
    setErrors({});
    setApiError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof NewProjectForm>(key: K, value: NewProjectForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      // Mark name as user-edited so a subsequent lead selection doesn't overwrite it.
      ...(key === 'name' ? { nameWasEdited: true } : {}),
    }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const handleLeadSelect = useCallback((lead: Lead) => {
    const label = `${lead.contactName} · ${lead.contactPhone}`;
    // Pre-fill a sensible project name if the user hasn't typed their own.
    // Format: "{Client} — {PropertyType}" (falls back to just the client name).
    const suggestedName = lead.propertyType
      ? `${lead.contactName} — ${lead.propertyType}`
      : lead.contactName;
    setForm((prev) => ({
      ...prev,
      leadId: lead.id,
      leadLabel: label,
      selectedLead: lead,
      name: prev.nameWasEdited ? prev.name : suggestedName,
    }));
    setErrors((prev) => ({ ...prev, leadId: undefined }));
  }, []);

  async function handleCreate() {
    const newErrors: Partial<Record<keyof NewProjectForm, string>> = {};
    if (!form.leadId) newErrors.leadId = 'Please select a lead.';
    if (!form.name.trim()) newErrors.name = 'Project name is required.';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const totalContractPaise = form.totalContractRupees
      ? Math.round(Number(form.totalContractRupees) * 100)
      : undefined;

    setCreating(true);
    setApiError(null);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: form.leadId,
          name: form.name.trim(),
          ...(totalContractPaise !== undefined && { totalContractPaise }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setApiError(body.error ?? 'Failed to create project. Please try again.');
        return;
      }
      const { data } = (await res.json()) as { data: Project };
      setProjects((prev) => [data, ...prev]);
      setDialogOpen(false);
    } catch {
      setApiError('Network error — please check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="display display-md">Projects</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
            <span className="num" style={{ color: 'var(--ink)' }}>{projects.length}</span>{' '}
            {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          New project
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div
          role="alert"
          className="rounded-lg p-4 text-sm"
          style={{ background: 'var(--neg-tint)', color: 'var(--neg)' }}
        >
          {loadError}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg py-16 text-center"
          style={{ background: 'var(--bg-2)', border: '1px dashed var(--line-strong)' }}
        >
          <div className="stat-badge" style={{ width: 48, height: 48, color: 'var(--acc)' }}>
            <FolderKanban className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            No projects yet
          </p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--ink-3)' }}>
            Convert a won lead into a project to start tracking milestones, materials and payments.
          </p>
          <button
            type="button"
            onClick={openDialog}
            className="btn-primary inline-flex items-center gap-1.5 mt-2 px-4 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Convert a won lead into a tracked project. Milestones, materials
              and payments will be scoped to it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── Lead ─────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="studio-label block">
                Lead <span style={{ color: 'var(--neg)' }}>*</span>
              </label>
              <LeadSelector
                value={{ id: form.leadId, label: form.leadLabel }}
                onChange={handleLeadSelect}
              />
              {errors.leadId && (
                <p className="text-xs mt-1" style={{ color: 'var(--neg)' }}>
                  {errors.leadId}
                </p>
              )}
              {form.selectedLead && <SelectedLeadPreview lead={form.selectedLead} />}
            </div>

            {/* ── Project name ─────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="studio-label block" htmlFor="proj-name">
                Project name <span style={{ color: 'var(--neg)' }}>*</span>
              </label>
              <input
                id="proj-name"
                type="text"
                placeholder="e.g. Sharma Residence — 3BHK"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="studio-input w-full text-sm"
              />
              {form.selectedLead && !form.nameWasEdited && form.name && (
                <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                  Auto-filled from lead — edit to override.
                </p>
              )}
              {errors.name && (
                <p className="text-xs mt-1" style={{ color: 'var(--neg)' }}>
                  {errors.name}
                </p>
              )}
            </div>

            {/* ── Contract value ───────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="studio-label block" htmlFor="proj-contract">
                Contract value ₹
                <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--ink-4)' }}>
                  (optional)
                </span>
              </label>
              <input
                id="proj-contract"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 1500000"
                value={form.totalContractRupees}
                onChange={(e) => setField('totalContractRupees', e.target.value)}
                className="studio-input w-full text-sm num"
              />
              {form.totalContractRupees && Number(form.totalContractRupees) > 0 ? (
                <p className="text-xs num" style={{ color: 'var(--acc)' }}>
                  = ₹{Number(form.totalContractRupees).toLocaleString('en-IN')}
                </p>
              ) : (
                <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                  Total contract value — can be edited later.
                </p>
              )}
            </div>

            {apiError && (
              <div
                className="rounded-md px-3 py-2.5 text-sm"
                style={{ background: 'var(--neg-tint)', color: 'var(--neg)' }}
              >
                {apiError}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !form.leadId || !form.name.trim()}
              className="btn-primary px-4 py-2 text-sm"
            >
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Selected lead preview ────────────────────────────────────────────────── */
function SelectedLeadPreview({ lead }: { lead: Lead }) {
  const stageLabel = lead.stage.replace(/_/g, ' ');
  return (
    <div
      className="rounded-lg mt-2 p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="chip" style={{ padding: '2px 6px', fontSize: 10 }}>
          {stageLabel}
        </span>
        {lead.stage !== 'won' && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--warn-tint)', color: 'var(--warn)' }}
            title="Projects are usually created from a lead marked Won"
          >
            not won yet
          </span>
        )}
      </div>
      <span className="num" style={{ color: 'var(--ink-3)' }}>{lead.contactPhone}</span>
      {lead.budgetBand && (
        <span style={{ color: 'var(--ink-3)' }}>{lead.budgetBand}</span>
      )}
      {lead.propertyType && (
        <span style={{ color: 'var(--ink-3)' }}>{lead.propertyType}</span>
      )}
      {lead.projectLocation && (
        <span style={{ color: 'var(--ink-3)' }}>{lead.projectLocation}</span>
      )}
    </div>
  );
}
