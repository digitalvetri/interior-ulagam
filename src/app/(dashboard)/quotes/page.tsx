'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

const STATUS_BADGE_STYLE: Record<Quote['status'], React.CSSProperties> = {
  draft:    { background: 'var(--surface-muted)', color: 'var(--text-secondary)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  sent:     { background: 'var(--gold-soft)', color: 'var(--text-gold)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  approved: { background: 'var(--teal-soft)', color: 'var(--text-accent)', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
  revised:  { background: '#FEE2E2', color: '#991B1B', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 },
};

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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
          Quotes
        </h2>
        <button className="btn-primary px-4 py-2" onClick={openNewQuoteDialog}>
          + New Quote
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="premium-card flex h-32 items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading quotes…</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="premium-card flex h-48 flex-col items-center justify-center gap-2">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No quotes yet.</p>
          <button className="btn-secondary px-4 py-2 text-sm" onClick={openNewQuoteDialog}>
            Create your first quote
          </button>
        </div>
      ) : (
        <div className="premium-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                <th className="px-4 py-3">Quote ID</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Date</th>
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
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--text-accent)' }}
                    >
                      #{quote.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    v{quote.version}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {quote.projectId}
                  </td>
                  <td className="px-4 py-3">
                    <span style={STATUS_BADGE_STYLE[quote.status]}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-heading)' }}>
                    {formatRupees(quote.totalPaise)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(quote.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
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
              <p className="text-xs text-red-600">
                {createError}
              </p>
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
