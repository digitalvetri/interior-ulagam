'use client';

import { ChevronDown } from 'lucide-react';
import { CIVIL_JOB_STATUS_MAP } from '@/lib/status-maps';
import { STATUS_LABEL } from '@/lib/civil/status';
import { CIVIL_JOB_STATUSES, type CivilJobStatus } from '@/types/civil';

/**
 * The status pill, but it is a dropdown: pick Done / Billed / Paid right in
 * the list. The caller confirms the change (bill no., paid date) in its dialog.
 */
export function StatusSelect({ status, onPick, label }: {
  status: CivilJobStatus;
  onPick: (to: CivilJobStatus) => void;
  /** For screen readers, e.g. "Status of job 192". */
  label: string;
}) {
  const cfg = CIVIL_JOB_STATUS_MAP[status];
  return (
    <span className="relative inline-flex items-center" onClick={e => e.stopPropagation()}>
      <span className="pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      <select
        aria-label={label}
        value={status}
        onChange={e => onPick(e.target.value as CivilJobStatus)}
        className="cursor-pointer appearance-none rounded-full border-0 py-1 pl-6 pr-7 text-xs font-semibold outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--accent-base)]"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {CIVIL_JOB_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5" style={{ color: cfg.color }} />
    </span>
  );
}
