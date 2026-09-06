import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteSections, quoteLines } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { recalculateQuoteTotals } from '@/lib/quotes/totals';

const CreateSectionLineSchema = z.object({
  room: z.string().min(1),
  item: z.string().min(1),
  description: z.string().optional(),
  qty: z.number().int().positive().default(1),
  unit: z.string().default('nos'),
  clientRatePaise: z.number().int().min(0),
  costRatePaise: z.number().int().min(0),
  hsnSac: z.string().optional(),
  finish: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
  materialId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, sid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSectionLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify quote belongs to tenant and is draft
    const [quote] = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Lines can only be added to draft quotes' },
        { status: 422 },
      );
    }

    // Verify section belongs to this quote
    const [section] = await db
      .select({ id: quoteSections.id })
      .from(quoteSections)
      .where(and(eq(quoteSections.id, sid), eq(quoteSections.quoteId, id)));

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const marginPaise = (input.clientRatePaise - input.costRatePaise) * input.qty;

    const [line] = await db
      .insert(quoteLines)
      .values({
        quoteId: id,
        sectionId: sid,
        room: input.room,
        item: input.item,
        description: input.description,
        qty: input.qty,
        unit: input.unit,
        clientRatePaise: input.clientRatePaise,
        costRatePaise: input.costRatePaise,
        marginPaise,
        hsnSac: input.hsnSac,
        finish: input.finish,
        sortOrder: input.sortOrder,
        materialId: input.materialId,
      })
      .returning();

    await recalculateQuoteTotals(id);

    return NextResponse.json({ data: line }, { status: 201 });
  } catch (err) {
    console.error('[quotes/:id/sections/:sid/lines POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
