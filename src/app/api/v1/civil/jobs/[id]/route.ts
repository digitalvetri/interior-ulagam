import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobEvents, civilJobLines, civilJobs, users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilJobInput } from '@/types/civil';
import { canEditLines } from '@/lib/civil/status';
import { sumLines } from '@/lib/civil/totals';
import {
  invalid, jobListQuery, ownsBranch, ownsManager, readJson, syncLines, serverError,
} from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [job] = await jobListQuery(ctx.tenantId, [eq(civilJobs.id, id)]).limit(1);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const [lines, events] = await Promise.all([
      db.select({
        id: civilJobLines.id, description: civilJobLines.description,
        kind: civilJobLines.kind, amountPaise: civilJobLines.amountPaise,
      }).from(civilJobLines)
        .where(and(eq(civilJobLines.jobId, id), eq(civilJobLines.tenantId, ctx.tenantId)))
        .orderBy(asc(civilJobLines.position)),
      db.select({
        id: civilJobEvents.id, fromStatus: civilJobEvents.fromStatus, toStatus: civilJobEvents.toStatus,
        note: civilJobEvents.note, createdAt: civilJobEvents.createdAt, byName: users.fullName,
      }).from(civilJobEvents)
        .leftJoin(users, eq(users.id, civilJobEvents.createdBy))
        .where(and(eq(civilJobEvents.jobId, id), eq(civilJobEvents.tenantId, ctx.tenantId)))
        .orderBy(asc(civilJobEvents.createdAt)),
    ]);

    return NextResponse.json({ data: { ...job, lines, events } });
  } catch (err) {
    return serverError('civil/jobs/:id GET', err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  const parsed = CivilJobInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { lines, managerId, ...fields } = parsed.data;

  try {
    if (!(await ownsBranch(ctx.tenantId, fields.branchId))) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    if (managerId && !(await ownsManager(ctx.tenantId, managerId))) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select({ status: civilJobs.status }).from(civilJobs)
        .where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).for('update');
      if (!current) return { status: 404 as const, error: 'Job not found' };

      if (!canEditLines(current.status)) {
        // Billed amounts are frozen; other details (remark, manager…) stay editable.
        const existing = await tx.select({
          description: civilJobLines.description, kind: civilJobLines.kind, amountPaise: civilJobLines.amountPaise,
        }).from(civilJobLines)
          .where(and(eq(civilJobLines.jobId, id), eq(civilJobLines.tenantId, ctx.tenantId)))
          .orderBy(asc(civilJobLines.position));
        const same = existing.length === lines.length && existing.every((l, i) =>
          l.description === lines[i].description && l.kind === lines[i].kind && Number(l.amountPaise) === lines[i].amountPaise);
        if (!same) {
          return { status: 409 as const, error: 'This job is billed — move it back to Done to change its lines.' };
        }
      } else {
        await syncLines(tx, ctx.tenantId, id, lines);
      }

      const [row] = await tx.update(civilJobs).set({
        ...fields, managerId: managerId ?? null, totalPaise: sumLines(lines).totalPaise, updatedAt: new Date(),
      }).where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).returning({ id: civilJobs.id });
      return { status: 200 as const, row };
    });

    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    // Read back through the list query, which selects no cost: a full row from
    // .returning() handed the owner-only cost to the accountant.
    const [job] = await jobListQuery(ctx.tenantId, [eq(civilJobs.id, id)]).limit(1);
    return NextResponse.json({ data: job });
  } catch (err) {
    return serverError('civil/jobs/:id PATCH', err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  try {
    const [job] = await db.select({ status: civilJobs.status }).from(civilJobs)
      .where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).limit(1);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!canEditLines(job.status)) {
      return NextResponse.json({ error: 'A billed job cannot be deleted. Move it back to Done first.' }, { status: 409 });
    }
    await db.delete(civilJobs).where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId)));
    return NextResponse.json({ data: { id } });
  } catch (err) {
    return serverError('civil/jobs/:id DELETE', err);
  }
}
