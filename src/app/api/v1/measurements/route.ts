import { NextResponse } from 'next/server';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { measurementRounds, measurementItems, leads, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/measurements — all rounds for this tenant, with lead info + item counts
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      contactName:    leads.contactName,
      contactPhone:   leads.contactPhone,
    })
    .from(measurementRounds)
    .innerJoin(leads, and(
      eq(measurementRounds.leadId, leads.id),
      eq(leads.tenantId, ctx.tenantId),
    ))
    .leftJoin(users, eq(measurementRounds.assignedToId, users.id))
    .where(eq(measurementRounds.tenantId, ctx.tenantId))
    .orderBy(asc(measurementRounds.createdAt));

  if (rounds.length === 0) return NextResponse.json({ data: [] });

  const roundIds = rounds.map(r => r.id);
  const itemCounts = await db
    .select({
      roundId:   measurementItems.roundId,
      itemCount: count(measurementItems.id),
    })
    .from(measurementItems)
    .where(inArray(measurementItems.roundId, roundIds))
    .groupBy(measurementItems.roundId);

  const countMap = new Map(itemCounts.map(r => [r.roundId, Number(r.itemCount)]));

  const data = rounds.map(r => ({
    ...r,
    itemCount: countMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ data });
}
