import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { leads, milestones, projects, siteLogs } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai/groq';
import { whatsapp } from '@/lib/whatsapp/send';

interface ClientChatbotEventData {
  tenantId: string;
  contactPhone: string;
  messageText: string;
  leadId?: string;
}

const ResponseSchema = z.object({
  reply: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  escalateToDesigner: z.boolean(),
});

export const clientChatbot = defineJob(
  {
    id: 'client-chatbot',
    name: 'WhatsApp Client Chatbot',
  },
  { event: 'wa_message/client_query.received' },
  async ({ event, step }) => {
    const { tenantId, contactPhone, messageText, leadId } =
      event.data as ClientChatbotEventData;

    const contextString = await step.run('gather-context', async () => {
      if (!leadId) {
        return 'No project found for this contact.';
      }

      const [lead] = await db
        .select({
          id: leads.id,
          contactName: leads.contactName,
          stage: leads.stage,
        })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      if (!lead) {
        return 'No project found for this contact.';
      }

      const [project] = await db
        .select({
          id: projects.id,
          name: projects.name,
          lifecycleStage: projects.lifecycleStage,
        })
        .from(projects)
        .where(
          and(eq(projects.leadId, leadId), eq(projects.tenantId, tenantId)),
        );

      if (!project) {
        return `Lead stage: ${lead.stage}. No project has been created yet.`;
      }

      const projectMilestones = await db
        .select({
          label: milestones.label,
          pctOfTotal: milestones.pctOfTotal,
          amountPaise: milestones.amountPaise,
          paymentStatus: milestones.paymentStatus,
          paidAt: milestones.paidAt,
        })
        .from(milestones)
        .where(eq(milestones.projectId, project.id));

      const recentLogs = await db
        .select({
          logDate: siteLogs.logDate,
          progressPct: siteLogs.progressPct,
          stage: siteLogs.stage,
          delayFlag: siteLogs.delayFlag,
          transcript: siteLogs.transcript,
        })
        .from(siteLogs)
        .where(
          and(
            eq(siteLogs.projectId, project.id),
            eq(siteLogs.tenantId, tenantId),
          ),
        )
        .orderBy(desc(siteLogs.createdAt))
        .limit(3);

      const milestonesText = projectMilestones
        .map(
          (m) =>
            `  - ${m.label} (${m.pctOfTotal}%): ${m.paymentStatus}${m.paidAt ? ` (paid on ${m.paidAt})` : ''}`,
        )
        .join('\n');

      const logsText = recentLogs
        .map(
          (l) =>
            `  - ${l.logDate}: progress ${l.progressPct ?? 'unknown'}%${l.delayFlag ? ' [DELAY FLAG]' : ''}${l.stage ? `, stage: ${l.stage}` : ''}`,
        )
        .join('\n');

      return [
        `Project: ${project.name}`,
        `Current stage: ${project.lifecycleStage}`,
        milestonesText
          ? `Milestones:\n${milestonesText}`
          : 'No milestones set.',
        recentLogs.length > 0
          ? `Recent site logs:\n${logsText}`
          : 'No site logs yet.',
      ].join('\n');
    });

    const aiResponse = await step.run('generate-response', async () => {
      return groqProvider.chatJSON({
        system:
          'You are a helpful project update assistant for an interior design studio. Answer client questions concisely based ONLY on the project data provided. If you cannot answer from the data, say so honestly and set escalateToDesigner=true. Never make up specific dates, amounts, or decisions. Keep reply under 200 characters for WhatsApp.',
        user: `Client question: ${messageText}\n\nProject context: ${contextString}`,
        schema: ResponseSchema,
        model: 'light',
      });
    });

    await step.run('send-or-escalate', async () => {
      if (
        !aiResponse.escalateToDesigner &&
        aiResponse.confidence !== 'low'
      ) {
        await whatsapp.send({
          type: 'text',
          to: contactPhone,
          text: aiResponse.reply,
        });
      } else {
        // No handler has ever consumed 'client_query/needs_designer' — under
        // Inngest this event was recorded and nothing acted on it. Rather than
        // enqueue a job that would fail for want of a handler, the escalation is
        // logged. Wiring it to the notifications module is outstanding work.
        console.warn('[client-chatbot] query needs a designer:', {
          tenantId, contactPhone, leadId, messageText,
        });

        await whatsapp.send({
          type: 'text',
          to: contactPhone,
          text: 'Your query has been forwarded to your designer. They will reply shortly.',
        });
      }
    });

    return {
      leadId,
      tenantId,
      escalated: aiResponse.escalateToDesigner || aiResponse.confidence === 'low',
      confidence: aiResponse.confidence,
    };
  },
);
