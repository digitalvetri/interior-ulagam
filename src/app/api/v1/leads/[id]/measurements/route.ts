import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { measurementRounds, measurementItems, leads, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CreateRoundSchema = z.object({
  roundName:    z.string().min(1).max(100).default('Round 1'),
  scheduledAt:  z.string().datetime().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  notes:        z.string().max(2000).nullable().optional(),
});

// GET /api/v1/leads/[id]/measurements — all rounds + items for a lead
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const rounds = await db
    .select({
      id:             measurementRounds.id,
      leadId:         measurementRounds.leadId,
      roundName:      measurementRounds.roundName,
      scheduledAt:    measurementRounds.scheduledAt,
      completedAt:    measurementRounds.completedAt,
      assignedToId:   measurementRounds.assignedToId,
      assignedToName: users.fullName,
      notes:          measurementRounds.notes,
      createdAt:      measurementRounds.createdAt,
    })
    .from(measurementRounds)
    .leftJoin(users, eq(measurementRounds.assignedToId, users.id))
    .where(eq(measurementRounds.leadId, id))
    .orderBy(asc(measurementRounds.createdAt));

  const roundIds = rounds.map(r => r.id);
  const allItems = roundIds.length
    ? await db
        .select()
        .from(measurementItems)
        .where(inArray(measurementItems.roundId, roundIds))
        .orderBy(asc(measurementItems.createdAt))
    : [];

  const itemsByRound = new Map<string, typeof allItems>(rounds.map(r => [r.id, []]));
  for (const item of allItems) {
    itemsByRound.get(item.roundId)?.push(item);
  }

  const data = rounds.map(r => ({ ...r, items: itemsByRound.get(r.id) ?? [] }));
  return NextResponse.json({ data });
}

// POST /api/v1/leads/[id]/measurements — create a new measurement round
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = CreateRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { roundName, scheduledAt, assignedToId, notes } = parsed.data;
  const [round] = await db
    .insert(measurementRounds)
    .values({
      tenantId:     ctx.tenantId,
      leadId:       id,
      roundName,
      scheduledAt:  scheduledAt ? new Date(scheduledAt) : null,
      assignedToId: assignedToId ?? null,
      notes:        notes ?? null,
      createdBy:    ctx.dbUserId ?? undefined,
    })
    .returning();

  return NextResponse.json({ data: round }, { status: 201 });
}
