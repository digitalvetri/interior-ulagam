import { and, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { leads, users } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import {
  scheduleFollowupDay3,
  scheduleFollowupDay7,
  scheduleFollowupDay14,
} from '@/jobs/workflows/schedule';

/**
 * Lead follow-up nudge sequence — day 3, day 7, then a day-14 owner alert.
 *
 * Was a single Inngest function that slept between nudges. Each wait is now its
 * own delayed job (`followup:<leadId>:day7`), so the sequence survives a worker
 * restart and a reply can cancel the remainder by removing those ids — see
 * cancelFollowupSequence, called from the WhatsApp webhook.
 *
 * Every stage re-checks the lead's stage before sending: cancellation is an
 * optimisation, this is the correctness guarantee. A lead that has been won,
 * lost, or archived is never nudged, even if a cancel was missed.
 */
export interface FollowupData {
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

async function isLeadNudgeable(leadId: string, tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ stage: leads.stage })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
  return !!row && NUDGEABLE_STAGES.has(row.stage);
}

async function sendNudge(
  data: FollowupData,
  templateName: string,
): Promise<void> {
  await whatsapp.send({
    type: 'template',
    to: data.contactPhone,
    templateName,
    languageCode: 'en',
    components: [
      { type: 'body', parameters: [{ type: 'text', text: data.contactName }] },
    ],
  });
}

/** Entry point — schedules the first nudge and returns. */
export const leadFollowupStart = defineJob(
  { id: 'lead-followup-start', name: 'Lead Follow-up — start' },
  { event: 'lead/followup.start' },
  async ({ event }) => {
    const data = event.data as FollowupData;
    await scheduleFollowupDay3(data as unknown as Record<string, unknown>, data.leadId);
    return { scheduled: 'day3', leadId: data.leadId };
  },
);

export const leadFollowupDay3 = defineJob(
  { id: 'lead-followup-day3', name: 'Lead Follow-up — day 3' },
  { event: 'lead/followup.day3' },
  async ({ event }) => {
    const data = event.data as FollowupData;
    if (!(await isLeadNudgeable(data.leadId, data.tenantId))) {
      return { skipped: true, stoppedAt: 'day-3-check' };
    }
    // Template "lead_followup_day3", pre-approved in Meta Business Manager.
    await sendNudge(data, 'lead_followup_day3');
    await scheduleFollowupDay7(data as unknown as Record<string, unknown>, data.leadId);
    return { sent: true, day: 3 };
  },
);

export const leadFollowupDay7 = defineJob(
  { id: 'lead-followup-day7', name: 'Lead Follow-up — day 7' },
  { event: 'lead/followup.day7' },
  async ({ event }) => {
    const data = event.data as FollowupData;
    if (!(await isLeadNudgeable(data.leadId, data.tenantId))) {
      return { skipped: true, stoppedAt: 'day-7-check' };
    }
    await sendNudge(data, 'lead_followup_day7');
    await scheduleFollowupDay14(data as unknown as Record<string, unknown>, data.leadId);
    return { sent: true, day: 7 };
  },
);

export const leadFollowupDay14 = defineJob(
  { id: 'lead-followup-day14', name: 'Lead Follow-up — day 14 owner alert' },
  { event: 'lead/followup.day14' },
  async ({ event }) => {
    const { leadId, tenantId, contactName } = event.data as FollowupData;

    const [lead] = await db
      .select({ stage: leads.stage, ownerId: leads.ownerId })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    if (!lead || !NUDGEABLE_STAGES.has(lead.stage)) {
      return { skipped: true, reason: 'lead no longer active' };
    }
    if (!lead.ownerId) return { skipped: true, reason: 'no owner assigned' };

    const [owner] = await db
      .select({ phone: users.phone, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.id, lead.ownerId), eq(users.tenantId, tenantId)));

    if (!owner?.phone) return { skipped: true, reason: 'owner has no phone' };

    // Template "owner_lead_no_reply_alert".
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

    return { sent: true, alertedOwner: owner.phone, sequence: 'complete' };
  },
);
