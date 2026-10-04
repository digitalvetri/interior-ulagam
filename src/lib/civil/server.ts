import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  civilBranches, civilCities, civilCompanies, civilJobLines, civilJobs, civilManagers,
} from '@/lib/db/schema';
import { CIVIL_JOB_STATUSES, type CivilJobLineInput } from '@/types/civil';

// Shared plumbing for the /api/v1/civil routes. Auth and role checks stay in
// each handler (the tenant-isolation and role-enforcement tests read them there).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

export function invalid(err: z.ZodError): NextResponse {
  const first = err.issues[0];
  const path = first?.path.join('.');
  const message = first ? (path ? `${path}: ${first.message}` : first.message) : 'Validation error';
  return NextResponse.json({ error: message, details: err.flatten() }, { status: 422 });
}

export function serverError(tag: string, err: unknown): NextResponse {
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return undefined; }
}

/** Postgres unique_violation, unwrapped from Drizzle's error wrapper. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505') return true;
    e = typeof e === 'object' && e !== null && 'cause' in e ? (e as { cause: unknown }).cause : undefined;
  }
  return false;
}

/** Postgres foreign_key_violation — a delete blocked by rows that still point at it. */
export function isForeignKeyViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23503') return true;
    e = typeof e === 'object' && e !== null && 'cause' in e ? (e as { cause: unknown }).cause : undefined;
  }
  return false;
}

// ── Tenant ownership checks — a foreign key does not know about tenants ──────

export async function ownsCompany(tenantId: string, id: string, tx: Db = db): Promise<boolean> {
  const [row] = await tx.select({ id: civilCompanies.id }).from(civilCompanies)
    .where(and(eq(civilCompanies.id, id), eq(civilCompanies.tenantId, tenantId))).limit(1);
  return !!row;
}

export async function ownsCity(tenantId: string, id: string, tx: Db = db): Promise<boolean> {
  const [row] = await tx.select({ id: civilCities.id }).from(civilCities)
    .where(and(eq(civilCities.id, id), eq(civilCities.tenantId, tenantId))).limit(1);
  return !!row;
}

export async function ownsBranch(tenantId: string, id: string, tx: Db = db): Promise<boolean> {
  const [row] = await tx.select({ id: civilBranches.id }).from(civilBranches)
    .where(and(eq(civilBranches.id, id), eq(civilBranches.tenantId, tenantId))).limit(1);
  return !!row;
}

export async function ownsManager(tenantId: string, id: string, tx: Db = db): Promise<boolean> {
  const [row] = await tx.select({ id: civilManagers.id }).from(civilManagers)
    .where(and(eq(civilManagers.id, id), eq(civilManagers.tenantId, tenantId))).limit(1);
  return !!row;
}

/** Find a city by name (case-insensitive) or create it. */
export async function findOrCreateCity(tenantId: string, name: string, tx: Db = db): Promise<string> {
  const clean = name.trim();
  const [existing] = await tx.select({ id: civilCities.id }).from(civilCities)
    .where(and(eq(civilCities.tenantId, tenantId), sql`lower(${civilCities.name}) = lower(${clean})`)).limit(1);
  if (existing) return existing.id;
  const [created] = await tx.insert(civilCities).values({ tenantId, name: clean })
    .onConflictDoNothing().returning({ id: civilCities.id });
  if (created) return created.id;
  // Lost a race with a concurrent insert of the same name.
  const [again] = await tx.select({ id: civilCities.id }).from(civilCities)
    .where(and(eq(civilCities.tenantId, tenantId), sql`lower(${civilCities.name}) = lower(${clean})`)).limit(1);
  return again.id;
}

/** Next job number: one past the highest, so new jobs continue the Excel S.No. */
export async function nextJobNo(tenantId: string, tx: Db = db): Promise<number> {
  const [row] = await tx.select({ max: sql<number | null>`max(${civilJobs.jobNo})` })
    .from(civilJobs).where(eq(civilJobs.tenantId, tenantId));
  return Number(row?.max ?? 0) + 1;
}

/**
 * Make the job's lines match `lines`. Lines that come back with their id are
 * updated in place, so the private real cost entered on them survives an edit.
 */
export async function syncLines(
  tx: Tx, tenantId: string, jobId: string, lines: readonly CivilJobLineInput[],
): Promise<void> {
  const existing = new Set((await tx.select({ id: civilJobLines.id }).from(civilJobLines)
    .where(and(eq(civilJobLines.jobId, jobId), eq(civilJobLines.tenantId, tenantId)))).map(r => r.id));
  const kept = lines.map(l => l.id).filter((id): id is string => !!id && existing.has(id));

  await tx.delete(civilJobLines).where(and(
    eq(civilJobLines.jobId, jobId), eq(civilJobLines.tenantId, tenantId),
    kept.length ? notInArray(civilJobLines.id, kept) : undefined,
  ));

  for (const [position, l] of lines.entries()) {
    const fields = { description: l.description, kind: l.kind, amountPaise: l.amountPaise, position };
    if (l.id && existing.has(l.id)) {
      await tx.update(civilJobLines).set(fields)
        .where(and(eq(civilJobLines.id, l.id), eq(civilJobLines.tenantId, tenantId)));
    } else {
      await tx.insert(civilJobLines).values({ tenantId, jobId, ...fields });
    }
  }
  await recomputeJobCost(tx, tenantId, jobId);
}

