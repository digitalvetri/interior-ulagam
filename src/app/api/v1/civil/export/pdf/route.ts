import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies, tenants } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderCivilStatementPdf } from '@/lib/pdf/civil-statement';
import { downloadName, jobFilterConditions, jobsWithLines, periodTitle, serverError } from '@/lib/civil/server';
import { STATUS_LABEL } from '@/lib/civil/status';
import { sumLines } from '@/lib/civil/totals';

/** Printable work statement (PDF) for the filtered jobs — typically one branch for one month or one day. */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const filters = jobFilterConditions(params);
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });

  try {
    const jobs = await jobsWithLines(ctx.tenantId, filters.conditions);

    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);

    // Who the statement is for: the filtered branch/company, or the single one the jobs share.
    const branchId = params.get('branchId') ?? (new Set(jobs.map(j => j.branchId)).size === 1 ? jobs[0].branchId : null);
    const companyId = params.get('companyId') ?? (new Set(jobs.map(j => j.companyId)).size === 1 ? jobs[0].companyId : null);

    const [branch] = branchId
      ? await db.select({
          name: civilBranches.name, cityName: civilCities.name, address: civilBranches.address,
          contactName: civilBranches.contactName, contactPhone: civilBranches.contactPhone, companyId: civilBranches.companyId,
        }).from(civilBranches)
          .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
          .where(and(eq(civilBranches.id, branchId), eq(civilBranches.tenantId, ctx.tenantId))).limit(1)
      : [];
    const resolvedCompanyId = branch?.companyId ?? companyId;
    const [company] = resolvedCompanyId
      ? await db.select({
          name: civilCompanies.name, address: civilCompanies.address, gstin: civilCompanies.gstin,
          contactPhone: civilCompanies.contactPhone,
        }).from(civilCompanies)
          .where(and(eq(civilCompanies.id, resolvedCompanyId), eq(civilCompanies.tenantId, ctx.tenantId))).limit(1)
      : [];

    const totals = sumLines(jobs.flatMap(j => j.lines));
    const buffer = await renderCivilStatementPdf({
      studio: extractBranding(tenant ?? { name: 'Konst Design' }),
      title: periodTitle(params),
      company: company
        ? { name: company.name, address: company.address, gstin: company.gstin, phone: company.contactPhone }
        : null,
      branch: branch
        ? {
            name: `${branch.name}, ${branch.cityName}`,
            address: branch.address,
            phone: [branch.contactName, branch.contactPhone].filter(Boolean).join(' · ') || null,
          }
        : null,
      showBranch: !branch,
      jobs: jobs.map(j => ({
        jobNo: j.jobNo, jobDate: j.jobDate, heading: j.heading, branchName: j.branchName,
        status: STATUS_LABEL[j.status], billNo: j.billNo, totalPaise: j.totalPaise, lines: j.lines,
      })),
      ...totals,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${downloadName(jobs, params)}.pdf"`,
      },
    });
  } catch (err) {
    return serverError('civil/export/pdf GET', err);
  }
}
