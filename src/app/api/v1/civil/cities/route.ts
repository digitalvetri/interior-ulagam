import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilCities } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilCityInput } from '@/types/civil';
import { findOrCreateCity, invalid, readJson, serverError } from '@/lib/civil/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  try {
    const data = await db.select({ id: civilCities.id, name: civilCities.name }).from(civilCities)
      .where(eq(civilCities.tenantId, ctx.tenantId)).orderBy(asc(civilCities.name));
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/cities GET', err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilCityInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const id = await findOrCreateCity(ctx.tenantId, parsed.data.name);
    return NextResponse.json({ data: { id, name: parsed.data.name } }, { status: 201 });
  } catch (err) {
    return serverError('civil/cities POST', err);
  }
}
