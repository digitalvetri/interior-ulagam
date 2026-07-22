import { and, eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { leads, users } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';

interface LeadFollowupStartData {
  leadId: string;
  tenantId: string;
  contactPhone: string;
  contactName: string;
}

// Stages where nudging the client still makes sense — stop once won/lost
const NUDGEABLE_STAGES = new Set([
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
]);

async function isLeadNudgeable(
  leadId: string,
  tenantId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ stage: leads.stage })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
  return !!row && NUDGEABLE_STAGES.has(row.stage);
}

export const leadFollowupNudge = inngest.createFunction(
  {
    id: 'lead-followup-nudge',
    name: 'Lead Follow-up Nudge Sequence',
    // Cancel the whole sequence the moment the client sends any WhatsApp reply
    cancelOn: [
      {
        event: 'lead/replied',
        // `async` refers to the data of the *triggering* event (lead/followup.start)
        if: 'event.data.tenantId == async.data.tenantId && event.data.contactPhone == async.data.contactPhone',
      },
    ],
  },
  { event: 'lead/followup.start' },
  async ({ event, step }) => {
    const { leadId, tenantId, contactPhone, contactName } =
      event.data as LeadFollowupStartData;

    // ── Nudge 1 — Day 3 ───────────────────────────────────────────────────────
    await step.sleep('wait-3-days', '3d');

    const nudge1 = await step.run('nudge-1-send', async () => {
      if (!(await isLeadNudgeable(leadId, tenantId))) {
        return { skipped: true } as const;
      }

      // Utility template pre-approved in Meta Business Manager.
      // Template: "lead_followup_day3"
      // Body: "Hi {{1}}, just checking in — would you like to schedule a consultation?"
      await whatsapp.send({
        type: 'template',
        to: contactPhone,
        templateName: 'lead_followup_day3',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: contactName }],
          },
        ],
      });

      return { sent: true, day: 3 } as const;
    });

    if ('skipped' in nudge1) return { done: true, stoppedAt: 'day-3-check' };

    // ── Nudge 2 — Day 7 (4 more days after day 3) ────────────────────────────
    await step.sleep('wait-day-7', '4d');

    const nudge2 = await step.run('nudge-2-send', async () => {
      if (!(await isLeadNudgeable(leadId, tenantId))) {
        return { skipped: true } as const;
      }

      // Template: "lead_followup_day7"
      // Body: "Hi {{1}}, we'd love to help bring your dream space to life. Can we connect this week?"
      await whatsapp.send({
        type: 'template',
        to: contactPhone,
        templateName: 'lead_followup_day7',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: contactName }],
          },
        ],
      });

      return { sent: true, day: 7 } as const;
    });

    if ('skipped' in nudge2) return { done: true, stoppedAt: 'day-7-check' };

    // ── Day 14 — Owner alert (7 more days after day 7) ───────────────────────
    await step.sleep('wait-day-14', '7d');

    await step.run('owner-alert-day-14', async () => {
      const [lead] = await db
        .select({ stage: leads.stage, ownerId: leads.ownerId })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      if (!lead || !NUDGEABLE_STAGES.has(lead.stage)) {
        return { skipped: true, reason: 'lead no longer active' } as const;
      }
      if (!lead.ownerId) {
        return { skipped: true, reason: 'no owner assigned' } as const;
      }

      const [owner] = await db
        .select({ phone: users.phone, fullName: users.fullName })
        .from(users)
        .where(and(eq(users.id, lead.ownerId), eq(users.tenantId, tenantId)));

      if (!owner?.phone) {
        return { skipped: true, reason: 'owner has no phone' } as const;
      }

      // Template: "owner_lead_no_reply_alert"
      // Body: "Lead {{1}} has not replied in {{2}} days. Consider a personal outreach or marking as lost."
      await whatsapp.send({
        type: 'template',
        to: owner.phone,
        templateName: 'owner_lead_no_reply_alert',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: contactName },
              { type: 'text', text: '14' },
            ],
          },
        ],
      });

      return { sent: true, alertedOwner: owner.phone } as const;
    });

    return { done: true, leadId, sequence: 'complete' };
  },
);
