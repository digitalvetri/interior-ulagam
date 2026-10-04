'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Banknote, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';

interface PayrollRun {
  id: string;
  month: string;
  status: 'draft' | 'approved' | 'paid';
  workingDays: number;
  totalGrossPaise: number;
  totalNetPaise: number;
  totalCostPaise: number;
  notes: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<PayrollRun['status'], { label: string; bg: string; fg: string }> = {
  draft:    { label: 'Draft',    bg: 'var(--surface-muted)', fg: 'var(--text-secondary)' },
  approved: { label: 'Approved', bg: 'rgba(15,157,110,0.10)', fg: '#0F6E4A' },
  paid:     { label: 'Paid',     bg: 'rgba(30,64,175,0.10)', fg: '#1E40AF' },
};

function monthLabel(m: string) {
  const [year, mon] = m.split('-');
  return new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Returns the current month in YYYY-MM format
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PayrollPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMonth, setFormMonth] = useState(currentMonth());
  const [formWorkingDays, setFormWorkingDays] = useState('26');
  const [formNotes, setFormNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/payroll/runs');
      const json = await res.json() as { data: PayrollRun[] };
      setRuns(json.data ?? []);
    } catch {
      setError('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openDialog() {
    setFormMonth(currentMonth());
    setFormWorkingDays('26');
    setFormNotes('');
    setCreateError(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    const workingDays = Number(formWorkingDays);
    if (!formMonth || isNaN(workingDays) || workingDays < 1) {
      setCreateError('Please fill in all required fields.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: formMonth, workingDays, notes: formNotes || undefined }),
      });
      const json = await res.json() as { data?: PayrollRun; error?: string };
      if (!res.ok) {
        setCreateError(typeof json.error === 'string' ? json.error : 'Failed to create run');
        return;
      }
      setDialogOpen(false);
      await load();
      if (json.data?.id) router.push(`/payroll/${json.data.id}`);
    } catch {
      setCreateError('Network error — please try again.');
    } finally {
      setCreating(false);
    }
  }

  const totalMonthlyNet = runs.filter(r => r.status !== 'draft').reduce((s, r) => s + r.totalNetPaise, 0);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
            Payroll
          </h1>
          {!loading && runs.length > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              {runs.length}
            </span>
          )}
        </div>
        <button type="button" onClick={openDialog}
          className="btn-primary inline-flex items-center gap-2 px-3.5 py-2 text-[13px]">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Run Payroll
        </button>
      </div>

      {/* Summary KPI */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total Runs</p>
            <p className="text-[22px] font-bold tnum" style={{ color: 'var(--text-heading)' }}>{runs.length}</p>
          </div>
          <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Approved / Paid</p>
            <p className="text-[22px] font-bold tnum" style={{ color: 'var(--accent-base)' }}>
              {runs.filter(r => r.status !== 'draft').length}
            </p>
          </div>
          <div className="rounded-xl p-3.5 col-span-2 sm:col-span-1" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total Net Paid</p>
            <p className="text-[18px] font-bold tnum leading-tight" style={{ color: 'var(--text-heading)' }}>
              {totalMonthlyNet > 0 ? formatRupees(totalMonthlyNet) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-[13px]" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && runs.length === 0 && (
        <div className="premium-card flex flex-col items-center justify-center gap-3 p-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
            <Banknote className="h-5 w-5" style={{ color: 'var(--accent-base)' }} strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>No payroll runs yet</p>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            Click &ldquo;Run Payroll&rdquo; to calculate salaries for a month.
          </p>
          <button type="button" onClick={openDialog}
            className="btn-primary mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Run Payroll
          </button>
        </div>
      )}

      {/* Runs list */}
      {!error && (
        loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-4 animate-pulse h-20"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }} />
            ))}
          </div>
        ) : runs.length > 0 ? (
          <div className="space-y-3">
            {runs.map(run => {
              const s = STATUS_STYLE[run.status];
              return (
                <button key={run.id} type="button"
                  onClick={() => router.push(`/payroll/${run.id}`)}
                  className="w-full rounded-2xl p-4 text-left transition-shadow"
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,20,15,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                        style={{ background: s.bg, color: s.fg }}>
                        {s.label}
                      </span>
                      <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                        {monthLabel(run.month)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Net Pay</p>
                        <p className="text-[14px] font-bold tnum" style={{ color: 'var(--text-heading)' }}>
                          {formatRupees(run.totalNetPaise)}
                        </p>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total Cost</p>
                        <p className="text-[14px] font-bold tnum" style={{ color: 'var(--text-secondary)' }}>
                          {formatRupees(run.totalCostPaise)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {run.workingDays} working days
                    </p>
                    <span style={{ color: 'var(--border-subtle)' }}>·</span>
                    <p className="text-[12px] font-bold tnum sm:hidden" style={{ color: 'var(--text-heading)' }}>
                      {formatRupees(run.totalNetPaise)} net
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null
      )}

      {/* Create Run Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                Month <span style={{ color: 'var(--accent-base)' }}>*</span>
              </label>
              <input
                type="month"
                value={formMonth}
                onChange={e => setFormMonth(e.target.value)}
                className="studio-input w-full h-9 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>
                Working days <span style={{ color: 'var(--accent-base)' }}>*</span>
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={formWorkingDays}
                onChange={e => setFormWorkingDays(e.target.value)}
                className="studio-input w-full h-9 text-[13px] tnum"
                placeholder="26"
              />
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Exclude public holidays from the working day count.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>Notes</label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="studio-input w-full text-[13px] resize-none"
                placeholder="Optional note for this run…"
              />
            </div>
            {createError && (
              <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {createError}
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} disabled={creating}
              className="inline-flex items-center px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} disabled={creating}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50">
              {creating ? 'Calculating…' : (
                <><Plus className="h-3.5 w-3.5" strokeWidth={2.25} />Calculate</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
