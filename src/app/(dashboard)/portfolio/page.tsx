'use client';
import { useState, useEffect } from 'react';
import { Plus, Star, Eye, EyeOff, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { PageHeader }  from '@/components/ui/PageHeader';
import { EmptyState }  from '@/components/ui/EmptyState';

interface PortfolioEntry {
  id: string;
  title: string;
  coverPhotoUrl: string | null;
  photos: string[];
  isPublic: boolean;
  clientConsent: boolean;
  createdAt: string;
  projectId: string;
  projectName: string | null;
  customerName: string | null;
}

interface ProjectOption { id: string; name: string; }

function ConsentDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: ok ? 'var(--success-soft)' : 'var(--surface-muted)',
        color: ok ? 'var(--success-text)' : 'var(--text-tertiary)',
      }}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : null}
      {ok ? 'Consent' : 'No consent'}
    </span>
  );
}

function CreateDialog({
  projects, onClose, onCreated,
}: {
  projects: ProjectOption[];
  onClose: () => void;
  onCreated: (e: PortfolioEntry) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [title,     setTitle]     = useState('');
  const [saving,    setSaving]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: title.trim() || undefined }),
      });
      const json = await res.json();
      if (res.ok) { onCreated(json.data); onClose(); }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-heading)' }}>
          New Portfolio Entry
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Project *
            </label>
            <select
              className="input-field w-full"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              required
            >
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Album title
            </label>
            <input
              className="input-field w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Living Room Makeover"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving || !projectId} className="btn-primary px-4 py-2 text-sm rounded-lg">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortfolioCard({
  entry, onUpdate,
}: { entry: PortfolioEntry; onUpdate: (updated: Partial<PortfolioEntry>) => void }) {
  const [toggling, setToggling] = useState(false);

  async function toggleFlag(field: 'isPublic' | 'clientConsent') {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/portfolio/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !entry[field] }),
      });
      if (res.ok) onUpdate({ [field]: !entry[field] });
    } finally { setToggling(false); }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-card)' }}
    >
      {/* Cover photo placeholder */}
      <div
        className="h-36 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--surface-muted)',
          backgroundImage: entry.coverPhotoUrl ? `url(${entry.coverPhotoUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!entry.coverPhotoUrl && (
          <ImageIcon className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
            {entry.title || entry.projectName || 'Untitled'}
          </p>
          {entry.projectName && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {entry.projectName}
              {entry.customerName ? ` · ${entry.customerName}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ConsentDot ok={entry.clientConsent} />
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: entry.isPublic ? 'var(--accent-soft)'  : 'var(--surface-muted)',
              color:            entry.isPublic ? 'var(--accent-text)' : 'var(--text-tertiary)',
            }}
          >
            {entry.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {entry.isPublic ? 'Public' : 'Private'}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {entry.photos.length} photo{entry.photos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => toggleFlag('clientConsent')}
            disabled={toggling}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: entry.clientConsent ? 'var(--success-soft)' : 'var(--surface-muted)',
              color: entry.clientConsent ? 'var(--success-text)' : 'var(--text-secondary)',
            }}
          >
            {entry.clientConsent ? '✓ Consent given' : 'Mark consent'}
          </button>
          <button
            onClick={() => toggleFlag('isPublic')}
            disabled={toggling || !entry.clientConsent}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--surface-muted)',
              color:            entry.clientConsent ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity:          !entry.clientConsent ? 0.5 : 1,
            }}
            title={!entry.clientConsent ? 'Requires client consent first' : undefined}
          >
            {entry.isPublic ? 'Make private' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [entries,   setEntries]   = useState<PortfolioEntry[]>([]);
  const [projects,  setProjects]  = useState<ProjectOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [showAll,   setShowAll]   = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [pf, ps] = await Promise.all([
        fetch('/api/v1/portfolio?limit=200').then(r => r.json()),
        fetch('/api/v1/projects?limit=200').then(r => r.json()),
      ]);
      if (Array.isArray(pf?.data)) setEntries(pf.data);
      if (Array.isArray(ps?.data)) setProjects(ps.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function updateEntry(id: string, patch: Partial<PortfolioEntry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  const displayed = showAll ? entries : entries.filter(e => e.isPublic && e.clientConsent);
  const publicCount = entries.filter(e => e.isPublic && e.clientConsent).length;

  return (
    <div className="space-y-4 p-4 lg:p-6 animate-fade-in">
      <PageHeader
        title="Portfolio"
        subtitle="Showcase completed projects — only published, consented entries are visible publicly"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        }
      />

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { v: true,  label: `All (${entries.length})` },
          { v: false, label: `Public (${publicCount})` },
        ].map(f => (
          <button
            key={String(f.v)}
            onClick={() => setShowAll(f.v)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: showAll === f.v ? 'var(--accent-base)'  : 'var(--surface-muted)',
              color:            showAll === f.v ? '#fff'                : 'var(--text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Star}
          label="No portfolio entries"
          description="Add completed projects to build your portfolio. Only entries with client consent can be published."
          actionLabel="Add First Entry"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(e => (
            <PortfolioCard
              key={e.id}
              entry={e}
              onUpdate={patch => updateEntry(e.id, patch)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateDialog
          projects={projects}
          onClose={() => setCreating(false)}
          onCreated={e => {
            setEntries(prev => [e as PortfolioEntry, ...prev]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
