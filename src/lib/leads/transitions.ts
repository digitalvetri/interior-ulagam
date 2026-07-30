import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  leads, projects, quotes as quotesTable, leadActivities, notifications,
} from '@/lib/db/schema';
import { propagateLeadStageToCustomer } from '@/lib/customers/sync';
import { inngest } from '@/inngest/client';
import type { LeadStage } from '@/types/leads';

/**
 * Authoritative handler for all lead stage transitions.
 * Covers: DB update, activity log, customer sync (upgrade-only),
 * async rescore, project creation + quote linkage (won),
 * and in-app notifications (won / lost).
 */
export async function applyStageTransition(
  leadId: string,
  tenantId: string,
  userId: string | null,
  targetStage: LeadStage,
  lostReason?: string,
) {
  const [current] = await db
    .select({
      stage: leads.stage,
      customerId: leads.customerId,
      contactName: leads.contactName,
      projectName: leads.projectName,
      projectValuePaise: leads.projectValuePaise,
      ownerId: leads.ownerId,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!current) return null;

  const [updated] = await db
    .update(leads)
    .set({
      stage: targetStage,
      lostReason: targetStage === 'lost' ? (lostReason ?? null) : null,
      lastActivityAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .returning();

  if (!updated) return null;

  // No-op: stage didn't actually change — skip all side effects
  if (current.stage === targetStage) return updated;

  await db.insert(leadActivities).values({
    tenantId,
    leadId,
    type: 'stage_change',
    title: `Stage → ${targetStage.replace(/_/g, ' ')}`,
    description: targetStage === 'lost' && lostReason ? `Reason: ${lostReason}` : null,
    createdBy: userId ?? undefined,
  });

  if (current.customerId) {
    await propagateLeadStageToCustomer(current.customerId, targetStage, tenantId, userId);
  }

  void inngest.send({ name: 'lead/score.compute', data: { leadId, tenantId } });

  if (targetStage === 'won') {
    const projectName = current.projectName?.trim() || `${current.contactName}'s Project`;

    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.leadId, leadId)))
      .limit(1);

    let projectId: string | undefined;
    if (!existingProject) {
      const [created] = await db.insert(projects).values({
        tenantId,
        leadId,
        customerId: current.customerId ?? undefined,
        name: projectName,
        ...(current.projectValuePaise ? { totalContractPaise: current.projectValuePaise } : {}),
      }).returning({ id: projects.id });
      projectId = created?.id;
    } else {
      projectId = existingProject.id;
    }

    if (projectId) {
      await db.update(quotesTable)
        .set({ projectId })
        .where(and(eq(quotesTable.leadId, leadId), eq(quotesTable.tenantId, tenantId)));
    }

    const notifyUserId = current.ownerId ?? userId;
    if (notifyUserId) {
      await db.insert(notifications).values({
        tenantId,
        userId: notifyUserId,
        severity: 'success',
        title: 'Lead Won!',
        body: `${current.contactName} — project "${projectName}" created.`,
        href: projectId ? `/projects/${projectId}` : `/leads/${leadId}`,
      });
    }
  }

  if (targetStage === 'lost') {
    const notifyUserId = current.ownerId ?? userId;
    if (notifyUserId) {
      await db.insert(notifications).values({
        tenantId,
        userId: notifyUserId,
        severity: 'info',
        title: 'Lead Lost',
        body: `${current.contactName}${lostReason ? ` — ${lostReason}` : ''}.`,
        href: `/leads/${leadId}`,
      });
    }
  }

  return updated;
}
