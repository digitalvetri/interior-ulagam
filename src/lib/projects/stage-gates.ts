import { and, count, eq, inArray, max, sum } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, milestones, snagItems, designDeliverables, purchaseOrders, siteLogs } from '@/lib/db/schema';

export type ProjectStage =
  | 'design_pending' | 'design_in_progress' | 'design_approved' | 'procurement'
  | 'execution' | 'snagging' | 'handover' | 'complete';

/**
 * Business stage gates (design sign-off, payment before procurement, a PO before
 * execution, 90% progress before snagging, no open snags at handover, nothing
 * outstanding at completion). Returns the reason a move is blocked, or null.
 *
 * Shared by every route that changes a project's stage, so none of them can be
 * used to skip the gates.
 */
export async function stageGateError(
  tenantId: string,
  id: string,
  currentStage: string,
  stage: ProjectStage,
): Promise<string | null> {
  // Stage gate: design_approved requires all design deliverables to be approved
  if (stage === 'design_approved') {
    const [totalRow] = await db
      .select({ total: count() })
      .from(designDeliverables)
      .where(and(
        eq(designDeliverables.projectId, id),
        eq(designDeliverables.tenantId, tenantId),
      ));

    if ((totalRow?.total ?? 0) > 0) {
      const [unapprovedRow] = await db
        .select({ unapproved: count() })
        .from(designDeliverables)
        .where(and(
          eq(designDeliverables.projectId, id),
          eq(designDeliverables.tenantId, tenantId),
          inArray(designDeliverables.status, ['draft', 'shared', 'changes_requested']),
        ));

      if ((unapprovedRow?.unapproved ?? 0) > 0) {
        return `Stage gate failed: ${unapprovedRow.unapproved} design deliverable(s) not yet approved — get client sign-off before advancing`;
      }
    }
  }

  // Stage gate: procurement requires design_approved AND at least one paid milestone
  if (stage === 'procurement') {
    if (currentStage !== 'design_approved') {
      return 'Stage gate failed: project must be in design_approved stage before moving to procurement';
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
      return 'Stage gate failed: at least one milestone must be paid before moving to procurement';
    }
  }

  // Stage gate: execution requires at least one purchase order
  if (stage === 'execution') {
    const [poRow] = await db
      .select({ c: count() })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.projectId, id),
        eq(purchaseOrders.tenantId, tenantId),
      ));

    if ((poRow?.c ?? 0) === 0) {
      return 'Stage gate failed: create at least one purchase order before moving to execution';
    }
  }

  // Stage gate: snagging requires site progress ≥ 90 %
  if (stage === 'snagging') {
    const [progressRow] = await db
      .select({ maxPct: max(siteLogs.progressPct) })
      .from(siteLogs)
      .where(and(
        eq(siteLogs.projectId, id),
        eq(siteLogs.tenantId, tenantId),
      ));

    const maxPct = progressRow?.maxPct ?? 0;
    if ((maxPct ?? 0) < 90) {
      return `Stage gate failed: site progress is ${maxPct ?? 0}% — must reach 90% before snagging`;
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
      return `Stage gate failed: ${openSnagRow.c} snag item(s) still open — resolve all snags before handover`;
    }
  }

  // Stage gate: complete requires outstanding balance = 0
  if (stage === 'complete') {
    const [proj] = await db
      .select({ totalContractPaise: projects.totalContractPaise })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
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
        return `Stage gate failed: ₹${outstandingRupees} still outstanding — collect full payment before marking complete`;
      }
    }
  }

  return null;
}
