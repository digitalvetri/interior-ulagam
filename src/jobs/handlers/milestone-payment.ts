import { eq, and } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { milestones, projects, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';

interface MilestonePaymentCapturedData {
  milestoneId: string;
  projectId: string;
  tenantId: string;
  amountPaise: number;
}

export const milestonePaymentCaptured = defineJob(
  {
    id: 'milestone-payment-captured',
    name: 'Milestone Payment Captured',
  },
  { event: 'milestone/payment.captured' },
  async ({ event, step }) => {
    const { milestoneId, projectId, tenantId, amountPaise } =
      event.data as MilestonePaymentCapturedData;

    // ── Step 1: Send payment receipt via WhatsApp ─────────────────────────────
    await step.run('send-receipt', async () => {
      const [project] = await db
        .select({
          id: projects.id,
          leadId: projects.leadId,
        })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

      if (!project) {
        return { skipped: true, reason: 'project not found' } as const;
      }

      if (!project.leadId) {
        return { skipped: true, reason: 'project has no lead' } as const;
      }

      const [lead] = await db
        .select({
          contactPhone: leads.contactPhone,
          contactName: leads.contactName,
        })
        .from(leads)
        .where(and(eq(leads.id, project.leadId), eq(leads.tenantId, tenantId)));

      if (!lead) {
        return { skipped: true, reason: 'lead not found' } as const;
      }

      const amountInRupees = (amountPaise / 100).toLocaleString('en-IN');

      await whatsapp.send({
        type: 'template',
        to: lead.contactPhone,
        templateName: 'payment_receipt',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: lead.contactName },
              { type: 'text', text: amountInRupees },
            ],
          },
        ],
      });

      return { sent: true, to: lead.contactPhone } as const;
    });

    // ── Step 2: Check and apply stage unlock ──────────────────────────────────
    await step.run('check-stage-unlock', async () => {
      const [milestone] = await db
        .select({
          triggerStage: milestones.triggerStage,
        })
        .from(milestones)
        .where(eq(milestones.id, milestoneId));

      if (!milestone?.triggerStage) {
        return { skipped: true, reason: 'no trigger stage configured' } as const;
      }

      await db
        .update(projects)
        .set({ lifecycleStage: milestone.triggerStage })
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

      return { unlocked: true, newStage: milestone.triggerStage } as const;
    });

    return { done: true, milestoneId, projectId };
  },
);
