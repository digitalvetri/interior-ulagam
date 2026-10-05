import { and, eq, inArray } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { milestones } from '@/lib/db/schema';
import { loadProjectMoney } from '@/lib/project-money/server';
import { shouldMarkOverdue } from '@/lib/finance/overdue';

export const overdueEscalation = defineJob(
  {
    id: 'overdue-escalation',
    name: 'Overdue Milestone Escalation',
  },
  { cron: '0 9 * * *' },
  async ({ step }) => {
    // ── Step 1: Projects (per tenant) with unpaid milestones ──────────────────
    const projectsToCheck = await step.run('find-candidates', async () => {
      const rows = await db
        .selectDistinct({ tenantId: milestones.tenantId, projectId: milestones.projectId })
        .from(milestones)
        .where(inArray(milestones.paymentStatus, ['link_sent', 'pending']));
      return rows;
    });

    if (projectsToCheck.length === 0) {
      return { done: true, processed: 0 };
    }

    // ── Step 2: Flag the ones the money engine says are overdue ───────────────
    // Overdue = fallen due (date or stage reached), past the grace days, balance unpaid.
    const updated = await step.run('process-overdue', async () => {
      const ids: string[] = [];
      for (const { tenantId, projectId } of projectsToCheck) {
        const money = await loadProjectMoney(tenantId, projectId);
        if (!money) continue;
        const stored = await db.select({ id: milestones.id, paymentStatus: milestones.paymentStatus })
          .from(milestones)
          .where(and(eq(milestones.tenantId, tenantId), eq(milestones.projectId, projectId)));
        const storedById = new Map(stored.map(s => [s.id, s.paymentStatus]));
        const due = money.milestones
          .filter(m => { const s = storedById.get(m.id); return !!s && shouldMarkOverdue(m, s); })
          .map(m => m.id);
        if (due.length === 0) continue;
        await db.update(milestones)
          .set({ paymentStatus: 'overdue' })
          .where(and(eq(milestones.tenantId, tenantId), inArray(milestones.id, due), inArray(milestones.paymentStatus, ['link_sent', 'pending'])));
        ids.push(...due);
      }
      return { markedOverdue: ids.length, ids };
    });

    return { done: true, processed: projectsToCheck.length, ...updated };
  },
);
