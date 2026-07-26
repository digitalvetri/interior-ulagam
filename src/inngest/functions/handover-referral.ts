import { and, eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { projects, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import { sql } from 'drizzle-orm';

interface HandoverInitiatedData {
  projectId: string;
  tenantId: string;
}

export const handoverReferral = inngest.createFunction(
  {
    id: 'handover-referral',
    name: 'Handover → NPS Referral Sequence',
    cancelOn: [
      {
        event: 'project/handover.cancelled',
        if: 'event.data.projectId == async.data.projectId',
      },
    ],
  },
  { event: 'project/handover.initiated' },
  async ({ event, step }) => {
    const { projectId, tenantId } = event.data as HandoverInitiatedData;

    const { contactPhone, contactName } = await step.run('fetch-client', async () => {
      const [row] = await db
        .select({
          contactPhone: leads.contactPhone,
          contactName: leads.contactName,
        })
        .from(projects)
        .innerJoin(leads, eq(projects.leadId, leads.id))
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.tenantId, tenantId),
          ),
        );

      if (!row) {
        throw new Error(`No project/lead found for projectId=${projectId} tenantId=${tenantId}`);
      }

      return { contactPhone: row.contactPhone, contactName: row.contactName };
    });

    await step.sleep('wait-1d-before-complete', '1d');

    await step.run('mark-complete', async () => {
      await db
        .update(projects)
        .set({ lifecycleStage: 'complete' })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.tenantId, tenantId),
          ),
        );
      return { marked: 'complete', projectId };
    });

    await step.sleep('wait-7d-before-nps', '7d');

    await step.run('send-nps', async () => {
      await whatsapp.send({
        type: 'template',
        to: contactPhone,
        templateName: 'nps_ping',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: contactName }],
          },
        ],
      });
      return { sent: true, to: contactPhone };
    });

    return { done: true, projectId, sequence: 'complete' };
  },
);
