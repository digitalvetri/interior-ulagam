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
  draft:    { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  sent:     { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  approved: { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
  revised:  { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 },
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
        body: JSON.stringify({ projectId: Number(selectedProjectId) }),
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
        <h2 className="text-2xl font-bold text-gray-900">
          Quotes
        </h2>
        <button className="btn-primary px-4 py-2" onClick={openNewQuoteDialog}>
          + New Quote
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading quotes…</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No quotes yet.</p>
          <button className="btn-secondary px-4 py-2 text-sm" onClick={openNewQuoteDialog}>
            Create your first quote
          </button>
        </div>
      ) : (
        <div className="premium-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
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
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      #{quote.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    v{quote.version}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {quote.projectId}
                  </td>
                  <td className="px-4 py-3">
                    <span style={STATUS_BADGE_STYLE[quote.status]}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatRupees(quote.totalPaise)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
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
                <p className="text-sm text-gray-500">Loading projects…</p>
              ) : projects.length === 0 ? (
                <p className="text-sm text-gray-500">No projects found.</p>
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
