import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobCosts, civilJobLines, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilJobCostsInput } from '@/types/civil';
import { jobCost, profitOf } from '@/lib/civil/profit';
import { invalid, readJson, recomputeJobCost, serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

// Real costs are the owner's private numbers: every handler here is OWNER_ONLY,
// including the read, and none of it is ever part of a download.

async function load(tenantId: string, id: string) {
  const [job] = await db.select({ totalPaise: civilJobs.totalPaise }).from(civilJobs)
    .where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, tenantId))).limit(1);
  if (!job) return null;
  const [lines, extras] = await Promise.all([
    db.select({
      id: civilJobLines.id, description: civilJobLines.description, kind: civilJobLines.kind,
      amountPaise: civilJobLines.amountPaise, costPaise: civilJobLines.costPaise,
    }).from(civilJobLines)
      .where(and(eq(civilJobLines.jobId, id), eq(civilJobLines.tenantId, tenantId)))
      .orderBy(asc(civilJobLines.position)),
    db.select({ description: civilJobCosts.description, amountPaise: civilJobCosts.amountPaise })
      .from(civilJobCosts)
      .where(and(eq(civilJobCosts.jobId, id), eq(civilJobCosts.tenantId, tenantId)))
      .orderBy(asc(civilJobCosts.position)),
  ]);
  const norm = {
    lines: lines.map(l => ({ ...l, amountPaise: Number(l.amountPaise), costPaise: l.costPaise === null ? null : Number(l.costPaise) })),
    extras: extras.map(e => ({ ...e, amountPaise: Number(e.amountPaise) })),
  };
  const billedPaise = Number(job.totalPaise);
  const cost = jobCost(norm.lines, norm.extras);
  return { ...norm, billedPaise, ...cost, ...profitOf(billedPaise, cost.costPaise) };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  try {
    const data = await load(ctx.tenantId, id);
    if (!data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/jobs/:id/costs GET', err);
  }
}

/** Save real costs. Works at any status — costs often arrive after the bill has gone. */
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  const parsed = CivilJobCostsInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { lines, extras } = parsed.data;

  try {
    const found = await db.transaction(async (tx) => {
      const [job] = await tx.select({ id: civilJobs.id }).from(civilJobs)
        .where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).for('update');
      if (!job) return false;

      for (const l of lines) {
        await tx.update(civilJobLines).set({ costPaise: l.costPaise })
          .where(and(eq(civilJobLines.id, l.id), eq(civilJobLines.jobId, id), eq(civilJobLines.tenantId, ctx.tenantId)));
      }
      await tx.delete(civilJobCosts).where(and(eq(civilJobCosts.jobId, id), eq(civilJobCosts.tenantId, ctx.tenantId)));
      if (extras.length) {
        await tx.insert(civilJobCosts).values(extras.map((e, position) => ({
          tenantId: ctx.tenantId, jobId: id, position, description: e.description, amountPaise: e.amountPaise,
        })));
      }
      await recomputeJobCost(tx, ctx.tenantId, id);
      return true;
    });
    if (!found) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ data: await load(ctx.tenantId, id) });
  } catch (err) {
    return serverError('civil/jobs/:id/costs PUT', err);
  }
}
