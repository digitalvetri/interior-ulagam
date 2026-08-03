import { inArray } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { milestones } from '@/lib/db/schema';

interface OverdueMilestone {
  id: string;
  createdAt: Date;
}

export const overdueEscalation = defineJob(
  {
    id: 'overdue-escalation',
    name: 'Overdue Milestone Escalation',
  },
  { cron: '0 9 * * *' },
  async ({ step }) => {
    // ── Step 1: Find all milestones that are pending or link_sent ─────────────
    const overdueList = await step.run('find-overdue', async () => {
      const rows = await db
        .select({
          id: milestones.id,
          createdAt: milestones.createdAt,
        })
        .from(milestones)
        .where(
          inArray(milestones.paymentStatus, ['link_sent', 'pending']),
        );

      return rows as OverdueMilestone[];
    });

    if (overdueList.length === 0) {
      return { done: true, processed: 0 };
    }

    // ── Step 2: Mark milestones overdue if age >= 3 days ──────────────────────
    const updated = await step.run('process-overdue', async () => {
      const now = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      const overdueIds: string[] = overdueList
        .filter((m) => now - new Date(m.createdAt).getTime() >= threeDaysMs)
        .map((m) => m.id);

      if (overdueIds.length === 0) {
        return { markedOverdue: 0 } as const;
      }

      await db
        .update(milestones)
        .set({ paymentStatus: 'overdue' })
        .where(inArray(milestones.id, overdueIds));

      return { markedOverdue: overdueIds.length, ids: overdueIds } as const;
    });

    return { done: true, processed: overdueList.length, ...updated };
  },
);
