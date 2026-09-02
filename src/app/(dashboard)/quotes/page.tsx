'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Clock, CheckCircle2, Send, RefreshCw,
  Pencil, Download, Trash2, AlertTriangle,
} from 'lucide-react';
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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/ui/DataTable';

// Compound filter keys — 'approved_combined' covers approved+accepted,
// 'needs_attention' covers revised+rejected.
type FilterKey = 'all' | Quote['status'] | 'approved_combined' | 'needs_attention';

const KPI_CHIPS = [
  {
    key:   'draft' as FilterKey,
    label: 'Draft',
    Icon:  Clock,
    color: '#64748B',
    bg:    '#F1F5F9',
    match: (q: Quote) => q.status === 'draft',
  },
  {
    key:   'sent' as FilterKey,
    label: 'Sent',
    Icon:  Send,
    color: '#854D0E',
    bg:    '#FEF9C3',
    match: (q: Quote) => q.status === 'sent',
  },
  {
    key:   'approved_combined' as FilterKey,
    label: 'Approved',
    Icon:  CheckCircle2,
    color: 'var(--success-text)',
    bg:    'var(--success-soft)',
    match: (q: Quote) => q.status === 'approved' || q.status === 'accepted',
  },
  {
    key:   'needs_attention' as FilterKey,
    label: 'Needs Attention',
    Icon:  AlertTriangle,
    color: 'var(--danger)',
    bg:    'var(--danger-soft)',
    match: (q: Quote) => q.status === 'revised' || q.status === 'rejected',
  },
] as const;

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


