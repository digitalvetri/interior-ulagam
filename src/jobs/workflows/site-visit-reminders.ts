import { eq, and } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { siteVisits, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import {
  scheduleVisitReminder24h,
  scheduleVisitReminder2h,
} from '@/jobs/workflows/schedule';

/**
 * Site-visit reminders — one 20 hours after scheduling, another 22 hours later.
 *
 * Split from a single sleeping Inngest function into delayed jobs keyed on the
 * visit id. Both stages re-read the visit and skip once it is completed, so a
 * finished visit never produces a reminder even though nothing cancels these.
 */
export interface SiteVisitData {
  siteVisitId: string;
  tenantId: string;
  leadId: string;
}

type ReminderOutcome =
  | { skipped: true; reason: string }
  | { sent: true; to: string; reminder: string };

async function sendReminder(
  data: SiteVisitData,
  templateName: string,
  label: string,
): Promise<ReminderOutcome> {
  const [visit] = await db
    .select({ id: siteVisits.id, completedAt: siteVisits.completedAt })
    .from(siteVisits)
    .where(and(eq(siteVisits.id, data.siteVisitId), eq(siteVisits.tenantId, data.tenantId)));

  if (!visit) return { skipped: true, reason: 'site visit not found' };
  if (visit.completedAt) return { skipped: true, reason: 'site visit already completed' };

  const [lead] = await db
    .select({ contactPhone: leads.contactPhone, contactName: leads.contactName })
    .from(leads)
    .where(and(eq(leads.id, data.leadId), eq(leads.tenantId, data.tenantId)));

  if (!lead) return { skipped: true, reason: 'lead not found' };

  await whatsapp.send({
    type: 'template',
    to: lead.contactPhone,
    templateName,
    languageCode: 'en',
    components: [
      { type: 'body', parameters: [{ type: 'text', text: lead.contactName }] },
    ],
  });

  return { sent: true, to: lead.contactPhone, reminder: label };
}

export const siteVisitRemindersStart = defineJob(
  { id: 'site-visit-reminders-start', name: 'Site Visit Reminders — start' },
  { event: 'site_visit/scheduled' },
  async ({ event }) => {
    const data = event.data as SiteVisitData;
    await scheduleVisitReminder24h(data as unknown as Record<string, unknown>, data.siteVisitId);
    return { scheduled: '24h', siteVisitId: data.siteVisitId };
  },
);

export const siteVisitReminder24h = defineJob(
  { id: 'site-visit-reminder-24h', name: 'Site Visit Reminder — 24h' },
  { event: 'site_visit/reminder.24h' },
  async ({ event }) => {
    const data = event.data as SiteVisitData;
    const outcome = await sendReminder(data, 'site_visit_reminder_24h', '24h');
    // The 2-hour reminder is scheduled regardless: it re-checks completion
    // itself, and a visit that is merely un-findable now may exist later.
    await scheduleVisitReminder2h(data as unknown as Record<string, unknown>, data.siteVisitId);
    return outcome;
  },
);

export const siteVisitReminder2h = defineJob(
  { id: 'site-visit-reminder-2h', name: 'Site Visit Reminder — 2h' },
  { event: 'site_visit/reminder.2h' },
  async ({ event }) => sendReminder(event.data as SiteVisitData, 'site_visit_reminder_2h', '2h'),
);
