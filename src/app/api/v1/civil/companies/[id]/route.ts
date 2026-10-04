import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilBranches, civilCities, civilCompanies } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilCompanyInput } from '@/types/civil';
import {
  branchStats, EMPTY_STATS, invalid, isForeignKeyViolation, isUniqueViolation, readJson, serverError,
} from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [company] = await db.select().from(civilCompanies)
      .where(and(eq(civilCompanies.id, id), eq(civilCompanies.tenantId, ctx.tenantId))).limit(1);
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const [branches, stats] = await Promise.all([
      db.select({
        id: civilBranches.id, name: civilBranches.name, address: civilBranches.address,
        contactName: civilBranches.contactName, contactPhone: civilBranches.contactPhone,
        cityId: civilBranches.cityId, cityName: civilCities.name,
      })
        .from(civilBranches)
        .innerJoin(civilCities, eq(civilCities.id, civilBranches.cityId))
        .where(and(eq(civilBranches.companyId, id), eq(civilBranches.tenantId, ctx.tenantId)))
        .orderBy(asc(civilCities.name), asc(civilBranches.name)),
      branchStats(ctx.tenantId),
    ]);

    return NextResponse.json({
      data: { ...company, branches: branches.map(b => ({ ...b, ...(stats.get(b.id) ?? EMPTY_STATS) })) },
    });
  } catch (err) {
    return serverError('civil/companies/:id GET', err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  const parsed = CivilCompanyInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db.update(civilCompanies).set(parsed.data)
      .where(and(eq(civilCompanies.id, id), eq(civilCompanies.tenantId, ctx.tenantId))).returning();
    if (!row) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `A company named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    return serverError('civil/companies/:id PATCH', err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [row] = await db.delete(civilCompanies)
      .where(and(eq(civilCompanies.id, id), eq(civilCompanies.tenantId, ctx.tenantId)))
      .returning({ id: civilCompanies.id });
    if (!row) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: 'Remove this company’s branches first.' }, { status: 409 });
    }
    return serverError('civil/companies/:id DELETE', err);
  }
}
