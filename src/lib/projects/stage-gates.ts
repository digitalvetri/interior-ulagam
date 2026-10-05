import { and, asc, count, eq, max, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  projects, milestones, snagItems, designDeliverables, deliverables, purchaseOrders, siteLogs, ledgerAdjustments,
} from '@/lib/db/schema';
import { loadProjectMoney } from '@/lib/project-money/server';
import { projectDesignDeliverablesWhere } from './link';
import { completionOutstanding, designApproved, secondMilestonePaid } from './gate-rules';

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
  // Stage gate: design_approved (and procurement) require every design
  // deliverable to be approved. The UI's design system is design_deliverables
  // (lead "Designs" tab, /designs/[id], client portal approvals); rows created
  // on the lead before booking are matched through the project's lead_id. The
  // older per-project `deliverables` checklist is checked too, so neither can
  // be used to skip sign-off.
  if (stage === 'design_approved' || stage === 'procurement') {
    const designError = await designGateError(tenantId, id);
    if (designError) return designError;
  }

  // Stage gate: procurement requires design approved AND milestone 2 paid
  if (stage === 'procurement') {
    if (currentStage !== 'design_approved') {
      return 'Stage gate failed: project must be in design_approved stage before moving to procurement';
    }

    const ms = await db
      .select({ sortOrder: milestones.sortOrder, createdAt: milestones.createdAt, paymentStatus: milestones.paymentStatus })
      .from(milestones)
      .where(and(eq(milestones.projectId, id), eq(milestones.tenantId, tenantId)))
      .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt));

    if (!secondMilestonePaid(ms)) {
      return ms.length === 0
        ? 'Stage gate failed: the project has no payment milestones — add them and collect milestone 2 before procurement'
        : 'Stage gate failed: milestone 2 must be fully paid before moving to procurement';
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
          eq(snagItems.tenantId, tenantId),
          inArray(snagItems.status, ['open', 'in_progress']),
        ),
      );

    if ((openSnagRow?.c ?? 0) > 0) {
      return `Stage gate failed: ${openSnagRow.c} snag item(s) still open — resolve all snags before handover`;
    }
  }

  // Stage gate: complete requires nothing outstanding — measured with the
  // project money engine (revised contract incl. additions and GST, less
  // receipts, discounts and write-offs, plus refunds).
  if (stage === 'complete') {
    const money = await loadProjectMoney(tenantId, id);
    if (money) {
      const adjustments = await db
        .select({ kind: ledgerAdjustments.kind, amountPaise: ledgerAdjustments.amountPaise })
        .from(ledgerAdjustments)
        .where(and(eq(ledgerAdjustments.tenantId, tenantId), eq(ledgerAdjustments.projectId, id)));
      const outstanding = completionOutstanding({
        totalWithGstPaise: money.contract.totalWithGstPaise,
        receivedPaise: money.billing.receivedPaise,
        adjustments: adjustments.map(a => ({ kind: a.kind, amountPaise: Number(a.amountPaise) })),
      });
      if (outstanding > 0) {
        const outstandingRupees = (outstanding / 100).toLocaleString('en-IN');
        return `Stage gate failed: ₹${outstandingRupees} still outstanding — collect full payment before marking complete`;
      }
    }
  }

  return null;
}


/** Unapproved design deliverables for a project (both deliverable systems). */
async function designGateError(tenantId: string, projectId: string): Promise<string | null> {
  const [proj] = await db
    .select({ leadId: projects.leadId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (!proj) return 'Stage gate failed: project not found';

  const [design, legacy] = await Promise.all([
    db.select({ status: designDeliverables.status })
      .from(designDeliverables)
      .where(projectDesignDeliverablesWhere(tenantId, projectId, proj.leadId)),
    db.select({ status: deliverables.status })
      .from(deliverables)
      .where(and(eq(deliverables.tenantId, tenantId), eq(deliverables.projectId, projectId))),
  ]);

  const result = designApproved([...design, ...legacy].map(d => d.status));
  if (!result.ok) {
    return `Stage gate failed: ${result.pending} design deliverable(s) not yet approved — get client sign-off before advancing`;
  }
  return null;
}
