import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { measurementRounds, measurementItems, leads, users, siteVisits } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/measurements/[id] — single round with items
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid measurement id' }, { status: 400 });
  }

  try {
    const [round] = await db
      .select({
        id:                measurementRounds.id,
        tenantId:          measurementRounds.tenantId,
        leadId:            measurementRounds.leadId,
        projectId:         measurementRounds.projectId,
        siteVisitId:       measurementRounds.siteVisitId,
        status:            measurementRounds.status,
        measurementNumber: measurementRounds.measurementNumber,
        roundName:         measurementRounds.roundName,
        scheduledAt:       measurementRounds.scheduledAt,
        completedAt:       measurementRounds.completedAt,
        notes:             measurementRounds.notes,
        createdAt:         measurementRounds.createdAt,
        leadName:          leads.contactName,
        leadPhone:         leads.contactPhone,
        assignedToName:    users.fullName,
        siteVisitNumber:   siteVisits.visitNumber,
      })
      .from(measurementRounds)
      .leftJoin(leads,      eq(measurementRounds.leadId,       leads.id))
      .leftJoin(users,      eq(measurementRounds.assignedToId, users.id))
      .leftJoin(siteVisits, eq(measurementRounds.siteVisitId,  siteVisits.id))
      .where(and(eq(measurementRounds.id, id), eq(measurementRounds.tenantId, ctx.tenantId)))
      .limit(1);

    if (!round) return NextResponse.json({ error: 'Measurement round not found' }, { status: 404 });

    const items = await db
      .select()
      .from(measurementItems)
      .where(eq(measurementItems.roundId, id))
      .orderBy(asc(measurementItems.createdAt));

    return NextResponse.json({ data: { ...round, items } });
  } catch (e) {
    console.error('[GET /api/v1/measurements/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/measurements/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid measurement id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const schema = z.object({
    roundName: z.string().min(1).max(100).optional(),
    notes:     z.string().optional(),
    status:    z.enum(['draft', 'completed', 'revised']).optional(),
  }).refine(d => Object.keys(d).length > 0, { message: 'No fields to update' });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db
      .select({ id: measurementRounds.id })
      .from(measurementRounds)
      .where(and(eq(measurementRounds.id, id), eq(measurementRounds.tenantId, ctx.tenantId)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updates: Partial<typeof measurementRounds.$inferInsert> = {};
    if (parsed.data.roundName !== undefined) updates.roundName = parsed.data.roundName;
    if (parsed.data.notes     !== undefined) updates.notes     = parsed.data.notes;
    if (parsed.data.status    !== undefined) {
      updates.status = parsed.data.status;
      if (parsed.data.status === 'completed') updates.completedAt = new Date();
    }

    const [updated] = await db
      .update(measurementRounds)
      .set(updates)
      .where(eq(measurementRounds.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error('[PATCH /api/v1/measurements/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
