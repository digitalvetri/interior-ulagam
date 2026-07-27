'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Plus, Clock, CheckCircle2, Send, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupees } from '@/lib/utils';
import { Quote, Project } from '@/types/quotes';

const STATUS_CONFIG: Record<Quote['status'], { label: string; icon: React.ElementType; bg: string; color: string }> = {
  draft:    { label: 'Draft',    icon: Clock,        bg: '#F1F5F9', color: '#64748B' },
  sent:     { label: 'Sent',     icon: Send,         bg: '#FEF9C3', color: '#854D0E' },
  approved: { label: 'Approved', icon: CheckCircle2, bg: '#F0FDF4', color: '#15803D' },
  revised:  { label: 'Revised',  icon: RefreshCw,    bg: '#FEF2F2', color: '#DC2626' },
};

function QuoteNumberBadge({ version, id }: { version: number; id: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
        Q-{version.toString().padStart(3, '0')}
      </span>
      <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
        {id.slice(0, 8).toUpperCase()}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: Quote['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/quotes')
      .then((r) => r.json())
      .then(({ data }: { data: Quote[] }) => {
        setQuotes(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openNewQuoteDialog() {
    setSelectedProjectId('');
    setCreateError(null);
    setDialogOpen(true);
    setProjectsLoading(true);
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then(({ data }: { data: Project[] }) => {
        setProjects(data ?? []);
        setProjectsLoading(false);
      })
      .catch(() => setProjectsLoading(false));
  }

  async function handleCreateQuote() {
    setCreateError(null);
    if (!selectedProjectId) {
      setCreateError('Please select a project');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/v1/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setCreateError(body.error ?? 'Failed to create quote');
        return;
      }
      const { data } = (await res.json()) as { data: Quote };
      setDialogOpen(false);
      router.push(`/quotes/${data.id}`);
    } catch {
      setCreateError('Network error — please try again');
    } finally {
      setCreating(false);
    }
  }

  const totalValue = quotes.reduce((sum, q) => sum + (q.totalPaise ?? 0), 0);
  const approvedCount = quotes.filter(q => q.status === 'approved').length;
  const draftCount = quotes.filter(q => q.status === 'draft').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Quotations</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {quotes.length} quotes · {approvedCount} approved · {draftCount} drafts
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2" onClick={openNewQuoteDialog}>
          <Plus className="h-4 w-4" />
          New Quote
        </button>
      </div>

      {/* Summary cards */}
      {quotes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(STATUS_CONFIG) as Array<Quote['status']>).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const count = quotes.filter(q => q.status === status).length;
            const value = quotes.filter(q => q.status === status).reduce((s, q) => s + (q.totalPaise ?? 0), 0);
            return (
              <div key={status} className="premium-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: cfg.bg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                  </span>
                  <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>{count}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatRupees(value)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="premium-card flex h-32 items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading quotes…</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="premium-card flex h-56 flex-col items-center justify-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--violet-soft)' }}
          >
            <FileText className="h-7 w-7" style={{ color: 'var(--forest)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No quotes yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Create a quote for a project to get started
            </p>
          </div>
          <button className="btn-primary px-4 py-2 text-sm" onClick={openNewQuoteDialog}>
            Create your first quote
          </button>
        </div>
      ) : (
        <div className="premium-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs font-semibold uppercase tracking-wide"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
              >
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr
                  key={quote.id}
                  className="transition-colors hover:bg-[var(--surface-muted)]"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-3">
                    <QuoteNumberBadge version={quote.version} id={quote.id} />
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {quote.projectName ?? (
                      <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {quote.projectId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(quote.totalPaise)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(quote.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--forest-deep)', background: 'var(--mint-mist)', border: '1px solid #B4DCD1' }}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Footer total */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              Pipeline total: {formatRupees(totalValue)}
            </span>
          </div>
        </div>
      )}

      {/* New Quote Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Quote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="quote-project">Select Project</Label>
              {projectsLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading projects…</p>
              ) : projects.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects found.</p>
              ) : (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="quote-project">
                    <SelectValue placeholder="Choose a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {createError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={handleCreateQuote}
              disabled={creating || projectsLoading}
            >
              {creating ? 'Creating…' : 'Create Quote'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
