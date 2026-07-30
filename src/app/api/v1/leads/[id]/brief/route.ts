import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leadActivities, leads, waMessages } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { groqProvider } from '@/lib/ai';

// ─── Schema ───────────────────────────────────────────────────────────────────

const BriefSchema = z.object({
  summary: z.string(),
  nextBestAction: z.string(),
  riskFlags: z.array(z.string()),
  sentiment: z.enum(['hot', 'warm', 'cold', 'lost']),
});

export type LeadBrief = z.infer<typeof BriefSchema>;

// ─── POST /api/v1/leads/[id]/brief ────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const [lead] = await db
      .select({
        contactName:       leads.contactName,
        contactPhone:      leads.contactPhone,
        stage:             leads.stage,
        source:            leads.source,
        budgetBand:        leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        propertyType:      leads.propertyType,
        projectLocation:   leads.projectLocation,
        score:             leads.score,
        notes:             leads.notes,
        lastActivityAt:    leads.lastActivityAt,
        createdAt:         leads.createdAt,
      })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const activities = await db
      .select({
        type:        leadActivities.type,
        title:       leadActivities.title,
        description: leadActivities.description,
        createdAt:   leadActivities.createdAt,
      })
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.leadId, id),
          eq(leadActivities.tenantId, ctx.tenantId),
        ),
      )
      .orderBy(desc(leadActivities.createdAt))
      .limit(10);

    const messages = await db
      .select({
        direction:   waMessages.direction,
        bodyPreview: waMessages.bodyPreview,
        createdAt:   waMessages.createdAt,
      })
      .from(waMessages)
      .where(
        and(
          eq(waMessages.tenantId, ctx.tenantId),
          eq(waMessages.threadId, lead.contactPhone),
        ),
      )
      .orderBy(desc(waMessages.createdAt))
      .limit(5);

    const daysSinceLast = Math.floor(
      (Date.now() - new Date(lead.lastActivityAt).getTime()) / 86400000,
    );
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(lead.createdAt).getTime()) / 86400000,
    );

    const activityText =
      activities.length > 0
        ? activities
            .map(
              a =>
                `[${a.type.toUpperCase()} · ${new Date(a.createdAt).toLocaleDateString('en-IN')}] ${a.title}${a.description ? ': ' + a.description : ''}`,
            )
            .join('\n')
        : 'No recorded activities yet.';

    const waText =
      messages.length > 0
        ? messages
            .map(m => `[${m.direction.toUpperCase()}] ${m.bodyPreview ?? '(media)'}`)
            .join('\n')
        : 'No WhatsApp messages yet.';

    const brief = await groqProvider.chatJSON({
      model: 'heavy',
      schema: BriefSchema,
      system: `You are an AI assistant for The Interior Studio, an interior design studio in Coimbatore, Tamil Nadu.
Analyse the lead data and produce a concise sales brief for the designer.
Be specific, practical, and concise. Use Indian English. Reply with valid JSON only.`,
      user: `Lead: ${lead.contactName}
Phone: ${lead.contactPhone}
Stage: ${lead.stage.replace(/_/g, ' ')}
Budget band: ${lead.budgetBand ?? 'Not specified'}
Estimated project value: ${lead.projectValuePaise ? '₹' + (lead.projectValuePaise / 100).toLocaleString('en-IN') : 'Not specified'}
Property type: ${lead.propertyType ?? 'Not specified'}
Location: ${lead.projectLocation ?? 'Not specified'}
Lead source: ${lead.source.replace(/_/g, ' ')}
Lead score: ${lead.score ?? 0}/100
Days since last activity: ${daysSinceLast}
Days since created: ${daysSinceCreated}
Internal notes: ${lead.notes ?? 'None'}

Recent activities (newest first):
${activityText}

Recent WhatsApp messages (newest first):
${waText}

Return:
- summary: 2–3 sentence overview of where this lead stands and the key context the designer needs to know
- nextBestAction: one specific, concrete next step to take TODAY — personalised to the lead's current stage and context
- riskFlags: 0–3 short risk strings (e.g. "No activity for 14 days", "Budget not confirmed", "Competitor mentioned") — empty array if no risks
- sentiment: "hot" (strong signals, actively engaged), "warm" (moderate interest, occasional replies), "cold" (disengaged or slow), or "lost" (clear signals of dropped interest)`,
    });

    return NextResponse.json({ data: brief });
  } catch (e) {
    console.error('[POST /api/v1/leads/[id]/brief]', e);
    const msg = e instanceof Error ? e.message : 'Unable to generate brief';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
