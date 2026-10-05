import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { designDeliverables } from '@/lib/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/**
 * Attach a lead's design deliverables (created on the lead's "Designs" tab
 * before booking) to the project the lead became. Only rows not yet linked to
 * a project are touched. Called by lead convert, quote book and project create.
 */
export async function linkLeadDesignDeliverables(
  tx: Db, tenantId: string, leadId: string, projectId: string,
): Promise<void> {
  await tx.update(designDeliverables)
    .set({ projectId })
    .where(and(
      eq(designDeliverables.tenantId, tenantId),
      eq(designDeliverables.leadId, leadId),
      isNull(designDeliverables.projectId),
    ));
}

/**
 * WHERE condition for "this project's design deliverables": rows linked to the
 * project, plus rows still sitting on the project's lead (made before booking
 * and not yet linked). Used by the design gate, the deliverables list and the
 * client portal so all three agree.
 */
export function projectDesignDeliverablesWhere(tenantId: string, projectId: string, leadId: string | null) {
  return and(
    eq(designDeliverables.tenantId, tenantId),
    or(
      eq(designDeliverables.projectId, projectId),
      leadId ? and(isNull(designDeliverables.projectId), eq(designDeliverables.leadId, leadId)) : undefined,
    ),
  );
}
