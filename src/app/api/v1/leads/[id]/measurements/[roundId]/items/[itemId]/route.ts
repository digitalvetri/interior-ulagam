import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leads, measurementRounds, measurementItems } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const UpdateItemSchema = z
  .object({
    room: z.string().min(1).max(100).optional(),
    itemName: z.string().min(1).max(200).optional(),
    dimensionsJson: z
      .object({
        length: z.number().positive().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        area: z.number().positive().optional(),
        unit: z.enum(['ft', 'm', 'sqft', 'sqm']).optional(),
        notes: z.string().max(500).optional(),
      })
      .optional(),
    qty: z.number().int().min(1).optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

/** Verify the full ownership chain and return the item if valid. */
async function resolveItem(
  tenantId: string,
  leadId: string,
  roundId: string,
  itemId: string,
) {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);
  if (!lead) return { error: 'Lead not found', status: 404 as const, item: null };

  const [round] = await db
    .select({ id: measurementRounds.id })
    .from(measurementRounds)
    .where(and(eq(measurementRounds.id, roundId), eq(measurementRounds.leadId, leadId)))
    .limit(1);
  if (!round) return { error: 'Measurement round not found', status: 404 as const, item: null };

  const [item] = await db
    .select()
    .from(measurementItems)
    .where(and(eq(measurementItems.id, itemId), eq(measurementItems.roundId, roundId)))
    .limit(1);
  if (!item) return { error: 'Item not found', status: 404 as const, item: null };

  return { error: null, status: null, item };
}

// PATCH /api/v1/leads/[id]/measurements/[roundId]/items/[itemId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string; itemId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, roundId, itemId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateItemSchema.safeParse(body);
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
    const { error, status, item } = await resolveItem(ctx.tenantId, id, roundId, itemId);
    if (error || !item) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    const [updated] = await db
      .update(measurementItems)
      .set(parsed.data)
      .where(and(eq(measurementItems.id, itemId), eq(measurementItems.roundId, roundId)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/v1/leads/[id]/measurements/[roundId]/items/[itemId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/leads/[id]/measurements/[roundId]/items/[itemId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string; itemId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, roundId, itemId } = await params;

  try {
    const { error, status } = await resolveItem(ctx.tenantId, id, roundId, itemId);
    if (error) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    await db
      .delete(measurementItems)
      .where(and(eq(measurementItems.id, itemId), eq(measurementItems.roundId, roundId)));

    return NextResponse.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('[DELETE /api/v1/leads/[id]/measurements/[roundId]/items/[itemId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
