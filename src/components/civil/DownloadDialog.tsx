'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatRupees } from '@/lib/utils';
import { CIVIL_JOB_STATUSES, type CivilJobStatus } from '@/types/civil';
import { STATUS_LABEL } from '@/lib/civil/status';
import type { CivilJobRow } from './types';
import { PeriodPicker, usePeriod } from './PeriodPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Who the download is for, e.g. "Dmart Thudiyalur". */
  title: string;
  /** Fixed filters from the page: branchId, companyId, cityId, managerId, q… */
  filters: Record<string, string | undefined>;
}

/**
 * Download a branch's (or company's) work for a day, a month or any range, as
 * Excel or a printable PDF statement. Shows how many jobs and how much money is
 * in the chosen period before anything downloads.
 */
export function DownloadDialog({ open, onClose, title, filters }: Props) {
  const periodState = usePeriod();
  const { range, period } = periodState;
  const [status, setStatus] = useState<CivilJobStatus | ''>('');

  const [preview, setPreview] = useState<{ count: number; totalPaise: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    if (!range) return null;
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    p.set('from', range.from);
    p.set('to', range.to);
    if (status) p.set('status', status);
    return p.toString();
  }, [filters, range, status]);

  useEffect(() => {
    if (!open || !query) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/civil/jobs?${query}&limit=1000`)
        .then(r => r.json())
        .then((j: { data?: CivilJobRow[] }) => {
          if (cancelled) return;
          const rows = j.data ?? [];
          setPreview({ count: rows.length, totalPaise: rows.reduce((s, r) => s + Number(r.totalPaise), 0) });
        })
        .catch(() => { if (!cancelled) setPreview(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, query]);

  const empty = !loading && preview?.count === 0;
  const ready = !!query && !loading && !!preview && preview.count > 0;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download work</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{title}</p>

        {/* Period */}
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Which period?</p>
          <PeriodPicker state={periodState} />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Which jobs?</p>
          <div className="flex flex-wrap gap-1.5">
            {(['', ...CIVIL_JOB_STATUSES] as const).map(s => {
              const on = status === s;
              return (
                <button key={s || 'all'} type="button" onClick={() => setStatus(s)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                  style={on
                    ? { background: 'var(--accent-base)', color: '#fff', borderColor: 'var(--accent-base)' }
                    : { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}>
                  {s ? STATUS_LABEL[s] : 'All jobs'}
                </button>
              );
            })}
          </div>
        </div>

        {/* What you'll get */}
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)' }}>
          {!range ? (
            <p className="text-sm" style={{ color: 'var(--danger-text)' }}>Choose a valid date{period === 'range' ? ' range' : ''}.</p>
          ) : loading || !preview ? (
            <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />Checking {range.label}…
            </p>
          ) : empty ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No jobs in {range.label}.</p>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {range.label} · <b style={{ color: 'var(--text-heading)' }}>{preview.count} job{preview.count !== 1 ? 's' : ''}</b>
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(preview.totalPaise)}
              </span>
            </div>
          )}
        </div>

        {/* Download */}
        <div className="grid grid-cols-2 gap-2">
          <DownloadLink href={ready ? `/api/v1/civil/export?${query}` : null} icon={FileSpreadsheet} label="Excel" sub="to edit or keep" />
          <DownloadLink href={ready ? `/api/v1/civil/export/pdf?${query}` : null} icon={FileText} label="PDF" sub="to print or send" primary />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DownloadLink({ href, icon: Icon, label, sub, primary }: {
  href: string | null; icon: React.ElementType; label: string; sub: string; primary?: boolean;
}) {
  const cls = `${primary ? 'btn-primary' : 'btn-secondary'} flex items-center justify-center gap-2.5 px-4 py-3 text-sm`;
  const body = (
    <>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-left leading-tight">
        <span className="block font-semibold">Download {label}</span>
        <span className="block text-[11px] opacity-80">{sub}</span>
      </span>
    </>
  );
  if (!href) return <span className={`${cls} pointer-events-none opacity-50`} aria-disabled>{body}</span>;
  return <a href={href} download className={cls}>{body}</a>;
}

/** The button pages put in their header. */
export function DownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
      <Download className="h-4 w-4" />Download
    </button>
  );
}
