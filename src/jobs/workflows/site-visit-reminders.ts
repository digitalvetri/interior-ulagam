import { eq, and } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { siteVisits, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import {
  HOUR,
  scheduleVisitReminder24h,
  scheduleVisitReminder2h,
} from '@/jobs/workflows/schedule';

/**
 * Site-visit reminders — 24 hours and 2 hours before the visit time
 * (legacy payloads without scheduledAt: 20h after scheduling, then 22h later).
 *
 * Split from a single sleeping Inngest function into delayed jobs keyed on the
 * visit id. Both stages re-read the visit and skip once it is completed, so a
 * finished visit never produces a reminder even though nothing cancels these.
 */
export interface SiteVisitData {
  siteVisitId: string;
  tenantId: string;
  leadId: string;
  /** ISO time of the visit. When present, reminders fire 24h and 2h before it. */
  scheduledAt?: string;
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
    .select({
      id: siteVisits.id, completedAt: siteVisits.completedAt,
      status: siteVisits.status, scheduledAt: siteVisits.scheduledAt,
    })
    .from(siteVisits)
    .where(and(eq(siteVisits.id, data.siteVisitId), eq(siteVisits.tenantId, data.tenantId)));

  if (!visit) return { skipped: true, reason: 'site visit not found' };
  if (visit.completedAt) return { skipped: true, reason: 'site visit already completed' };
  if (visit.status === 'cancelled' || visit.status === 'no_show') {
    return { skipped: true, reason: `site visit ${visit.status}` };
  }
  // A reschedule re-enqueues fresh reminders; drop any stale one for the old time.
  if (data.scheduledAt && visit.scheduledAt.getTime() !== new Date(data.scheduledAt).getTime()) {
    return { skipped: true, reason: 'site visit was rescheduled' };
  }

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
    const payload = data as unknown as Record<string, unknown>;
    if (!data.scheduledAt) {
      // Legacy payload without the visit time: fixed offsets from scheduling.
      await scheduleVisitReminder24h(payload, data.siteVisitId);
      return { scheduled: '24h', siteVisitId: data.siteVisitId };
    }
    const visitAt = new Date(data.scheduledAt).getTime();
    const now = Date.now();
    const scheduled: string[] = [];
    if (visitAt - 24 * HOUR > now) {
      await scheduleVisitReminder24h(payload, data.siteVisitId, visitAt - 24 * HOUR - now);
      scheduled.push('24h');
    }
    if (visitAt - 2 * HOUR > now) {
      await scheduleVisitReminder2h(payload, data.siteVisitId, visitAt - 2 * HOUR - now);
      scheduled.push('2h');
    }
    return { scheduled, siteVisitId: data.siteVisitId };
  },
);

export const siteVisitReminder24h = defineJob(
  { id: 'site-visit-reminder-24h', name: 'Site Visit Reminder — 24h' },
  { event: 'site_visit/reminder.24h' },
  async ({ event }) => {
    const data = event.data as SiteVisitData;
    const outcome = await sendReminder(data, 'site_visit_reminder_24h', '24h');
    // Legacy payloads chain the 2-hour reminder from here; time-based payloads
    // already scheduled it relative to the visit in the start job.
    if (!data.scheduledAt) {
      await scheduleVisitReminder2h(data as unknown as Record<string, unknown>, data.siteVisitId);
    }
    return outcome;
  },
);

export const siteVisitReminder2h = defineJob(
  { id: 'site-visit-reminder-2h', name: 'Site Visit Reminder — 2h' },
  { event: 'site_visit/reminder.2h' },
  async ({ event }) => sendReminder(event.data as SiteVisitData, 'site_visit_reminder_2h', '2h'),
);
