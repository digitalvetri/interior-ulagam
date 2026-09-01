import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { measurementRounds, measurementItems, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const DimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width:  z.number().positive().optional(),
  height: z.number().positive().optional(),
  area:   z.number().positive().optional(),
  unit:   z.enum(['ft', 'm', 'sqft', 'sqm']).default('sqft'),
  notes:  z.string().max(500).optional(),
});

const CreateItemSchema = z.object({
  room:           z.string().min(1).max(100),
  itemName:       z.string().min(1).max(200),
  dimensionsJson: DimensionsSchema.default({ unit: 'sqft' }),
  qty:            z.number().int().min(1).default(1),
  unit:           z.string().max(20).default('sqft'),
  notes:          z.string().max(1000).nullable().optional(),
});

// GET /api/v1/leads/[id]/measurements/[roundId]/items
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const { id, roundId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

  const items = await db
    .select()
    .from(measurementItems)
    .where(eq(measurementItems.roundId, roundId))
    .orderBy(asc(measurementItems.createdAt));

  return NextResponse.json({ data: items });
}

// POST /api/v1/leads/[id]/measurements/[roundId]/items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const { id, roundId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

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
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

  const { room, itemName, dimensionsJson, qty, unit, notes } = parsed.data;
  const [item] = await db
    .insert(measurementItems)
    .values({
      roundId,
      room,
      itemName,
      dimensionsJson,
      qty,
      unit,
      notes: notes ?? null,
    })
    .returning();

  return NextResponse.json({ data: item }, { status: 201 });
}
