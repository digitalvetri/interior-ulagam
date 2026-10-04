import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { milestones, paymentAllocations, projectAdditions, projects } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { ProjectContractInput } from '@/types/project-money';
import { revisedContract, stageReached } from '@/lib/project-money/calc';
import { applyStageMoneyEffects, loadProjectMoney, refreshMilestonesPaid, withoutProfit } from '@/lib/project-money/server';
import { invalid, readJson, serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

/** Everything money for one project. Profit and staff cost only for the owner. */
export async function GET(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;
  const { id } = await params;

  try {
    const money = await loadProjectMoney(ctx.tenantId, id);
    if (!money) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ data: ctx.role === 'owner' ? money : withoutProfit(money) });
  } catch (err) {
    return serverError('projects/:id/money GET', err);
  }
}

/** Save contract value, GST, dates, additions and milestones (owner only). */
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  const parsed = ProjectContractInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [p] = await tx.select({ id: projects.id, stage: projects.lifecycleStage }).from(projects)
        .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId))).for('update');
      if (!p) return { status: 404 as const, error: 'Project not found' };

      await tx.update(projects).set({
        totalContractPaise: input.contractPaise,
        gstPct: input.gstPct,
        startedAt: input.startedAt ? new Date(`${input.startedAt}T00:00:00+05:30`) : null,
        expectedEndAt: input.expectedEndAt ? new Date(`${input.expectedEndAt}T00:00:00+05:30`) : null,
      }).where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

      await tx.delete(projectAdditions).where(and(eq(projectAdditions.projectId, id), eq(projectAdditions.tenantId, ctx.tenantId)));
      if (input.additions.length) {
        await tx.insert(projectAdditions).values(input.additions.map(a => ({
          tenantId: ctx.tenantId, projectId: id, description: a.description, amountPaise: a.amountPaise,
          addedOn: a.addedOn, createdBy: ctx.dbUserId,
        })));
      }

      // Milestones: a milestone that has received money can be renamed but not removed.
      const existing = await tx.select({
        id: milestones.id, paymentStatus: milestones.paymentStatus,
        received: sql<number>`coalesce((select sum(a.amount_paise) from payment_allocations a where a.milestone_id = "milestones"."id"), 0)::bigint`,
      }).from(milestones).where(and(eq(milestones.projectId, id), eq(milestones.tenantId, ctx.tenantId)));
      const keep = new Set(input.milestones.map(m => m.id).filter(Boolean));
      const removed = existing.filter(m => !keep.has(m.id));
      const blocked = removed.filter(m => m.paymentStatus === 'paid' || Number(m.received) > 0);
      if (blocked.length) return { status: 409 as const, error: 'A milestone that has received payment cannot be removed.' };
      if (removed.length) {
        await tx.delete(paymentAllocations).where(inArray(paymentAllocations.milestoneId, removed.map(m => m.id)));
        await tx.delete(milestones).where(and(eq(milestones.tenantId, ctx.tenantId), inArray(milestones.id, removed.map(m => m.id))));
      }

      const revised = revisedContract(input.contractPaise, input.additions);
      const byId = new Map(existing.map(m => [m.id, m]));
      for (const [i, m] of input.milestones.entries()) {
        const prev = m.id ? byId.get(m.id) : undefined;
        if (m.id && !prev) return { status: 404 as const, error: 'Milestone not found' };
        const paid = prev?.paymentStatus === 'paid';
        const fields = {
          label: m.label, pctOfTotal: m.pctOfTotal, triggerStage: m.triggerStage, dueOn: m.dueOn, sortOrder: i,
          ...(paid ? {} : { amountPaise: Math.round((revised * m.pctOfTotal) / 100) }),
          // A dated milestone doesn't wait on a stage; a stage one already reached is due now.
          ...(paid ? {} : { dueSince: m.dueOn ? null : (m.triggerStage && stageReached(p.stage, m.triggerStage)) || !m.triggerStage ? sql`coalesce(${milestones.dueSince}, (now() at time zone 'Asia/Kolkata')::date)` : null }),
        };
        if (prev) {
          await tx.update(milestones).set(fields).where(and(eq(milestones.id, prev.id), eq(milestones.tenantId, ctx.tenantId)));
        } else {
          await tx.insert(milestones).values({
            tenantId: ctx.tenantId, projectId: id, ...fields,
            amountPaise: Math.round((revised * m.pctOfTotal) / 100),
            dueSince: m.dueOn ? null : (!m.triggerStage || stageReached(p.stage, m.triggerStage)) ? sql`(now() at time zone 'Asia/Kolkata')::date` : null,
          });
        }
      }
      await applyStageMoneyEffects(tx, ctx.tenantId, id, p.stage);
      await refreshMilestonesPaid(tx, ctx.tenantId, id);
      return { status: 200 as const };
    });

    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: await loadProjectMoney(ctx.tenantId, id) });
  } catch (err) {
    return serverError('projects/:id/money PUT', err);
  }
}
