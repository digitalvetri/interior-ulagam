'use client';
import { useState, useEffect } from 'react';
import { Plus, Wrench, AlertCircle, Clock, ArrowUpCircle } from 'lucide-react';
import { PageHeader }  from '@/components/ui/PageHeader';
import { EmptyState }  from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface ServiceRequest {
  id: string;
  issue: string;
  photoUrl: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'assigned' | 'in_progress' | 'resolved';
  assignedTo: string | null;
  assigneeName: string | null;
  customerId: string | null;
  customerName: string | null;
  projectId: string | null;
  projectName: string | null;
  scheduledVisitAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface UserOption { id: string; fullName: string; }
interface ProjectOption { id: string; name: string; }

const PRIORITY_ICONS = {
  low:    <Clock       className="h-3.5 w-3.5" />,
  medium: <AlertCircle className="h-3.5 w-3.5" />,
  high:   <AlertCircle className="h-3.5 w-3.5" />,
  urgent: <ArrowUpCircle className="h-3.5 w-3.5" />,
};

const PRIORITY_COLORS = {
  low:    { bg: 'var(--surface-muted)',   color: 'var(--text-secondary)' },
  medium: { bg: 'var(--warning-soft)',    color: 'var(--warning-text)'   },
  high:   { bg: 'var(--danger-soft)',     color: 'var(--danger)'         },
  urgent: { bg: 'var(--danger)',          color: '#fff'                  },
};

function CreateDialog({
  projects, onClose, onCreated,
}: {
  users?: UserOption[];
  projects: ProjectOption[];
  onClose: () => void;
  onCreated: (r: ServiceRequest) => void;
}) {
  const [issue,     setIssue]     = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority,  setPriority]  = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!issue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue: issue.trim(),
          projectId: projectId || undefined,
          priority,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) { onCreated(json.data); onClose(); }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-heading)' }}>New Service Request</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Issue description *
            </label>
            <textarea
              className="input-field w-full"
              rows={3}
              value={issue} onChange={e => setIssue(e.target.value)}
              placeholder="Describe the issue or warranty claim…"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Project
              </label>
              <select className="input-field w-full" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">— No project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Priority
              </label>
              <select
                className="input-field w-full"
                value={priority}
                onChange={e => setPriority(e.target.value as typeof priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea
              className="input-field w-full"
              rows={2}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || !issue.trim()} className="btn-primary px-4 py-2 text-sm rounded-lg">
              {saving ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestCard({
  req, onStatusChange,
}: { req: ServiceRequest; onStatusChange: (id: string, status: string) => void }) {
  const p = PRIORITY_COLORS[req.priority];

  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug flex-1" style={{ color: 'var(--text-heading)' }}>
          {req.issue}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: p.bg, color: p.color }}
          >
            {PRIORITY_ICONS[req.priority]}
            {req.priority}
          </span>
          <StatusBadge status={req.status} module="service_requests" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        {req.projectName && <span>Project: <strong>{req.projectName}</strong></span>}
        {req.customerName && <span>Client: <strong>{req.customerName}</strong></span>}
        {req.assigneeName && <span>Assigned: <strong>{req.assigneeName}</strong></span>}
        {req.scheduledVisitAt && (
          <span>Visit: <strong>{new Date(req.scheduledVisitAt).toLocaleDateString('en-IN')}</strong></span>
        )}
        <span>{new Date(req.createdAt).toLocaleDateString('en-IN')}</span>
      </div>

      {req.notes && (
        <p className="text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>{req.notes}</p>
      )}

      {/* Status progression */}
      {req.status !== 'resolved' && (
        <div className="flex gap-2 pt-1">
          {req.status === 'open' && (
            <button
              onClick={() => onStatusChange(req.id, 'assigned')}
              className="text-xs font-semibold px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              Assign
            </button>
          )}
          {(req.status === 'assigned') && (
            <button
              onClick={() => onStatusChange(req.id, 'in_progress')}
              className="text-xs font-semibold px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning-text)' }}
            >
              Start Work
            </button>
          )}
          {(req.status === 'in_progress') && (
            <button
              onClick={() => onStatusChange(req.id, 'resolved')}
              className="text-xs font-semibold px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success-text)' }}
            >
              Mark Resolved
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicePage() {
  const [requests,  setRequests]  = useState<ServiceRequest[]>([]);
  const [users,     setUsers]     = useState<UserOption[]>([]);
  const [projects,  setProjects]  = useState<ProjectOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const [sr, us, ps] = await Promise.all([
        fetch('/api/v1/service-requests?limit=200').then(r => r.json()),
        fetch('/api/v1/employees').then(r => r.json()),
        fetch('/api/v1/projects?limit=200').then(r => r.json()),
      ]);
      if (Array.isArray(sr?.data)) setRequests(sr.data);
      if (Array.isArray(us?.data)) setUsers(us.data);
      if (Array.isArray(ps?.data)) setProjects(ps.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: string) {
    const updates: Record<string, string | null> = { status };
    if (status === 'resolved') updates.resolvedAt = new Date().toISOString();

    const res = await fetch(`/api/v1/service-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const json = await res.json();
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...json.data } : r));
    }
  }

  const displayed = requests.filter(r => !statusFilter || r.status === statusFilter);
  const openCount = requests.filter(r => r.status !== 'resolved').length;

  return (
    <div className="space-y-4 p-4 lg:p-6 animate-fade-in">
      <PageHeader
        title="Service Requests"
        subtitle="Post-handover warranty claims and service visits"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
            <Plus className="h-4 w-4" /> New Request
          </button>
        }
      />

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: '',          label: `All (${requests.length})` },
          { value: 'open',      label: 'Open' },
          { value: 'assigned',  label: 'Assigned' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'resolved',  label: 'Resolved' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: statusFilter === f.value ? 'var(--accent-base)'  : 'var(--surface-muted)',
              color:            statusFilter === f.value ? '#fff'                : 'var(--text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Wrench}
          label="No service requests"
          description="Post-handover issues raised by clients will appear here."
          actionLabel="Log a Request"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map(r => (
            <RequestCard key={r.id} req={r} onStatusChange={changeStatus} />
          ))}
        </div>
      )}

      {creating && (
        <CreateDialog
          users={users}
          projects={projects}
          onClose={() => setCreating(false)}
          onCreated={r => {
            setRequests(prev => [r as ServiceRequest, ...prev]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