/** Refresh the cached civil_jobs.cost_paise from line costs + unbilled costs. */
export async function recomputeJobCost(tx: Tx, tenantId: string, jobId: string): Promise<number> {
  const [row] = await tx.select({
    lineCost: sql<number>`coalesce((select sum(cost_paise) from civil_job_lines where job_id = ${jobId} and tenant_id = ${tenantId}), 0)::bigint`,
    extraCost: sql<number>`coalesce((select sum(amount_paise) from civil_job_costs where job_id = ${jobId} and tenant_id = ${tenantId}), 0)::bigint`,
  }).from(sql`(select 1) as one`);
  const costPaise = Number(row?.lineCost ?? 0) + Number(row?.extraCost ?? 0);
  await tx.update(civilJobs).set({ costPaise })
    .where(and(eq(civilJobs.id, jobId), eq(civilJobs.tenantId, tenantId)));
  return costPaise;
}

/** Job rows with branch, company, city and manager names — the shape every list renders. */
export function jobListQuery(tenantId: string, conditions: (SQL | undefined)[] = []) {
  return db
    .select({
      id: civilJobs.id,
      jobNo: civilJobs.jobNo,
      jobDate: civilJobs.jobDate,
      heading: civilJobs.heading,
      remark: civilJobs.remark,
      status: civilJobs.status,
      billNo: civilJobs.billNo,
      billDate: civilJobs.billDate,
      paidDate: civilJobs.paidDate,
      totalPaise: civilJobs.totalPaise,
      branchId: civilJobs.branchId,
      branchName: civilBranches.name,
      companyId: civilCompanies.id,
      companyName: civilCompanies.name,
      cityId: civilCities.id,
      cityName: civilCities.name,
      managerId: civilJobs.managerId,
      managerName: civilManagers.name,
      lineCount: sql<number>`(select count(*)::int from civil_job_lines l where l.job_id = ${civilJobs.id})`,
    })
    .from(civilJobs)
    .innerJoin(civilBranches, eq(civilBranches.id, civilJobs.branchId))
    .innerJoin(civilCompanies, eq(civilCompanies.id, civilBranches.companyId))
    .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
    .leftJoin(civilManagers, eq(civilManagers.id, civilJobs.managerId))
    .where(and(eq(civilJobs.tenantId, tenantId), ...conditions))
    .$dynamic();
}

export interface BranchStats {
  jobCount: number;
  doneCount: number;
  donePaise: number;
  billedPaise: number;
}

/** Per-branch counts and money, the numbers behind every company and branch card. */
export async function branchStats(tenantId: string): Promise<Map<string, BranchStats>> {
  const rows = await db
    .select({
      branchId: civilJobs.branchId,
      jobCount: sql<number>`count(*)::int`,
      doneCount: sql<number>`count(*) filter (where ${civilJobs.status} = 'done')::int`,
      donePaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (where ${civilJobs.status} = 'done'), 0)::bigint`,
      billedPaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (where ${civilJobs.status} = 'billed'), 0)::bigint`,
    })
    .from(civilJobs)
    .where(eq(civilJobs.tenantId, tenantId))
    .groupBy(civilJobs.branchId);
  return new Map(rows.map(r => [r.branchId, {
    jobCount: Number(r.jobCount), doneCount: Number(r.doneCount),
    donePaise: Number(r.donePaise), billedPaise: Number(r.billedPaise),
  }]));
}

export const EMPTY_STATS: BranchStats = { jobCount: 0, doneCount: 0, donePaise: 0, billedPaise: 0 };

export function addStats(a: BranchStats, b: BranchStats): BranchStats {
  return {
    jobCount: a.jobCount + b.jobCount,
    doneCount: a.doneCount + b.doneCount, donePaise: a.donePaise + b.donePaise,
    billedPaise: a.billedPaise + b.billedPaise,
  };
}

const JobFilters = z.object({
  status: z.enum(CIVIL_JOB_STATUSES).optional(),
  companyId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** Inclusive job-date range, yyyy-mm-dd — a single day is from = to. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(100).optional(),
});

