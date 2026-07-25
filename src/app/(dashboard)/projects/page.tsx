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
  design_pending:     { bg: '#EFF6FF', color: '#1E40AF', label: 'Design Pending' },
  design_in_progress: { bg: '#FFF7ED', color: '#9A3412', label: 'In Progress' },
  design_approved:    { bg: '#F0FDF4', color: '#14532D', label: 'Design Approved' },
  procurement:        { bg: '#FEF3C7', color: '#92400E', label: 'Procurement' },
  execution:          { bg: '#F5F3FF', color: '#6B21A8', label: 'Execution' },
  snagging:           { bg: '#FDF2F8', color: '#BE185D', label: 'Snagging' },
  handover:           { bg: '#FEF2F2', color: '#991B1B', label: 'Handover' },
  complete:           { bg: '#F0FDF4', color: '#14532D', label: 'Complete' },
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
          <span style={{ color: '#221F1B' }}>{value.label}</span>
        ) : (
          <span style={{ color: '#A79E8E' }}>Search and select a lead…</span>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2DED5', boxShadow: '0 8px 24px rgba(22,20,15,0.12)' }}
        >
          {/* Search box inside dropdown */}
          <div className="p-2 border-b" style={{ borderColor: '#F0EEE9' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#A79E8E' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or phone…"
                className="studio-input w-full pl-8 py-1.5 text-sm"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm" style={{ color: '#6B6459' }}>Loading leads…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: '#6B6459' }}>
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
                  <p className="text-sm font-semibold" style={{ color: '#221F1B' }}>
                    {lead.contactName}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: '#6B6459' }}>{lead.contactPhone}</span>
                    {lead.budgetBand && (
                      <span className="text-xs font-medium" style={{ color: '#24211E' }}>
                        {lead.budgetBand}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: '#F0EEE9', color: '#24211E' }}
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

/* ── Project Card ─────────────────────────────────────────────────────────── */
function ProjectCard({ project }: { project: Project }) {
  const s = STAGE_STYLE[project.lifecycleStage];
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="premium-card p-5 h-full cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold leading-snug" style={{ color: '#221F1B' }}>
            {project.name}
          </h3>
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: s.bg, color: s.color }}
          >
            {s.label}
          </span>
        </div>

        {project.totalContractPaise !== undefined && (
          <p className="text-base font-bold mb-1" style={{ color: '#8F6F2E' }}>
            {formatRupees(project.totalContractPaise)}
          </p>
        )}
        <p className="text-xs" style={{ color: '#6B6459' }}>
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]         = useState<NewProjectForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors]     = useState<Partial<Record<keyof NewProjectForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects')
      .then(r => r.json())
      .then(({ data }: { data: Project[] }) => {
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

      const { data } = await res.json() as { data: Project };
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
          <h2 className="text-2xl font-bold" style={{ color: '#1C1916' }}>Projects</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B6459' }}>
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
          style={{ borderColor: '#F0EEE9' }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(36,33,30,0.08)' }}
          >
            <FolderKanban className="h-7 w-7" style={{ color: '#E2DED5' }} />
          </div>
          <p className="text-sm" style={{ color: '#6B6459' }}>No projects yet.</p>
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
            <DialogTitle style={{ color: '#1C1916' }}>New Project</DialogTitle>
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
                <span className="ml-1 text-[11px] font-normal" style={{ color: '#A79E8E' }}>(optional)</span>
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
                <p className="text-xs" style={{ color: '#24211E' }}>
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
