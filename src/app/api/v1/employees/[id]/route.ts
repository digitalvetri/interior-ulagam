import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  users, payslips, staffDayLogs, attendanceRecords, leaveRequests,
  grns, civilJobs, civilJobEvents, projectAdditions, ledgerAdjustments,
} from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { auth } from '@/lib/auth/config';

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
    .where(and(eq(users.tenantId, tenantId), inArray(users.role, ['owner', 'admin'])));

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
  // Full employee record incl. salary — owner only, matching the Employees menu.
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

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
    // Legacy 'admin' is an owner too (see get-context isAdmin).
    const existingIsOwner = existing.role === 'owner' || existing.role === 'admin';
    const demoting = patch.role && patch.role !== 'owner' && existingIsOwner;
    // Deactivating the only owner strands the studio just like demoting them.
    const deactivatingOwner = patch.status === 'inactive' && existingIsOwner;
    if (demoting || deactivatingOwner) {
      const blocked = await wouldRemoveLastOwner(id, ctx.tenantId);
      if (blocked) return blocked;
    }

    const [row] = await db
      .update(users)
      .set(patch)
      .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
      .returning();

    // An inactive employee is refused at sign-in and on every request (see
    // loadContext); end their live sessions now rather than when they expire.
    if (patch.status === 'inactive' && existing.status !== 'inactive') {
      const authCtx = await auth.$context;
      await authCtx.internalAdapter.deleteUserSessions(id);
    }
    return NextResponse.json({ data: row });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } } | null);
    if (code?.code === '23505' || code?.cause?.code === '23505') {
      return NextResponse.json({ error: 'Another user already has this email address.' }, { status: 409 });
    }
    console.error('[PATCH /api/v1/employees/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** True when the user has history that a hard delete would cascade away or orphan. */
async function hasHistory(id: string, tenantId: string): Promise<boolean> {
  const probes = await Promise.all([
    db.select({ id: payslips.id }).from(payslips)
      .where(and(eq(payslips.tenantId, tenantId), eq(payslips.userId, id))).limit(1),
    db.select({ id: staffDayLogs.id }).from(staffDayLogs)
      .where(and(eq(staffDayLogs.tenantId, tenantId), or(eq(staffDayLogs.userId, id), eq(staffDayLogs.createdBy, id)))).limit(1),
    db.select({ id: attendanceRecords.id }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.userId, id))).limit(1),
    db.select({ id: leaveRequests.id }).from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.userId, id))).limit(1),
    db.select({ id: grns.id }).from(grns)
      .where(and(eq(grns.tenantId, tenantId), eq(grns.receivedBy, id))).limit(1),
    db.select({ id: civilJobs.id }).from(civilJobs)
      .where(and(eq(civilJobs.tenantId, tenantId), eq(civilJobs.createdBy, id))).limit(1),
    db.select({ id: civilJobEvents.id }).from(civilJobEvents)
      .where(and(eq(civilJobEvents.tenantId, tenantId), eq(civilJobEvents.createdBy, id))).limit(1),
    db.select({ id: projectAdditions.id }).from(projectAdditions)
      .where(and(eq(projectAdditions.tenantId, tenantId), eq(projectAdditions.createdBy, id))).limit(1),
    db.select({ id: ledgerAdjustments.id }).from(ledgerAdjustments)
      .where(and(eq(ledgerAdjustments.tenantId, tenantId), eq(ledgerAdjustments.createdBy, id))).limit(1),
  ]);
  return probes.some(rows => rows.length > 0);
}

function isFkViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23503' || e?.cause?.code === '23503';
}

/**
 * "Remove" an employee.
 *
 * Employees with any history (payslips, attendance, staff days, leads, quotes,
 * tasks…) are deactivated — status 'inactive' + sessions revoked — so their
 * records stay intact. Only a user with no references at all is hard-deleted.
 */
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
    const existing = await fetchOne(id, ctx.tenantId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const blocked = await wouldRemoveLastOwner(id, ctx.tenantId);
    if (blocked) return blocked;

    const deactivate = async () => {
      await db
        .update(users)
        .set({ status: 'inactive' })
        .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)));
      const authCtx = await auth.$context;
      await authCtx.internalAdapter.deleteUserSessions(id);
      return NextResponse.json({
        data: { id, deactivated: true },
        message: 'Employee has history, so they were deactivated instead of deleted. Their records are kept.',
      });
    };

    if (await hasHistory(id, ctx.tenantId)) return await deactivate();

    try {
      const [row] = await db
        .delete(users)
        .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
        .returning({ id: users.id });
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ data: { id: row.id, deactivated: false }, message: 'Employee deleted' });
    } catch (e) {
      // Referenced by leads, quotes, tasks, etc. (FK NO ACTION) — keep the record.
      if (isFkViolation(e)) return await deactivate();
      throw e;
    }
  } catch (e) {
    if (isFkViolation(e)) {
      return NextResponse.json(
        { error: 'This employee is linked to existing records and cannot be deleted. Mark them inactive instead.' },
        { status: 409 },
      );
    }
    console.error('[DELETE /api/v1/employees/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
