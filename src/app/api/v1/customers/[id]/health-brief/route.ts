import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerActivities, customers, waMessages } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { groqProvider } from '@/lib/ai';

const HealthSchema = z.object({
  healthScore: z.number().min(0).max(100),
  status: z.enum(['healthy', 'at_risk', 'inactive', 'hot']),
  summary: z.string(),
  nudge: z.string(),
  riskFlags: z.array(z.string()),
});

export type CustomerHealthBrief = z.infer<typeof HealthSchema>;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const [customer] = await db
      .select({
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
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [activities, messages] = await Promise.all([
      db
        .select({ type: customerActivities.type, title: customerActivities.title, body: customerActivities.body, createdAt: customerActivities.createdAt })
        .from(customerActivities)
        .where(and(eq(customerActivities.customerId, id), eq(customerActivities.tenantId, ctx.tenantId)))
        .orderBy(desc(customerActivities.createdAt))
        .limit(10),

      db
        .select({ direction: waMessages.direction, bodyPreview: waMessages.bodyPreview, createdAt: waMessages.createdAt })
        .from(waMessages)
        .where(and(eq(waMessages.tenantId, ctx.tenantId), eq(waMessages.threadId, customer.phone)))
        .orderBy(desc(waMessages.createdAt))
        .limit(5),
    ]);

    const daysSinceContact = customer.lastContactedAt
      ? Math.floor((Date.now() - new Date(customer.lastContactedAt).getTime()) / 86400000)
      : null;

    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(customer.createdAt).getTime()) / 86400000,
    );

    const activityText = activities.length > 0
      ? activities.map(a =>
          `[${a.type.toUpperCase()} · ${new Date(a.createdAt).toLocaleDateString('en-IN')}] ${a.title}${a.body ? ': ' + a.body : ''}`,
        ).join('\n')
      : 'No recorded activities yet.';

    const waText = messages.length > 0
      ? messages.map(m => `[${m.direction.toUpperCase()}] ${m.bodyPreview ?? '(media)'}`).join('\n')
      : 'No WhatsApp messages yet.';

    const brief = await groqProvider.chatJSON({
      model: 'light',
      schema: HealthSchema,
      system: `You are an AI assistant for The Interior Studio, an interior design studio in Coimbatore, Tamil Nadu.
Analyse the customer relationship data and produce a health brief for the studio team.
Be specific, practical, and concise. Use Indian English. Reply with valid JSON only.`,
      user: `Customer: ${customer.fullName}
Phone: ${customer.phone}
Stage: ${customer.stage.replace(/_/g, ' ')}
Source: ${customer.source.replace(/_/g, ' ')}
City: ${customer.city ?? 'Not specified'}
Days since last contact: ${daysSinceContact !== null ? daysSinceContact : 'Never contacted'}
Days since created: ${daysSinceCreated}
Internal notes: ${customer.notes ?? 'None'}

Recent activities (newest first):
${activityText}

Recent WhatsApp messages (newest first):
${waText}

Return:
- healthScore: 0-100 (100 = highly engaged active client, 0 = completely dormant/lost)
- status: "hot" (actively engaged, strong signals), "healthy" (good regular contact), "at_risk" (declining contact, overdue follow-up), or "inactive" (no contact in 3+ weeks)
- summary: 2-3 sentence overview of the relationship status and key context
- nudge: one specific, concrete next action to take TODAY — personalised to stage and context
- riskFlags: 0-3 short risk strings like "No contact in 18 days", "Stage stagnant", "No projects linked" — empty array if healthy`,
    });

    return NextResponse.json({ data: brief });
  } catch (e) {
    console.error('[POST /api/v1/customers/:id/health-brief]', e);
    return NextResponse.json({ error: 'Unable to generate health brief' }, { status: 500 });
  }
}