export default function QuotesPage() {
  const router = useRouter();
  const [quotes,            setQuotes]            = useState<Quote[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [filterKey,         setFilterKey]         = useState<FilterKey>('all');
  const [dialogOpen,        setDialogOpen]        = useState(false);
  const [projects,          setProjects]          = useState<Project[]>([]);
  const [projectsLoading,   setProjectsLoading]   = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [copyFromQuoteId,   setCopyFromQuoteId]   = useState<string>('');
  const [creating,          setCreating]          = useState(false);
  const [createError,       setCreateError]       = useState<string | null>(null);

  // Delete state
  const [deleteTarget,  setDeleteTarget]  = useState<Quote | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

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
    setCopyFromQuoteId('');
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
      const { data: newQuote } = (await res.json()) as { data: Quote };

      // Copy line items from source quote if selected
      if (copyFromQuoteId) {
        try {
          const srcRes = await fetch(`/api/v1/quotes/${copyFromQuoteId}`);
          if (srcRes.ok) {
            const { data: srcQuote } = (await srcRes.json()) as { data: Quote };
            const srcLines = srcQuote?.lines ?? [];
            if (srcLines.length > 0) {
              await fetch(`/api/v1/quotes/${newQuote.id}/lines/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lines: srcLines.map(l => ({
                    room:            l.room,
                    item:            l.item,
                    unit:            l.unit,
                    qty:             l.qty,
                    costRatePaise:   l.costRatePaise,
                    clientRatePaise: l.clientRatePaise,
                  })),
                }),
              });
            }
          }
        } catch {
          // Non-fatal — quote is created; lines can be added manually
        }
      }

      setDialogOpen(false);
      router.push(`/quotes/${newQuote.id}`);
    } catch {
      setCreateError('Network error — please try again');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed — please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredQuotes = (() => {
    if (filterKey === 'all') return quotes;
    const chip = KPI_CHIPS.find(c => c.key === filterKey);
    return chip ? quotes.filter(chip.match) : quotes;
  })();

  const totalValue    = quotes.reduce((sum, q) => sum + (q.totalPaise ?? 0), 0);
  const approvedCount = quotes.filter((q) => q.status === 'accepted' || q.status === 'approved').length;
  const draftCount    = quotes.filter((q) => q.status === 'draft').length;

  const deleteTargetLabel = deleteTarget
    ? `Q-${deleteTarget.version.toString().padStart(3, '0')} — ${deleteTarget.projectName ?? deleteTarget.leadContactName ?? 'No project'}`
    : '';
  const deleteIsRisky = deleteTarget?.status === 'sent' || deleteTarget?.status === 'accepted' || deleteTarget?.status === 'approved';

  return (
    <div className="space-y-5">
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

      {/* Compact KPI chips — single row, click to filter */}
      {quotes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {KPI_CHIPS.map((chip) => {
            const count  = quotes.filter(chip.match).length;
            const active = filterKey === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilterKey(active ? 'all' : chip.key)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium border transition-colors"
                style={
                  active
                    ? { background: chip.bg, color: chip.color, borderColor: chip.color }
                    : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                }
              >
                <chip.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {chip.label}
                <span
                  className="tabular-nums font-bold"
                  style={{ color: active ? chip.color : 'var(--text-heading)' }}
                >
                  {count}
                </span>
              </button>
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
            style={{ background: 'var(--violet-soft)' }}>
            <FileText className="h-7 w-7" style={{ color: 'var(--accent-base)' }} />
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
      ) : (() => {
        const quoteColumns: Column<Quote>[] = [
          {
            key: 'number',
            header: 'Quote #',
            render: (q) => <QuoteNumberBadge version={q.version} id={q.id} />,
          },
          {
            key: 'project',
            header: 'Project',
            render: (q) => q.projectName ?? q.leadContactName ?? (
              q.projectId
                ? <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{q.projectId.slice(0, 8)}…</span>
                : <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pre-sale estimate</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (q) => <StatusBadge module="quotes" status={q.status} />,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            render: (q) => (
              <span className="font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(q.totalPaise)}
              </span>
            ),
          },
          {
            key: 'date',
            header: 'Date',
            render: (q) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                {new Date(q.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: 'w-28',
            render: (q) => (
              <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Open & edit quotation"
                  onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${q.id}`); }}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all hover:opacity-70"
                  style={{ color: 'var(--accent-base)' }}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {q.pdfUrl ? (
                  <a href={q.pdfUrl} target="_blank" rel="noreferrer" title="Download PDF"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all hover:opacity-70"
                    style={{ color: 'var(--accent-text)' }}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span title="No PDF yet — open the quote to generate one"
                    className="inline-flex items-center justify-center rounded-lg p-1.5"
                    style={{ color: 'var(--border-strong)', cursor: 'not-allowed' }}>
                    <Download className="h-3.5 w-3.5" />
                  </span>
                )}
                <button type="button" title="Delete quotation"
                  onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(q); }}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all hover:opacity-70"
                  style={{ color: 'var(--danger)' }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          },
        ];

        return (
          <div className="flex flex-col gap-0">
            <DataTable
              columns={quoteColumns}
              rows={filteredQuotes}
              getRowKey={(q) => q.id}
              onRowClick={(q) => router.push(`/quotes/${q.id}`)}
            />
            <div
              className="flex items-center justify-between px-4 py-3 rounded-b-2xl"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {filterKey !== 'all'
                  ? <>{filteredQuotes.length} of {quotes.length} quotes <button type="button" onClick={() => setFilterKey('all')} className="ml-1 underline" style={{ color: 'var(--accent-base)' }}>Clear filter</button></>
                  : <>{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</>
                }
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                Pipeline total: {formatRupees(totalValue)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── New Quote Dialog ───────────────────────────────────────────────── */}
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

            {quotes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="quote-copy-from">
                  Copy line items from
                  <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                </Label>
                <Select value={copyFromQuoteId || '__blank__'} onValueChange={v => setCopyFromQuoteId(v === '__blank__' ? '' : v)}>
                  <SelectTrigger id="quote-copy-from">
                    <SelectValue placeholder="Start blank…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__blank__">Start blank</SelectItem>
                    {quotes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        Q-{q.version.toString().padStart(3, '0')} · {q.projectName ?? q.leadContactName ?? q.id.slice(0, 8)} · {q.status.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {createError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button type="button" className="btn-primary px-4 py-2" onClick={handleCreateQuote} disabled={creating || projectsLoading}>
              {creating ? 'Creating…' : 'Create Quote'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" style={{ color: 'var(--danger)' }} />
              Delete Quotation?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You are about to permanently delete{' '}
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{deleteTargetLabel}</span>.
              This will also remove all line items. This action cannot be undone.
            </p>

            {/* Extra warning for sent / approved quotes */}
            {deleteIsRisky && (
              <div className="flex items-start gap-3 rounded-xl p-3.5"
                style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-soft)' }}>
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--warning-text)' }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--warning-text)' }}>
                    This quote has been {deleteTarget?.status}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--warning-text)' }}>
                    Deleting a {deleteTarget?.status} quotation may affect your records and client expectations.
                    Consider marking it as &quot;Revised&quot; instead.
                  </p>
                </div>
              </div>
            )}

            {deleteError && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              disabled={deleting}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--danger)' }}>
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
