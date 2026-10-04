import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilCompanyInput } from '@/types/civil';
import {
  addStats, branchStats, EMPTY_STATS, invalid, isUniqueViolation, readJson, serverError,
} from '@/lib/civil/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  try {
    const [companies, branches, stats] = await Promise.all([
      db.select({
        id: civilCompanies.id, name: civilCompanies.name, gstin: civilCompanies.gstin,
        address: civilCompanies.address, contactName: civilCompanies.contactName,
        contactPhone: civilCompanies.contactPhone, notes: civilCompanies.notes,
      }).from(civilCompanies).where(eq(civilCompanies.tenantId, ctx.tenantId)).orderBy(asc(civilCompanies.name)),
      db.select({ id: civilBranches.id, companyId: civilBranches.companyId, cityName: civilCities.name })
        .from(civilBranches)
        .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
        .where(eq(civilBranches.tenantId, ctx.tenantId)),
      branchStats(ctx.tenantId),
    ]);

    const data = companies.map(c => {
      const own = branches.filter(b => b.companyId === c.id);
      const totals = own.reduce((acc, b) => addStats(acc, stats.get(b.id) ?? EMPTY_STATS), EMPTY_STATS);
      return {
        ...c,
        branchCount: own.length,
        cities: [...new Set(own.map(b => b.cityName))].sort(),
        ...totals,
      };
    });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/companies GET', err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilCompanyInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db.insert(civilCompanies).values({ tenantId: ctx.tenantId, ...parsed.data }).returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `A company named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    return serverError('civil/companies POST', err);
  }
}
