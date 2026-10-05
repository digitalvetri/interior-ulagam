import type { z } from 'zod';
import { CivilImportJobInput } from '@/types/civil';

/**
 * Per-row checks for a civil Excel import, reported the way the user sees the
 * sheet — by S.No and column — instead of a Zod path like `jobs.37.lines.2`.
 */

const FIELD_LABEL: Record<string, string> = {
  jobNo: 'S.No',
  jobDate: 'date',
  storeName: 'store name',
  heading: 'work heading',
  remark: 'remark',
  managerName: 'manager',
  billNo: 'bill no.',
  billDate: 'bill date',
  lines: 'amount lines',
  description: 'description',
  amountPaise: 'amount',
  kind: 'line type',
};

function friendlyMessage(issue: z.ZodIssue): string {
  const field = issue.path[issue.path.length - 1];
  if (field === 'amountPaise') {
    if (issue.code === 'too_small') return 'amount can’t be negative';
    if (issue.code === 'too_big') return 'amount is too large';
    if (issue.code === 'invalid_type') return 'amount is not a number';
  }
  return issue.message;
}

/** "S.No 37, line 3 amount: amount can’t be negative" style text for one issue. */
export function describeIssue(issue: z.ZodIssue, jobNo: number | undefined, rowIndex?: number): string {
  const path = [...issue.path];
  let where = jobNo !== undefined ? `S.No ${jobNo}` : rowIndex !== undefined ? `Row ${rowIndex + 1}` : 'A row';
  if (path[0] === 'lines' && typeof path[1] === 'number') {
    where += `, line ${path[1] + 1}`;
    path.splice(0, 2);
  }
  const key = path[path.length - 1];
  const label = typeof key === 'string' ? FIELD_LABEL[key] ?? key : undefined;
  return `${where}${label ? ` (${label})` : ''}: ${friendlyMessage(issue)}`;
}

export interface ImportRowProblem {
  jobNo: number;
  messages: string[];
}

/** Validates each job independently; returns one entry per bad row. */
export function findImportRowProblems(jobs: ReadonlyArray<unknown>): ImportRowProblem[] {
  const out: ImportRowProblem[] = [];
  jobs.forEach((job, i) => {
    const r = CivilImportJobInput.safeParse(job);
    if (r.success) return;
    const raw = (job as { jobNo?: unknown } | null)?.jobNo;
    const jobNo = typeof raw === 'number' ? raw : undefined;
    out.push({ jobNo: jobNo ?? i + 1, messages: r.error.issues.map((iss) => describeIssue(iss, jobNo, i)) });
  });
  return out;
}

/**
 * Server-side: turn a whole-payload Zod error (paths like `jobs.37.lines.2.amountPaise`)
 * into a readable message naming the S.No, listing up to `max` problems.
 */
export function describeImportError(err: z.ZodError, body: unknown, max = 5): string {
  const jobs = (body as { jobs?: unknown[] } | null)?.jobs;
  const msgs: string[] = [];
  for (const issue of err.issues) {
    if (msgs.length >= max) break;
    if (issue.path[0] === 'jobs' && typeof issue.path[1] === 'number') {
      const raw = (Array.isArray(jobs) ? jobs[issue.path[1]] as { jobNo?: unknown } | undefined : undefined)?.jobNo;
      const jobNo = typeof raw === 'number' ? raw : undefined;
      msgs.push(describeIssue({ ...issue, path: issue.path.slice(2) }, jobNo, issue.path[1]));
    } else {
      const path = issue.path.join('.');
      msgs.push(path ? `${path}: ${issue.message}` : issue.message);
    }
  }
  const more = err.issues.length - msgs.length;
  return msgs.join('; ') + (more > 0 ? `; and ${more} more problem${more === 1 ? '' : 's'}` : '');
}
