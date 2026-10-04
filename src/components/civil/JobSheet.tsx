import { Check } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { sumLines } from '@/lib/civil/totals';
import type { CivilJobStatus } from '@/types/civil';
import type { CivilJobDetail } from './types';
import { dmy } from './format';

const STEPS: { key: CivilJobStatus; label: string }[] = [
  { key: 'done', label: 'Done' },
  { key: 'billed', label: 'Billed' },
  { key: 'paid', label: 'Paid' },
];

/** When each reached stage happened: bill/paid dates where we have them, else the last status change. */
function stageDates(job: CivilJobDetail): Partial<Record<CivilJobStatus, string>> {
  const out: Partial<Record<CivilJobStatus, string>> = {};
  for (const e of job.events) out[e.toStatus] = e.createdAt;
  out.done ??= job.jobDate;
  if (job.billDate) out.billed = job.billDate;
  if (job.paidDate) out.paid = job.paidDate;
  return out;
}

/**
 * Read-only job sheet — what the office looks at most of the time. Laid out
 * like a bill: details, the work heading, the lines and the totals.
 */
export function JobSheet({ job }: { job: CivilJobDetail }) {
  const lines = job.lines.map(l => ({ ...l, amountPaise: Number(l.amountPaise) }));
  const totals = sumLines(lines);
  const reached = STEPS.findIndex(s => s.key === job.status);
  const dates = stageDates(job);

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

      {/* Progress */}
      <ol className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {STEPS.map((s, i) => {
          const done = i <= reached;
          const current = i === reached;
          return (
            <li key={s.key} className="flex items-center gap-2.5 px-4 py-3 sm:px-5"
              style={{
                background: current ? 'var(--accent-soft)' : 'transparent',
                borderRight: i < STEPS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={done
                  ? { background: 'var(--accent-base)', color: '#fff' }
                  : { border: '1.5px solid var(--border-strong)', color: 'var(--text-tertiary)' }}>
                {done && !current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold"
                  style={{ color: done ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>{s.label}</span>
                <span className="block truncate text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {done && dates[s.key] ? dmy(dates[s.key]) : '—'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Details */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Detail label="Job date" value={dmy(job.jobDate)} />
        <Detail label="Branch" value={job.branchName} sub={`${job.companyName} · ${job.cityName}`} />
        <Detail label="Manager" value={job.managerName ?? '—'} />
        <Detail
          label={job.paidDate ? 'Bill · Paid' : 'Bill'}
          value={job.billNo ?? 'Not billed yet'}
          sub={job.billNo ? `${dmy(job.billDate)}${job.paidDate ? ` · paid ${dmy(job.paidDate)}` : ''}` : undefined}
          muted={!job.billNo}
        />
      </dl>

      {/* Work */}
      <div className="px-5 pt-5">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>Work</p>
        <h2 className="mt-1 text-lg font-bold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
          {job.heading}
        </h2>
      </div>

      <div className="overflow-x-auto px-5 pb-5 pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th className="w-10 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>#</th>
              <th className="py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</th>
              <th className="w-28 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Type</th>
              <th className="w-32 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>No lines on this job.</td></tr>
            ) : lines.map((l, i) => (
              <tr key={l.id ?? i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2.5 tabular-nums text-xs" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                <td className="py-2.5 pr-4" style={{ color: 'var(--text-primary)' }}>{l.description}</td>
                <td className="py-2.5">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={l.kind === 'labour'
                      ? { background: 'var(--warning-soft)', color: 'var(--warning-text)' }
                      : { background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                    {l.kind === 'labour' ? 'Labour' : 'Material'}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--text-heading)' }}>
                  {formatRupees(l.amountPaise)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <TotalRow label="Material" paise={totals.materialPaise} />
            <TotalRow label="Labour" paise={totals.labourPaise} />
            <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
              <td colSpan={3} className="pt-3 text-right text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Total</td>
              <td className="pt-3 text-right text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {formatRupees(totals.totalPaise)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {job.remark && (
        <div className="px-5 pb-5">
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
            <span className="mr-2 text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Remark</span>
            {job.remark}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold" style={{ color: muted ? 'var(--text-tertiary)' : 'var(--text-heading)' }}>
        {value}
      </dd>
      {sub && <dd className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</dd>}
    </div>
  );
}

function TotalRow({ label, paise }: { label: string; paise: number }) {
  return (
    <tr>
      <td colSpan={3} className="pt-2 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</td>
      <td className="pt-2 text-right text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatRupees(paise)}</td>
    </tr>
  );
}
