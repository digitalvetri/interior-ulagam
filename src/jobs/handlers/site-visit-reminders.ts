import { eq, and } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { siteVisits, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';

interface SiteVisitScheduledData {
  siteVisitId: string;
  tenantId: string;
  leadId: string;
}

export const siteVisitReminders = defineJob(
  {
    id: 'site-visit-reminders',
    name: 'Site Visit Reminders',
  },
  { event: 'site_visit/scheduled' },
  async ({ event, step }) => {
    const { siteVisitId, tenantId, leadId } =
      event.data as SiteVisitScheduledData;

    // ── Wait 20 hours before the 24-hour reminder ─────────────────────────────
    await step.sleep('wait-20h', '20h');

    // ── Step: Send 24-hour reminder ───────────────────────────────────────────
    await step.run('send-24h-reminder', async () => {
      const [visit] = await db
        .select({
          id: siteVisits.id,
          completedAt: siteVisits.completedAt,
        })
        .from(siteVisits)
        .where(and(eq(siteVisits.id, siteVisitId), eq(siteVisits.tenantId, tenantId)));

      if (!visit) {
        return { skipped: true, reason: 'site visit not found' } as const;
      }

      if (visit.completedAt) {
        return { skipped: true, reason: 'site visit already completed' } as const;
      }

      const [lead] = await db
        .select({
          contactPhone: leads.contactPhone,
          contactName: leads.contactName,
        })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      if (!lead) {
        return { skipped: true, reason: 'lead not found' } as const;
      }

      await whatsapp.send({
        type: 'template',
        to: lead.contactPhone,
        templateName: 'site_visit_reminder_24h',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: lead.contactName }],
          },
        ],
      });

      return { sent: true, to: lead.contactPhone, reminder: '24h' } as const;
    });

    // ── Wait 22 more hours before the 2-hour reminder ─────────────────────────
    await step.sleep('wait-22h', '22h');

    // ── Step: Send 2-hour reminder ────────────────────────────────────────────
    await step.run('send-2h-reminder', async () => {
      const [visit] = await db
        .select({
          id: siteVisits.id,
          completedAt: siteVisits.completedAt,
        })
        .from(siteVisits)
        .where(and(eq(siteVisits.id, siteVisitId), eq(siteVisits.tenantId, tenantId)));

      if (!visit) {
        return { skipped: true, reason: 'site visit not found' } as const;
      }

      if (visit.completedAt) {
        return { skipped: true, reason: 'site visit already completed' } as const;
      }

      const [lead] = await db
        .select({
          contactPhone: leads.contactPhone,
          contactName: leads.contactName,
        })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      if (!lead) {
        return { skipped: true, reason: 'lead not found' } as const;
      }

      await whatsapp.send({
        type: 'template',
        to: lead.contactPhone,
        templateName: 'site_visit_reminder_2h',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: lead.contactName }],
          },
        ],
      });

      return { sent: true, to: lead.contactPhone, reminder: '2h' } as const;
    });

    return { done: true, siteVisitId, leadId };
  },
);
