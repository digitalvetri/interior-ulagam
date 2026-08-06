'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, FolderKanban } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Project } from '@/types/quotes';
import { Lead } from '@/types/leads';
import { formatRupees } from '@/lib/utils';

type LifecycleStage = Project['lifecycleStage'];

const STAGE_STYLE: Record<LifecycleStage, { bg: string; color: string; label: string }> = {
  design_pending:     { bg: 'var(--accent-soft)', color: 'var(--accent-text)', label: 'Design Pending' },
  design_in_progress: { bg: 'var(--warning-soft)', color: '#9A3412', label: 'In Progress' },
  design_approved:    { bg: 'var(--success-soft)', color: 'var(--success-text)', label: 'Design Approved' },
  procurement:        { bg: 'var(--warning-soft)', color: 'var(--warning-text)', label: 'Procurement' },
  execution:          { bg: 'var(--accent-soft)', color: '#6B21A8', label: 'Execution' },
  snagging:           { bg: '#FDF2F8', color: '#BE185D', label: 'Snagging' },
  handover:           { bg: 'var(--danger-soft)', color: 'var(--danger-text)', label: 'Handover' },
  complete:           { bg: 'var(--success-soft)', color: 'var(--success-text)', label: 'Complete' },
};

interface NewProjectForm {
  leadId: string;
  leadLabel: string;
  name: string;
  totalContractRupees: string;
}

const INITIAL_FORM: NewProjectForm = {
  leadId: '',
  leadLabel: '',
  name: '',
  totalContractRupees: '',
};

