import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { COUNTED_STATUSES, profitOf } from '@/lib/civil/profit';
import { jobFilterConditions, serverError } from '@/lib/civil/server';
import type { CivilJobStatus } from '@/types/civil';

interface Bucket { jobs: number; billedPaise: number; costPaise: number }

function finish<T extends Bucket>(b: T) {
  return { ...b, ...profitOf(b.billedPaise, b.costPaise) };
}

/**
 * Owner-only profit report: billed − real cost for finished jobs (Done, Billed,
 * Paid) in the period, overall and by company, branch and job.
 * Same filters as the job list (?from&to&companyId&branchId…).
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const params = new URLSearchParams(request.nextUrl.searchParams);
  const status = params.get('status') as CivilJobStatus | null;
  params.delete('status');
  const filters = jobFilterConditions(params);
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });
  const statuses = status && COUNTED_STATUSES.includes(status) ? [status] : [...COUNTED_STATUSES];

  try {
    const rows = await db
      .select({
        id: civilJobs.id,
        jobNo: civilJobs.jobNo,
        jobDate: civilJobs.jobDate,
        heading: civilJobs.heading,
        status: civilJobs.status,
        billedPaise: civilJobs.totalPaise,
        costPaise: civilJobs.costPaise,
        branchId: civilBranches.id,
        branchName: civilBranches.name,
        companyId: civilCompanies.id,
        companyName: civilCompanies.name,
        cityName: civilCities.name,
        // A line with no real cost yet means this job's profit is only an estimate.
        missingCosts: sql<boolean>`exists (select 1 from civil_job_lines l where l.job_id = ${civilJobs.id} and l.cost_paise is null)`,
      })
      .from(civilJobs)
      .innerJoin(civilBranches, eq(civilBranches.id, civilJobs.branchId))
      .innerJoin(civilCompanies, eq(civilCompanies.id, civilBranches.companyId))
      .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
      .where(and(eq(civilJobs.tenantId, ctx.tenantId), inArray(civilJobs.status, statuses), ...filters.conditions))
      .orderBy(asc(civilJobs.jobDate), asc(civilJobs.jobNo))
      .limit(5000);

    const jobs = rows.map(r => ({
      ...r, billedPaise: Number(r.billedPaise), costPaise: Number(r.costPaise),
      ...profitOf(Number(r.billedPaise), Number(r.costPaise)),
    }));

    const total: Bucket = { jobs: 0, billedPaise: 0, costPaise: 0 };
    const companies = new Map<string, Bucket & { companyId: string; companyName: string }>();
    const branches = new Map<string, Bucket & { branchId: string; branchName: string; companyName: string; cityName: string }>();
    for (const j of jobs) {
      for (const b of [
        total,
        companies.get(j.companyId) ?? companies.set(j.companyId, { companyId: j.companyId, companyName: j.companyName, jobs: 0, billedPaise: 0, costPaise: 0 }).get(j.companyId)!,
        branches.get(j.branchId) ?? branches.set(j.branchId, { branchId: j.branchId, branchName: j.branchName, companyName: j.companyName, cityName: j.cityName, jobs: 0, billedPaise: 0, costPaise: 0 }).get(j.branchId)!,
      ]) {
        b.jobs++; b.billedPaise += j.billedPaise; b.costPaise += j.costPaise;
      }
    }

    const byProfit = <T extends { profitPaise: number }>(a: T, b: T) => b.profitPaise - a.profitPaise;
    return NextResponse.json({
      data: {
        totals: { ...finish(total), jobsMissingCosts: jobs.filter(j => j.missingCosts).length },
        byCompany: [...companies.values()].map(finish).sort(byProfit),
        byBranch: [...branches.values()].map(finish).sort(byProfit),
        jobs,
      },
    });
  } catch (err) {
    return serverError('civil/profit GET', err);
  }
}
