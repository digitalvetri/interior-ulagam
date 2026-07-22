'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupees } from '@/lib/utils';
import { Project } from '@/types/quotes';

type LifecycleStage = Project['lifecycleStage'];

const STAGE_BADGE_VARIANT: Record<
  LifecycleStage,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  design_pending: 'secondary',
  design_in_progress: 'secondary',
  design_approved: 'default',
  procurement: 'default',
  execution: 'outline',
  snagging: 'outline',
  handover: 'destructive',
  complete: 'destructive',
};

const STAGE_LABEL: Record<LifecycleStage, string> = {
  design_pending: 'Design Pending',
  design_in_progress: 'Design In Progress',
  design_approved: 'Design Approved',
  procurement: 'Procurement',
  execution: 'Execution',
  snagging: 'Snagging',
  handover: 'Handover',
  complete: 'Complete',
};

interface NewProjectForm {
  leadId: string;
  name: string;
  totalContractRupees: string;
}

const INITIAL_FORM: NewProjectForm = {
  leadId: '',
  name: '',
  totalContractRupees: '',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then(({ data }: { data: Project[] }) => {
        setProjects(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function setField<K extends keyof NewProjectForm>(
    key: K,
    value: NewProjectForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openDialog() {
    setForm(INITIAL_FORM);
    setCreateError(null);
    setDialogOpen(true);
  }

  async function handleCreateProject() {
    setCreateError(null);

    if (!form.leadId.trim()) {
      setCreateError('Lead ID is required');
      return;
    }
    if (!form.name.trim()) {
      setCreateError('Project name is required');
      return;
    }

    const totalContractPaise =
      form.totalContractRupees
        ? Math.round(Number(form.totalContractRupees) * 100)
        : undefined;

    setCreating(true);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: form.leadId.trim(),
          name: form.name.trim(),
          ...(totalContractPaise !== undefined && { totalContractPaise }),
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setCreateError(body.error ?? 'Failed to create project');
        return;
      }

      const { data } = (await res.json()) as { data: Project };
      setProjects((prev) => [data, ...prev]);
      setDialogOpen(false);
    } catch {
      setCreateError('Network error — please try again');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Projects
        </h2>
        <Button onClick={openDialog}>+ New Project</Button>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading projects…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-500">No projects yet.</p>
          <Button variant="outline" size="sm" onClick={openDialog}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug text-gray-900 dark:text-white">
                      {project.name}
                    </CardTitle>
                    <Badge
                      variant={STAGE_BADGE_VARIANT[project.lifecycleStage]}
                      className="shrink-0"
                    >
                      {STAGE_LABEL[project.lifecycleStage]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  {project.totalContractPaise !== undefined && (
                    <p>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Contract:
                      </span>{' '}
                      {formatRupees(project.totalContractPaise)}
                    </p>
                  )}
                  <p>
                    Created{' '}
                    {new Date(project.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-lead">Lead ID</Label>
              <Input
                id="proj-lead"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={form.leadId}
                onChange={(e) => setField('leadId', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input
                id="proj-name"
                placeholder="Sharma Residence — 3BHK"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-contract">
                Total Contract ₹{' '}
                <span className="text-xs text-gray-400">(optional)</span>
              </Label>
              <Input
                id="proj-contract"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.totalContractRupees}
                onChange={(e) =>
                  setField('totalContractRupees', e.target.value)
                }
              />
            </div>

            {createError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {createError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating ? 'Creating…' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
