import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilBranchInput } from '@/types/civil';
import {
  findOrCreateCity, invalid, isUniqueViolation, ownsCity, ownsCompany, readJson, serverError,
} from '@/lib/civil/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (companyId && !z.string().uuid().safeParse(companyId).success) {
    return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
  }

  try {
    const data = await db
      .select({
        id: civilBranches.id, name: civilBranches.name,
        companyId: civilBranches.companyId, companyName: civilCompanies.name,
        cityId: civilBranches.cityId, cityName: civilCities.name,
      })
      .from(civilBranches)
      .innerJoin(civilCompanies, eq(civilCompanies.id, civilBranches.companyId))
      .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
      .where(and(
        eq(civilBranches.tenantId, ctx.tenantId),
        companyId ? eq(civilBranches.companyId, companyId) : undefined,
      ))
      .orderBy(asc(civilCompanies.name), asc(civilCities.name), asc(civilBranches.name));
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/branches GET', err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilBranchInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { companyId, cityId, cityName, ...fields } = parsed.data;

  try {
    if (!(await ownsCompany(ctx.tenantId, companyId))) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    if (cityId && !(await ownsCity(ctx.tenantId, cityId))) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 });
    }
    const resolvedCityId = cityId ?? await findOrCreateCity(ctx.tenantId, cityName!);
    const [row] = await db.insert(civilBranches)
      .values({ tenantId: ctx.tenantId, companyId, cityId: resolvedCityId, ...fields }).returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `Branch "${fields.name}" already exists in that city.` }, { status: 409 });
    }
    return serverError('civil/branches POST', err);
  }
}
