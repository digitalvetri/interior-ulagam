import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilManagers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilManagerInput } from '@/types/civil';
import { invalid, isUniqueViolation, readJson, serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  const parsed = CivilManagerInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db.update(civilManagers).set(parsed.data)
      .where(and(eq(civilManagers.id, id), eq(civilManagers.tenantId, ctx.tenantId))).returning();
    if (!row) return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `Manager "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    return serverError('civil/managers/:id PATCH', err);
  }
}
