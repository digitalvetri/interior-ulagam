import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { customerActivities, customers, tenants, waMessages } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai';
import { z } from 'zod';

const HealthSchema = z.object({
  healthScore: z.number().min(0).max(100),
  status: z.enum(['healthy', 'at_risk', 'inactive', 'hot']),
  summary: z.string(),
  nudge: z.string(),
  riskFlags: z.array(z.string()),
});

// Runs every Monday at 06:00 IST (00:30 UTC).
// Scores all customers across all tenants — uses Groq light model (cheap).
// Results written back to customers.health_score / health_status / health_updated_at.
export const customerHealthWeekly = inngest.createFunction(
  { id: 'customer-health-weekly', name: 'Customer Health — Weekly Scoring' },
  { cron: '30 0 * * 1' },
  async ({ step }) => {
    // Fetch every tenant that has at least one customer
    const tenantRows = await step.run('fetch-tenants', async () =>
      db
        .selectDistinct({ tenantId: customers.tenantId })
        .from(customers),
    );

    let scored = 0;

    for (const { tenantId } of tenantRows) {
      // Process each tenant's customers in a named step so Inngest can resume
      await step.run(`score-tenant-${tenantId}`, async () => {
        const allCustomers = await db
          .select({
            id:              customers.id,
            fullName:        customers.fullName,
            phone:           customers.phone,
            stage:           customers.stage,
            source:          customers.source,
            city:            customers.city,
            lastContactedAt: customers.lastContactedAt,
            notes:           customers.notes,
            createdAt:       customers.createdAt,
          })
          .from(customers)
          .where(eq(customers.tenantId, tenantId));

        for (const customer of allCustomers) {
          try {
            const [activities, messages] = await Promise.all([
              db
                .select({ type: customerActivities.type, title: customerActivities.title, body: customerActivities.body, createdAt: customerActivities.createdAt })
                .from(customerActivities)
                .where(and(eq(customerActivities.customerId, customer.id), eq(customerActivities.tenantId, tenantId)))
                .orderBy(desc(customerActivities.createdAt))
                .limit(10),
              db
                .select({ direction: waMessages.direction, bodyPreview: waMessages.bodyPreview, createdAt: waMessages.createdAt })
                .from(waMessages)
                .where(and(eq(waMessages.tenantId, tenantId), eq(waMessages.threadId, customer.phone)))
                .orderBy(desc(waMessages.createdAt))
                .limit(5),
            ]);

            const daysSinceContact = customer.lastContactedAt
              ? Math.floor((Date.now() - new Date(customer.lastContactedAt).getTime()) / 86400000)
              : null;
            const daysSinceCreated = Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / 86400000);

            const activityText = activities.length > 0
              ? activities.map(a => `[${a.type.toUpperCase()}] ${a.title}${a.body ? ': ' + a.body : ''}`).join('\n')
              : 'No recorded activities.';
            const waText = messages.length > 0
              ? messages.map(m => `[${m.direction.toUpperCase()}] ${m.bodyPreview ?? '(media)'}`).join('\n')
              : 'No WhatsApp messages.';

            const brief = await groqProvider.chatJSON({
              model: 'light',
              schema: HealthSchema,
              system: 'You are a CRM health scoring assistant. Score customer relationship health concisely. Reply with valid JSON only.',
              user: `Customer: ${customer.fullName} | Stage: ${customer.stage} | Days since contact: ${daysSinceContact ?? 'never'} | Days since created: ${daysSinceCreated}\nActivities:\n${activityText}\nWhatsApp:\n${waText}`,
            });

            await db
              .update(customers)
              .set({
                healthScore:     brief.healthScore,
                healthStatus:    brief.status,
                healthUpdatedAt: new Date(),
              })
              .where(and(eq(customers.id, customer.id), eq(customers.tenantId, tenantId)));

            scored++;
          } catch {
            // Skip individual failures — don't abort the whole tenant batch
          }
        }
      });
    }

    return { scored };
  },
);