/* ── Lead Search Combobox ─────────────────────────────────────────────────── */
function LeadSelector({
  value,
  onChange,
}: {
  value: { id: string; label: string };
  onChange: (id: string, label: string) => void;
}) {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);

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

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return (
      l.contactName.toLowerCase().includes(q) ||
      l.contactPhone.includes(q)
    );
  });

  function select(lead: Lead) {
    const label = `${lead.contactName} · ${lead.contactPhone}`;
    onChange(lead.id, label);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      {/* Selected or search input */}
      <div
        className="studio-input flex items-center gap-2 cursor-pointer min-h-[40px] text-sm"
        onClick={() => setOpen(o => !o)}
      >
        {value.id ? (
          <span style={{ color: 'var(--text-primary)' }}>{value.label}</span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>Search and select a lead…</span>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(22,20,15,0.12)' }}
        >
          {/* Search box inside dropdown */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or phone…"
                className="studio-input w-full py-1.5 text-sm"
                style={{ paddingLeft: '32px' }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading leads…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {search ? 'No leads match your search.' : 'No leads found.'}
              </div>
            ) : (
              filtered.map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full text-left px-4 py-3 transition-colors hover:bg-[#FAF9F6]"
                  style={{ borderBottom: '1px solid #F0EBE5' }}
                  onClick={() => select(lead)}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {lead.contactName}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.contactPhone}</span>
                    {lead.budgetBand && (
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {lead.budgetBand}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
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

/* ── Customer color palette — deterministic per name ─────────────────────── */
const CUSTOMER_PALETTES = [
  { bg: 'var(--accent-soft)', color: 'var(--accent-text)', ring: 'var(--accent-soft)' }, // violet
  { bg: 'var(--success-soft)', color: 'var(--success-text)', ring: '#86EFAC' }, // green
  { bg: 'var(--warning-soft)', color: 'var(--warning-text)', ring: '#FCD34D' }, // amber
  { bg: 'var(--accent-soft)', color: 'var(--accent-text)', ring: '#93C5FD' }, // blue
  { bg: '#FCE7F3', color: '#9D174D', ring: '#F9A8D4' }, // pink
  { bg: 'var(--danger-soft)', color: 'var(--danger-text)', ring: '#FCA5A5' }, // red
  { bg: '#F0F9FF', color: '#0369A1', ring: '#7DD3FC' }, // sky
  { bg: 'var(--warning-soft)', color: '#9A3412', ring: '#FDBA74' }, // orange
  { bg: 'var(--success-soft)', color: 'var(--success-text)', ring: '#6EE7B7' }, // emerald
  { bg: '#FDF2F8', color: '#BE185D', ring: '#F0ABFC' }, // fuchsia
];

function customerPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CUSTOMER_PALETTES[h % CUSTOMER_PALETTES.length];
}

/* ── Project Card ─────────────────────────────────────────────────────────── */
interface ProjectWithContext extends Project {
  customerId?: string | null;
  customerFullName?: string | null;
  leadContactName?: string | null;
}

function ProjectCard({ project }: { project: ProjectWithContext }) {
  const s           = STAGE_STYLE[project.lifecycleStage];
  const clientLabel = project.customerFullName ?? project.leadContactName ?? null;
  const palette     = clientLabel ? customerPalette(clientLabel) : null;
  const initials    = clientLabel
    ? clientLabel.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : null;

  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className="premium-card p-5 h-full cursor-pointer transition-shadow hover:shadow-md"
        style={palette ? { borderTop: `3px solid ${palette.ring}` } : undefined}>

        {/* Customer chip — top row */}
        {clientLabel && palette && initials && (
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ background: palette.bg, color: palette.color }}>
              {initials}
            </span>
            <span className="text-xs font-semibold truncate" style={{ color: palette.color }}>
              {clientLabel}
            </span>
          </div>
        )}

        {/* Project name + stage badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h3>
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: s.bg, color: s.color }}>
            {s.label}
          </span>
        </div>

        {/* Contract + date */}
        {project.totalContractPaise !== undefined && (
          <p className="text-base font-bold mb-1" style={{ color: '#8F6F2E' }}>
            {formatRupees(project.totalContractPaise)}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Created {new Date(project.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      </div>
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithContext[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]         = useState<NewProjectForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors]     = useState<Partial<Record<keyof NewProjectForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects')
      .then(r => r.json())
      .then(({ data }: { data: ProjectWithContext[] }) => {
        setProjects(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
    if (!form.leadId)      newErrors.leadId = 'Please select a lead.';
    if (!form.name.trim()) newErrors.name   = 'Project Name is required.';

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
        const body = await res.json() as { error?: string };
        setApiError(body.error ?? 'Failed to create project. Please try again.');
        return;
      }

      const { data } = await res.json() as { data: ProjectWithContext };
      setProjects(prev => [data, ...prev]);
      setDialogOpen(false);
    } catch {
      setApiError('Network error — please check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Projects</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <button type="button" onClick={openDialog} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />New Project
        </button>
      </div>

      {/* ── Projects grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <div
          className="flex h-52 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(36,33,30,0.08)' }}
          >
            <FolderKanban className="h-7 w-7" style={{ color: 'var(--border-strong)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
          <button type="button" onClick={openDialog} className="btn-secondary px-4 py-2 text-sm">
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}

      {/* ── New Project Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-heading)' }}>New Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Lead selector (no UUID entry) */}
            <div className="space-y-1.5">
              <label className="studio-label block">
                Select Lead <span className="text-red-500">*</span>
              </label>
              <LeadSelector
                value={{ id: form.leadId, label: form.leadLabel }}
                onChange={handleLeadSelect}
              />
              {errors.leadId && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  {errors.leadId}
                </p>
              )}
            </div>

            {/* Project name */}
            <div className="space-y-1.5">
              <label className="studio-label block" htmlFor="proj-name">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                id="proj-name"
                type="text"
                placeholder="e.g. Sharma Residence — 3BHK"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                className="studio-input w-full text-sm"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Contract value */}
            <div className="space-y-1.5">
              <label className="studio-label block" htmlFor="proj-contract">
                Total Contract ₹
                <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
              </label>
              <input
                id="proj-contract"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 1500000"
                value={form.totalContractRupees}
                onChange={e => setField('totalContractRupees', e.target.value)}
                className="studio-input w-full text-sm"
              />
              {form.totalContractRupees && Number(form.totalContractRupees) > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                  = ₹{Number(form.totalContractRupees).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            {apiError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
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
              disabled={creating}
              className="btn-primary px-4 py-2 text-sm"
            >
              {creating ? 'Creating…' : 'Create Project'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
