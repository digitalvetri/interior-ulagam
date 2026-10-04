import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobEvents, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilBulkStatusInput } from '@/types/civil';
import { planStatusChange } from '@/lib/civil/status';
import { invalid, readJson, serverError } from '@/lib/civil/server';

/** Change many jobs at once. Jobs that cannot make the move are skipped and reported. */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilBulkStatusInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { jobIds, change: { to, ...input } } = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const jobs = await tx.select({
        id: civilJobs.id, jobNo: civilJobs.jobNo, status: civilJobs.status,
        billNo: civilJobs.billNo, billDate: civilJobs.billDate, paidDate: civilJobs.paidDate,
      }).from(civilJobs)
        .where(and(eq(civilJobs.tenantId, ctx.tenantId), inArray(civilJobs.id, jobIds))).for('update');

      let updated = 0;
      const skipped: { jobNo: number; reason: string }[] = [];
      for (const job of jobs) {
        const plan = planStatusChange(job, to, input);
        if (!plan.ok) { skipped.push({ jobNo: job.jobNo, reason: plan.error }); continue; }
        await tx.update(civilJobs).set({ ...plan.patch, updatedAt: new Date() })
          .where(and(eq(civilJobs.id, job.id), eq(civilJobs.tenantId, ctx.tenantId)));
        await tx.insert(civilJobEvents).values({
          tenantId: ctx.tenantId, jobId: job.id, fromStatus: job.status, toStatus: to, createdBy: ctx.dbUserId,
        });
        updated++;
      }
      return { updated, skipped };
    });
    return NextResponse.json({ data: outcome });
  } catch (err) {
    return serverError('civil/jobs/bulk-status POST', err);
  }
}
