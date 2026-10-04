'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRupees } from '@/lib/utils';
import type { CivilJobStatus, CivilStatusChangeInput } from '@/types/civil';
import { CivilStatusBadge } from './CivilStatusBadge';
import { StatusActionDialog } from './StatusActionDialog';
import { StatusSelect } from './StatusSelect';
import { apiError, dmy } from './format';
import type { CivilJobRow } from './types';

const RANK: Record<CivilJobStatus, number> = { done: 0, billed: 1, paid: 2 };

interface Props {
  jobs: CivilJobRow[];
  showBranch?: boolean;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  /** When given, the status column becomes a dropdown; called after a change is saved. */
  onStatusChanged?: () => void;
}

/** The job register, laid out like the office's Excel sheet. Empty state is the caller's. */
export function JobsTable({ jobs, showBranch = true, selectable = false, selected, onToggle, onToggleAll, onStatusChanged }: Props) {
  const router = useRouter();
  const [change, setChange] = useState<{ job: CivilJobRow; to: CivilJobStatus } | null>(null);

  async function saveStatus(body: CivilStatusChangeInput): Promise<string | null> {
    if (!change) return null;
    const res = await fetch(`/api/v1/civil/jobs/${change.job.id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) return apiError(res, 'Could not change the status.');
    onStatusChanged?.();
    return null;
  }
  const total = jobs.reduce((s, j) => s + Number(j.totalPaise), 0);
  const allSelected = selectable && jobs.length > 0 && jobs.every(j => selected?.has(j.id));

  const headers = ['S.No', 'Date', ...(showBranch ? ['Branch'] : []), 'Work', 'Total', 'Manager', 'Status'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox" aria-label="Select all jobs" checked={allSelected}
                  onChange={() => onToggleAll?.()} className="h-4 w-4 cursor-pointer accent-[var(--accent-base)]"
                />
              </th>
            )}
            {headers.map(h => (
              <th key={h}
                className={`px-4 py-3 text-xs font-semibold tracking-wide ${h === 'Total' ? 'text-right' : 'text-left'}`}
                style={{ color: 'var(--text-secondary)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j, idx) => {
            const isSelected = selected?.has(j.id) ?? false;
            return (
              <tr key={j.id}
                className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                style={{
                  borderBottom: idx < jobs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  borderLeft: '3px solid var(--accent-base)',
                  background: isSelected ? 'var(--accent-soft)' : undefined,
                }}
                onClick={() => router.push(`/civil/jobs/${j.id}`)}>

                {selectable && (
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox" aria-label={`Select job ${j.jobNo}`} checked={isSelected}
                      onChange={() => onToggle?.(j.id)} className="h-4 w-4 cursor-pointer accent-[var(--accent-base)]"
                    />
                  </td>
                )}

                <td className="px-4 py-3.5 tabular-nums font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {j.jobNo}
                </td>

                <td className="px-4 py-3.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {dmy(j.jobDate)}
                </td>

                {showBranch && (
                  <td className="px-4 py-3.5">
                    <p className="font-medium" style={{ color: 'var(--accent-base)' }}>
                      {j.companyName} {j.branchName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.cityName}</p>
                  </td>
                )}

                <td className="px-4 py-3.5 min-w-[220px]">
                  <p className="text-xs font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--text-heading)' }}>
                    {j.heading}
                  </p>
                  <p className="mt-0.5 text-xs line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                    {j.remark ?? `${j.lineCount} line${j.lineCount === 1 ? '' : 's'}`}
                  </p>
                </td>

                <td className="px-4 py-3.5 text-right tabular-nums font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-heading)' }}>
                  {formatRupees(Number(j.totalPaise))}
                </td>

                <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                  {j.managerName ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>

                <td className="px-4 py-3.5 whitespace-nowrap">
                  {onStatusChanged ? (
                    <StatusSelect status={j.status} label={`Status of job ${j.jobNo}`}
                      onPick={to => { if (to !== j.status) setChange({ job: j, to }); }} />
                  ) : (
                    <CivilStatusBadge status={j.status} />
                  )}
                  {(j.status === 'billed' || j.status === 'paid') && j.billNo && (
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Bill {j.billNo}</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-5 py-2 text-xs"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-tertiary)' }}>
        {jobs.length} job{jobs.length !== 1 ? 's' : ''} ·{' '}
        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(total)}</span>
      </div>

      <StatusActionDialog
        to={change?.to ?? null}
        subject={change ? `Job #${change.job.jobNo}` : ''}
        billNo={change?.job.billNo}
        billDate={change?.job.billDate}
        clearsBilling={!!change && RANK[change.to] < RANK[change.job.status]}
        onClose={() => setChange(null)}
        onConfirm={saveStatus}
      />
    </div>
  );
}
