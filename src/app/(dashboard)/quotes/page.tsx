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

const STATUS_CONFIG: Record<Quote['status'], { label: string; icon: React.ElementType; bg: string; color: string }> = {
  draft:    { label: 'Draft',    icon: Clock,        bg: '#F1F5F9', color: '#64748B' },
  sent:     { label: 'Sent',     icon: Send,         bg: '#FEF9C3', color: '#854D0E' },
  approved: { label: 'Approved', icon: CheckCircle2, bg: 'var(--success-soft)', color: 'var(--success-text)' },
  accepted: { label: 'Accepted', icon: CheckCircle2, bg: 'var(--success-soft)', color: 'var(--success-text)' },
  revised:  { label: 'Revised',  icon: RefreshCw,    bg: 'var(--warning-soft)', color: '#92400E' },
  rejected: { label: 'Rejected', icon: AlertTriangle, bg: 'var(--danger-soft)', color: 'var(--danger)' },
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
  const cfg  = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes,            setQuotes]            = useState<Quote[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [filterStatus,      setFilterStatus]      = useState<Quote['status'] | 'all'>('all');
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

  const filteredQuotes = filterStatus === 'all' ? quotes : quotes.filter(q => q.status === filterStatus);
  const totalValue    = quotes.reduce((sum, q) => sum + (q.totalPaise ?? 0), 0);
  const approvedCount = quotes.filter((q) => q.status === 'approved').length;
  const draftCount    = quotes.filter((q) => q.status === 'draft').length;

  const deleteTargetLabel = deleteTarget
    ? `Q-${deleteTarget.version.toString().padStart(3, '0')} — ${deleteTarget.projectName ?? deleteTarget.leadContactName ?? 'No project'}`
    : '';
  const deleteIsRisky = deleteTarget?.status === 'sent' || deleteTarget?.status === 'approved';

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

      {/* Summary cards — clickable to filter */}
      {quotes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(STATUS_CONFIG) as Array<Quote['status']>).map((status) => {
            const cfg    = STATUS_CONFIG[status];
            const Icon   = cfg.icon;
            const count  = quotes.filter((q) => q.status === status).length;
            const value  = quotes.filter((q) => q.status === status).reduce((s, q) => s + (q.totalPaise ?? 0), 0);
            const active = filterStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(active ? 'all' : status)}
                className="premium-card p-4 text-left transition-all"
                style={active ? { outline: `2px solid ${cfg.color}`, outlineOffset: 2 } : undefined}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: cfg.bg }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                  </span>
                  <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>{count}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatRupees(value)}</p>
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
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="group transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={() => router.push(`/quotes/${quote.id}`)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-muted)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>

                    <td className="px-4 py-3">
                      <QuoteNumberBadge version={quote.version} id={quote.id} />
                    </td>

                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      {quote.projectName ?? quote.leadContactName ?? (
                        quote.projectId
                          ? <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{quote.projectId.slice(0, 8)}…</span>
                          : <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pre-sale estimate</span>
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

                    {/* Actions column */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Edit — navigate to detail */}
                        <button
                          type="button"
                          title="Open & edit quotation"
                          onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${quote.id}`); }}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all"
                          style={{ color: 'var(--accent-base)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Download PDF */}
                        {quote.pdfUrl ? (
                          <a
                            href={quote.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Download PDF"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all"
                            style={{ color: 'var(--accent-text)' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-soft)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ''; }}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span
                            title="No PDF yet — open the quote to generate one"
                            className="inline-flex items-center justify-center rounded-lg p-1.5"
                            style={{ color: 'var(--border-strong)', cursor: 'not-allowed' }}>
                            <Download className="h-3.5 w-3.5" />
                          </span>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          title="Delete quotation"
                          onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(quote); }}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 transition-all"
                          style={{ color: 'var(--danger)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-soft)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {filterStatus !== 'all'
                ? <>{filteredQuotes.length} of {quotes.length} quotes <button type="button" onClick={() => setFilterStatus('all')} className="ml-1 underline" style={{ color: 'var(--accent-base)' }}>Clear filter</button></>
                : <>{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</>
              }
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              Pipeline total: {formatRupees(totalValue)}
            </span>
          </div>
        </div>
      )}

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

