import { and, desc, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { customerActivities, waMessages } from '@/lib/db/schema';

// Triggered after a customer record is created (either via lead sync or manually).
// Checks for WhatsApp history and logs an enrichment activity.
// Lead-linking is handled inline in POST /api/v1/leads — not here.

interface CustomerCreatedData {
  customerId: string;
  tenantId: string;
  phone: string;
}

export const customerEnrich = defineJob(
  { id: 'customer-enrich', name: 'Customer Auto-Enrichment' },
  { event: 'customer/created' },
  async ({ event, step }) => {
    const { customerId, tenantId, phone } = event.data as CustomerCreatedData;

    // Step 1: Check for WA thread to confirm the phone is active
    const hasWaHistory = await step.run('check-wa', async () => {
      const [msg] = await db
        .select({ id: waMessages.id })
        .from(waMessages)
        .where(and(eq(waMessages.tenantId, tenantId), eq(waMessages.threadId, phone)))
        .limit(1);
      return !!msg;
    });

    if (!hasWaHistory) {
      return { customerId, hasWaHistory: false };
    }

    // Step 2: Fetch the most recent WA messages to surface in the activity note
    const recentMessages = await step.run('fetch-wa-preview', async () =>
      db
        .select({ direction: waMessages.direction, bodyPreview: waMessages.bodyPreview, createdAt: waMessages.createdAt })
        .from(waMessages)
        .where(and(eq(waMessages.tenantId, tenantId), eq(waMessages.threadId, phone)))
        .orderBy(desc(waMessages.createdAt))
        .limit(3),
    );

    // Step 3: Log WA history found on the activity timeline
    await step.run('log-wa-activity', async () => {
      const preview = recentMessages
        .map(m => `[${m.direction.toUpperCase()}] ${m.bodyPreview ?? '(media)'}`)
        .join(' · ');

      await db.insert(customerActivities).values({
        tenantId,
        customerId,
        type: 'whatsapp',
        title: 'WhatsApp history found',
        body: preview || null,
      });
    });

    return { customerId, hasWaHistory: true };
  },
);
