import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteLines } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const BulkCreateLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        room:            z.string().min(1),
        item:            z.string().min(1),
        unit:            z.string().min(1),
        qty:             z.number().int().positive(),
        costRatePaise:   z.number().int().nonnegative(),
        clientRatePaise: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(500),
});

async function recalculateQuoteTotals(quoteId: string): Promise<void> {
  const allLines = await db
    .select({ clientRatePaise: quoteLines.clientRatePaise, qty: quoteLines.qty })
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId));

  const subtotalPaise = allLines.reduce((acc, l) => acc + l.clientRatePaise * l.qty, 0);
  const gstPaise      = Math.round(subtotalPaise * 0.18);
  const totalPaise    = subtotalPaise + gstPaise;

  await db
    .update(quotes)
    .set({ subtotalPaise, gstPaise, totalPaise })
    .where(eq(quotes.id, quoteId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: quoteId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BulkCreateLinesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [quote] = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Lines can only be added to draft quotes' },
        { status: 422 },
      );
    }

    const values = parsed.data.lines.map((l) => ({
      quoteId,
      room:            l.room,
      item:            l.item,
      unit:            l.unit,
      qty:             l.qty,
      costRatePaise:   l.costRatePaise,
      clientRatePaise: l.clientRatePaise,
      marginPaise:     Math.round((l.clientRatePaise - l.costRatePaise) * l.qty),
    }));

    const inserted = await db.insert(quoteLines).values(values).returning({ id: quoteLines.id });
    await recalculateQuoteTotals(quoteId);

    return NextResponse.json(
      { data: { count: inserted.length }, message: `${inserted.length} lines imported` },
      { status: 201 },
    );
  } catch (err) {
    console.error('[quotes/:id/lines/bulk POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
