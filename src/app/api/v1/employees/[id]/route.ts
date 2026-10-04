import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';

const RoleEnum = z.enum(['owner', 'designer', 'supervisor', 'accountant']);
const EmpTypeEnum = z.enum(['full_time', 'part_time', 'contract', 'intern', 'consultant']);
const StatusEnum = z.enum(['active', 'on_leave', 'inactive']);

const PatchSchema = z.object({
  fullName:       z.string().min(1).max(120).optional(),
  role:           RoleEnum.optional(),
  // Lowercased: Better Auth lowercases the email at sign-in, so a stored capital would never match.
  email:          z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('')),
  phone:          z.string().max(30).nullable().optional(),
  jobTitle:       z.string().max(120).nullable().optional(),
  department:     z.string().max(80).nullable().optional(),
  location:       z.string().max(80).nullable().optional(),
  employmentType: EmpTypeEnum.nullable().optional(),
  hireDate:       z.string().nullable().optional(),
  dob:            z.string().nullable().optional(),
  photoUrl:       z.string().url().nullable().optional().or(z.literal('')),
  managerId:      z.string().uuid().nullable().optional(),
  status:         StatusEnum.optional(),
  salaryPaise:    z.number().int().min(0).nullable().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relation: z.string().optional(),
    phone: z.string().optional(),
  }).nullable().optional(),
});

/**
 * Returns a 409 when `id` is the tenant's only owner, otherwise null.
 *
 * Guards both demotion and deletion. Without it a studio can strand itself:
 * every route that could restore an owner is owner-only, so there is no way
 * back through the product.
 */
async function wouldRemoveLastOwner(id: string, tenantId: string) {
  const owners = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')));

  const isLastOwner = owners.length <= 1 && owners.some((o) => o.id === id);
  if (!isLastOwner) return null;

  return NextResponse.json(
    { error: 'This is the only owner. Promote another user to owner first.' },
    { status: 409 },
  );
}

async function fetchOne(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const row = await fetchOne(id, ctx.tenantId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if ((k === 'email' || k === 'photoUrl') && v === '') { patch[k] = null; continue; }
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const existing = await fetchOne(id, ctx.tenantId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Demoting the last owner leaves the studio with nobody who can manage
    // staff, approve quotes, or restore the role — and no route to recover,
    // because every path back is itself owner-only.
    if (patch.role && patch.role !== 'owner' && existing.role === 'owner') {
      const blocked = await wouldRemoveLastOwner(id, ctx.tenantId);
      if (blocked) return blocked;
    }

    const [row] = await db
      .update(users)
      .set(patch)
      .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
      .returning();
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/employees/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    const blocked = await wouldRemoveLastOwner(id, ctx.tenantId);
    if (blocked) return blocked;

    const [row] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
      .returning({ id: users.id });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: { id: row.id } });
  } catch (e) {
    console.error('[DELETE /api/v1/employees/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
