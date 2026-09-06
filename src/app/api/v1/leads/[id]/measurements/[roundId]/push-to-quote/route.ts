import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leads, measurementRounds, measurementItems, quotes, quoteLines } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const PushToQuoteSchema = z.object({
  quoteId: z.string().uuid(),
});

// POST /api/v1/leads/[id]/measurements/[roundId]/push-to-quote
export async function POST(
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

  const parsed = PushToQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { quoteId } = parsed.data;

  try {
    // Verify lead belongs to tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Verify round belongs to lead
    const [round] = await db
      .select({ id: measurementRounds.id })
      .from(measurementRounds)
      .where(and(eq(measurementRounds.id, roundId), eq(measurementRounds.leadId, id)))
      .limit(1);
    if (!round) return NextResponse.json({ error: 'Measurement round not found' }, { status: 404 });

    // Verify quote belongs to tenant and is in draft status
    const [quote] = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, ctx.tenantId)))
      .limit(1);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Quote must be in draft status to receive measurement items' },
        { status: 422 },
      );
    }

    // Fetch all measurement items for this round
    const items = await db
      .select()
      .from(measurementItems)
      .where(eq(measurementItems.roundId, roundId));

    if (items.length === 0) {
      return NextResponse.json({ data: { linesAdded: 0 } }, { status: 201 });
    }

    // Insert a quote line for each measurement item
    const insertedLines = await db
      .insert(quoteLines)
      .values(
        items.map((item) => ({
          quoteId,
          room: item.room,
          item: item.itemName,
          qty: item.qty,
          unit: item.unit,
          clientRatePaise: 0,
          costRatePaise: 0,
          marginPaise: 0,
        })),
      )
      .returning();

    return NextResponse.json({ data: { linesAdded: insertedLines.length } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/leads/[id]/measurements/[roundId]/push-to-quote]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
