import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray, count, sum, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, milestones, snagItems, designDeliverables, purchaseOrders, siteLogs } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const patchBodySchema = z.object({
  stage: z.enum([
    'design_pending',
    'design_in_progress',
    'design_approved',
    'procurement',
    'execution',
    'snagging',
    'handover',
    'complete',
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { stage } = parsed.data;

  // Fetch the project to verify ownership and current state
  const [project] = await db
    .select({
      id: projects.id,
      tenantId: projects.tenantId,
      lifecycleStage: projects.lifecycleStage,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Stage gate: design_approved requires all design deliverables to be approved
  if (stage === 'design_approved') {
    const [totalRow] = await db
      .select({ total: count() })
      .from(designDeliverables)
      .where(and(
        eq(designDeliverables.projectId, id),
        eq(designDeliverables.tenantId, ctx.tenantId),
      ));

    if ((totalRow?.total ?? 0) > 0) {
      const [unapprovedRow] = await db
        .select({ unapproved: count() })
        .from(designDeliverables)
        .where(and(
          eq(designDeliverables.projectId, id),
          eq(designDeliverables.tenantId, ctx.tenantId),
          inArray(designDeliverables.status, ['draft', 'shared', 'changes_requested']),
        ));

      if ((unapprovedRow?.unapproved ?? 0) > 0) {
        return NextResponse.json(
          { error: `Stage gate failed: ${unapprovedRow.unapproved} design deliverable(s) not yet approved — get client sign-off before advancing` },
          { status: 422 },
        );
      }
    }
  }

  // Stage gate: procurement requires design_approved AND at least one paid milestone
  if (stage === 'procurement') {
    if (project.lifecycleStage !== 'design_approved') {
      return NextResponse.json(
        {
          error: 'Stage gate failed: project must be in design_approved stage before moving to procurement',
        },
        { status: 422 }
      );
    }

    const paidMilestones = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, id),
          eq(milestones.paymentStatus, 'paid')
        )
      )
      .limit(1);

    if (paidMilestones.length === 0) {
      return NextResponse.json(
        {
          error: 'Stage gate failed: at least one milestone must be paid before moving to procurement',
        },
        { status: 422 }
      );
    }
  }

  // Stage gate: execution requires at least one purchase order
  if (stage === 'execution') {
    const [poRow] = await db
      .select({ c: count() })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.projectId, id),
        eq(purchaseOrders.tenantId, ctx.tenantId),
      ));

    if ((poRow?.c ?? 0) === 0) {
      return NextResponse.json(
        { error: 'Stage gate failed: create at least one purchase order before moving to execution' },
        { status: 422 },
      );
    }
  }

  // Stage gate: snagging requires site progress ≥ 90 %
  if (stage === 'snagging') {
    const [progressRow] = await db
      .select({ maxPct: max(siteLogs.progressPct) })
      .from(siteLogs)
      .where(and(
        eq(siteLogs.projectId, id),
        eq(siteLogs.tenantId, ctx.tenantId),
      ));

    const maxPct = progressRow?.maxPct ?? 0;
    if ((maxPct ?? 0) < 90) {
      return NextResponse.json(
        { error: `Stage gate failed: site progress is ${maxPct ?? 0}% — must reach 90% before snagging` },
        { status: 422 },
      );
    }
  }

  // Stage gate: handover requires zero open/in_progress snag items
  if (stage === 'handover') {
    const [openSnagRow] = await db
      .select({ c: count() })
      .from(snagItems)
      .where(
        and(
          eq(snagItems.projectId, id),
          inArray(snagItems.status, ['open', 'in_progress']),
        ),
      );

    if ((openSnagRow?.c ?? 0) > 0) {
      return NextResponse.json(
        { error: `Stage gate failed: ${openSnagRow.c} snag item(s) still open — resolve all snags before handover` },
        { status: 422 },
      );
    }
  }

  // Stage gate: complete requires outstanding balance = 0
  if (stage === 'complete') {
    const [proj] = await db
      .select({ totalContractPaise: projects.totalContractPaise })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
      .limit(1);

    if (proj?.totalContractPaise && proj.totalContractPaise > 0) {
      const [paidRow] = await db
        .select({ paidPaise: sum(milestones.amountPaise) })
        .from(milestones)
        .where(and(
          eq(milestones.projectId, id),
          eq(milestones.paymentStatus, 'paid'),
        ));

      const paidPaise    = Number(paidRow?.paidPaise ?? 0);
      const outstanding  = proj.totalContractPaise - paidPaise;
      if (outstanding > 0) {
        const outstandingRupees = (outstanding / 100).toLocaleString('en-IN');
        return NextResponse.json(
          { error: `Stage gate failed: ₹${outstandingRupees} still outstanding — collect full payment before marking complete` },
          { status: 422 },
        );
      }
    }
  }

  const [updatedProject] = await db
    .update(projects)
    .set({ lifecycleStage: stage })
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .returning();

  return NextResponse.json({ data: updatedProject });
}
