import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilBranchInput } from '@/types/civil';
import {
  branchStats, EMPTY_STATS, findOrCreateCity, invalid, isForeignKeyViolation, isUniqueViolation,
  ownsCity, ownsCompany, readJson, serverError,
} from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [branch] = await db
      .select({
        id: civilBranches.id, name: civilBranches.name, address: civilBranches.address,
        contactName: civilBranches.contactName, contactPhone: civilBranches.contactPhone,
        companyId: civilBranches.companyId, companyName: civilCompanies.name,
        cityId: civilBranches.cityId, cityName: civilCities.name,
      })
      .from(civilBranches)
      .innerJoin(civilCompanies, eq(civilCompanies.id, civilBranches.companyId))
      .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
      .where(and(eq(civilBranches.id, id), eq(civilBranches.tenantId, ctx.tenantId)))
      .limit(1);
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    const stats = (await branchStats(ctx.tenantId)).get(id) ?? EMPTY_STATS;
    return NextResponse.json({ data: { ...branch, ...stats } });
  } catch (err) {
    return serverError('civil/branches/:id GET', err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

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
    const [row] = await db.update(civilBranches)
      .set({ companyId, cityId: resolvedCityId, ...fields })
      .where(and(eq(civilBranches.id, id), eq(civilBranches.tenantId, ctx.tenantId))).returning();
    if (!row) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `Branch "${fields.name}" already exists in that city.` }, { status: 409 });
    }
    return serverError('civil/branches/:id PATCH', err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [row] = await db.delete(civilBranches)
      .where(and(eq(civilBranches.id, id), eq(civilBranches.tenantId, ctx.tenantId)))
      .returning({ id: civilBranches.id });
    if (!row) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: 'This branch has jobs, so it cannot be removed.' }, { status: 409 });
    }
    return serverError('civil/branches/:id DELETE', err);
  }
}
