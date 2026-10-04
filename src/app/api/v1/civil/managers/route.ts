import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilManagers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilManagerInput } from '@/types/civil';
import { invalid, isUniqueViolation, readJson, serverError } from '@/lib/civil/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  try {
    const data = await db
      .select({ id: civilManagers.id, name: civilManagers.name, phone: civilManagers.phone, active: civilManagers.active })
      .from(civilManagers).where(eq(civilManagers.tenantId, ctx.tenantId)).orderBy(asc(civilManagers.name));
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/managers GET', err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilManagerInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db.insert(civilManagers).values({ tenantId: ctx.tenantId, ...parsed.data }).returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `Manager "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    return serverError('civil/managers POST', err);
  }
}
