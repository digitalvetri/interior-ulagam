import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leads, measurementRounds } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const UpdateRoundSchema = z
  .object({
    completedAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().max(2000).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .strict();

// PATCH /api/v1/leads/[id]/measurements/[roundId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, roundId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const [round] = await db
      .select({ id: measurementRounds.id })
      .from(measurementRounds)
      .where(and(eq(measurementRounds.id, roundId), eq(measurementRounds.leadId, id)))
      .limit(1);
    if (!round) return NextResponse.json({ error: 'Measurement round not found' }, { status: 404 });

    // Build the update set carefully — undefined means "don't touch the field",
    // while explicit null means "clear the value" (e.g., unassign assignedToId).
    const set: {
      completedAt?: Date | null;
      notes?: string;
      assignedToId?: string | null;
    } = {};

    if (parsed.data.completedAt !== undefined) {
      set.completedAt = new Date(parsed.data.completedAt);
    }
    if (parsed.data.notes !== undefined) {
      set.notes = parsed.data.notes;
    }
    if (parsed.data.assignedToId !== undefined) {
      set.assignedToId = parsed.data.assignedToId;
    }

    const [updated] = await db
      .update(measurementRounds)
      .set(set)
      .where(and(eq(measurementRounds.id, roundId), eq(measurementRounds.leadId, id)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/v1/leads/[id]/measurements/[roundId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
