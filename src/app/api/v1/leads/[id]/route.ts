import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, waMessages } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { inngest } from '@/inngest/client';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const LeadStageEnum = z.enum([
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
]);

const PatchLeadSchema = z
  .object({
    stage: LeadStageEnum,
    ownerId: z.string().uuid().nullable(),
    notes: z.string(),
    lostReason: z.string(),
    budgetBand: z.string(),
    followUpDate: z.union([z.string().datetime({ offset: true }), z.string().date(), z.null()]),
  })
  .partial();

// ─── GET /api/v1/leads/[id] ──────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const [lead] = await db
      .select({
        id: leads.id,
        tenantId: leads.tenantId,
        source: leads.source,
        stage: leads.stage,
        priority: leads.priority,
        ownerId: leads.ownerId,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        contactEmail: leads.contactEmail,
        propertyType: leads.propertyType,
        projectLocation: leads.projectLocation,
        budgetBand: leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName: leads.designerName,
        followUpDate: leads.followUpDate,
        lostReason: leads.lostReason,
        notes: leads.notes,
        score: leads.score,
        scoreBreakdown: leads.scoreBreakdown,
        firstTouchAt: leads.firstTouchAt,
        lastActivityAt: leads.lastActivityAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Include last 3 WA messages for the thread preview panel
    const recentMessages = await db
      .select({
        id: waMessages.id,
        direction: waMessages.direction,
        bodyPreview: waMessages.bodyPreview,
        createdAt: waMessages.createdAt,
      })
      .from(waMessages)
      .where(
        and(
          eq(waMessages.tenantId, ctx.tenantId),
          eq(waMessages.threadId, lead.contactPhone),
        ),
      )
      .orderBy(desc(waMessages.createdAt))
      .limit(3);

    return NextResponse.json({ data: { ...lead, recentMessages } });
  } catch (e) {
    console.error('[GET /api/v1/leads/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/v1/leads/[id] ────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  const { followUpDate, ...rest } = parsed.data;
  const updates: Partial<typeof leads.$inferInsert> = { ...rest };
  if (followUpDate !== undefined) {
    updates.followUpDate = followUpDate === null ? null : new Date(followUpDate);
  }

  // Update lastActivityAt whenever any field is patched
  updates.lastActivityAt = new Date();

  try {
    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Rescore asynchronously — don't block the PATCH response
    void inngest.send({ name: 'lead/score.compute', data: { leadId: id, tenantId: ctx.tenantId } });

    return NextResponse.json({ data: updated, message: 'Lead updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