/** ?status=&companyId=&cityId=&branchId=&managerId=&month=yyyy-mm&q= → WHERE conditions. */
export function jobFilterConditions(params: URLSearchParams): { ok: true; conditions: SQL[] } | { ok: false; error: string } {
  const raw = Object.fromEntries([...params.entries()].filter(([, v]) => v !== ''));
  const parsed = JobFilters.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid filter' };
  const f = parsed.data;
  const conditions: SQL[] = [];
  if (f.status) conditions.push(eq(civilJobs.status, f.status));
  if (f.companyId) conditions.push(eq(civilBranches.companyId, f.companyId));
  if (f.cityId) conditions.push(eq(civilBranches.cityId, f.cityId));
  if (f.branchId) conditions.push(eq(civilJobs.branchId, f.branchId));
  if (f.managerId) conditions.push(eq(civilJobs.managerId, f.managerId));
  if (f.month) conditions.push(sql`to_char(${civilJobs.jobDate}, 'YYYY-MM') = ${f.month}`);
  if (f.from) conditions.push(sql`${civilJobs.jobDate} >= ${f.from}`);
  if (f.to) conditions.push(sql`${civilJobs.jobDate} <= ${f.to}`);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    const numeric = /^\d+$/.test(f.q) ? Number(f.q) : null;
    conditions.push(sql`(
      ${civilJobs.heading} ilike ${like} or ${civilJobs.remark} ilike ${like} or ${civilJobs.billNo} ilike ${like}
      or exists (select 1 from civil_job_lines l where l.job_id = ${civilJobs.id} and l.description ilike ${like})
      ${numeric !== null ? sql`or ${civilJobs.jobNo} = ${numeric}` : sql``}
    )`);
  }
  return { ok: true, conditions };
}

export type CivilJobListRow = Awaited<ReturnType<ReturnType<typeof jobListQuery>['execute']>>[number];

export interface CivilJobWithLines extends CivilJobListRow {
  lines: { description: string; kind: 'material' | 'labour'; amountPaise: number }[];
}

/** Jobs matching the filters, oldest first, each with its lines — what the downloads are built from. */
export async function jobsWithLines(tenantId: string, conditions: SQL[]): Promise<CivilJobWithLines[]> {
  const jobs = await jobListQuery(tenantId, conditions)
    .orderBy(asc(civilJobs.jobDate), asc(civilJobs.jobNo))
    .limit(5000);
  if (!jobs.length) return [];
  const lines = await db.select({
    jobId: civilJobLines.jobId, description: civilJobLines.description,
    kind: civilJobLines.kind, amountPaise: civilJobLines.amountPaise,
  }).from(civilJobLines)
    .where(and(eq(civilJobLines.tenantId, tenantId), inArray(civilJobLines.jobId, jobs.map(j => j.id))))
    .orderBy(asc(civilJobLines.jobId), asc(civilJobLines.position));
  const byJob = new Map<string, CivilJobWithLines['lines']>();
  for (const l of lines) {
    const list = byJob.get(l.jobId) ?? [];
    list.push({ description: l.description, kind: l.kind, amountPaise: Number(l.amountPaise) });
    byJob.set(l.jobId, list);
  }
  return jobs.map(j => ({ ...j, totalPaise: Number(j.totalPaise), lines: byJob.get(j.id) ?? [] }));
}

/** "Dmart-Thudiyalur_2026-09" — a readable file name for a download. */
export function downloadName(jobs: CivilJobListRow[], params: URLSearchParams): string {
  const branches = new Set(jobs.map(j => j.branchId));
  const companies = new Set(jobs.map(j => j.companyId));
  const who = branches.size === 1 ? `${jobs[0].companyName}-${jobs[0].branchName}`
    : companies.size === 1 ? jobs[0].companyName : 'Civil-jobs';
  const from = params.get('from'); const to = params.get('to'); const month = params.get('month');
  const wholeMonth = !!from && !!to && from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01')
    && Number(to.slice(8)) === new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).getUTCDate();
  const when = month ?? (wholeMonth ? from!.slice(0, 7)
    : from && to ? (from === to ? from : `${from}_to_${to}`) : from ?? to ?? 'all-dates');
  return `${who}_${when}`.replace(/[^A-Za-z0-9_.-]+/g, '-');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dmyIso(iso: string): string {
  return iso.split('-').reverse().join('-');
}

/** "Sep 2026", "21-09-2026", "01-09-2026 to 15-09-2026" or "All dates". */
export function periodTitle(p: URLSearchParams): string {
  const month = p.get('month');
  if (month) {
    const [y, m] = month.split('-');
    return `${MONTHS[Number(m) - 1]} ${y}`;
  }
  const from = p.get('from'); const to = p.get('to');
  if (from && to) {
    const [fy, fm, fd] = from.split('-'); const [ty, tm, td] = to.split('-');
    if (from === to) return dmyIso(from);
    const lastDay = new Date(Date.UTC(Number(ty), Number(tm), 0)).getUTCDate();
    if (fd === '01' && fy === ty && fm === tm && Number(td) === lastDay) return `${MONTHS[Number(fm) - 1]} ${fy}`;
    return `${dmyIso(from)} to ${dmyIso(to)}`;
  }
  if (from) return `From ${dmyIso(from)}`;
  if (to) return `Up to ${dmyIso(to)}`;
  return 'All dates';
}

/** "Dmart · Thudiyalur", "Dmart · all branches" or "All companies" — who a download covers. */
export function statementTitle(jobs: CivilJobListRow[], params: URLSearchParams): string {
  if (!jobs.length) return params.get('branchId') || params.get('companyId') ? 'Selected jobs' : 'All companies';
  if (new Set(jobs.map(j => j.branchId)).size === 1) return `${jobs[0].companyName} · ${jobs[0].branchName}`;
  if (new Set(jobs.map(j => j.companyId)).size === 1) return `${jobs[0].companyName} · all branches`;
  return 'All companies';
}
