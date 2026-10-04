import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobEvents, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilStatusChangeInput } from '@/types/civil';
import { planStatusChange } from '@/lib/civil/status';
import { invalid, jobListQuery, readJson, serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

/** 2026-09-30 → 30-09-2026, as the office writes dates. */
const dmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('-') : '');

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;
  const { id } = await params;

  const parsed = CivilStatusChangeInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { to, ...input } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [job] = await tx.select({
        status: civilJobs.status, billNo: civilJobs.billNo, billDate: civilJobs.billDate, paidDate: civilJobs.paidDate,
      }).from(civilJobs).where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).for('update');
      if (!job) return { status: 404 as const, error: 'Job not found' };

      const plan = planStatusChange(job, to, input);
      if (!plan.ok) return { status: 422 as const, error: plan.error };

      const [row] = await tx.update(civilJobs).set({ ...plan.patch, updatedAt: new Date() })
        .where(and(eq(civilJobs.id, id), eq(civilJobs.tenantId, ctx.tenantId))).returning({ id: civilJobs.id });
      await tx.insert(civilJobEvents).values({
        tenantId: ctx.tenantId, jobId: id, fromStatus: job.status, toStatus: to, createdBy: ctx.dbUserId,
        note: to === 'billed' ? `Bill ${plan.patch.billNo} dated ${dmy(plan.patch.billDate)}`
          : to === 'paid' ? `Paid on ${dmy(plan.patch.paidDate)}` : null,
      });
      return { status: 200 as const, row };
    });

    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    // Read back through the list query, which selects no cost: a full row from
    // .returning() handed the owner-only cost to the accountant.
    const [job] = await jobListQuery(ctx.tenantId, [eq(civilJobs.id, id)]).limit(1);
    return NextResponse.json({ data: job });
  } catch (err) {
    return serverError('civil/jobs/:id/status POST', err);
  }
}
