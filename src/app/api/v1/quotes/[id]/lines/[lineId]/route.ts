import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteLines } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const UpdateLineSchema = z
  .object({
    room: z.string().min(1).optional(),
    item: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    qty: z.number().int().positive().optional(),
    costRatePaise: z.number().int().nonnegative().optional(),
    clientRatePaise: z.number().int().nonnegative().optional(),
  })
  .strict();

async function recalculateQuoteTotals(quoteId: string): Promise<void> {
  const allLines = await db
    .select({
      clientRatePaise: quoteLines.clientRatePaise,
      qty: quoteLines.qty,
    })
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId));

  const subtotalPaise = allLines.reduce(
    (acc, l) => acc + l.clientRatePaise * l.qty,
    0,
  );
  const gstPaise = Math.round(subtotalPaise * 0.18);
  const totalPaise = subtotalPaise + gstPaise;

  await db
    .update(quotes)
    .set({ subtotalPaise, gstPaise, totalPaise })
    .where(eq(quotes.id, quoteId));
}

/** Verify quote belongs to tenant and return its current state. */
async function getAuthorizedLine(
  quoteId: string,
  lineId: string,
  tenantId: string,
) {
  const [quote] = await db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

  if (!quote) return { error: 'Quote not found', status: 404 as const, line: null };

  if (quote.status !== 'draft') {
    return {
      error: 'Lines on non-draft quotes cannot be modified',
      status: 422 as const,
      line: null,
    };
  }

  const [line] = await db
    .select()
    .from(quoteLines)
    .where(and(eq(quoteLines.id, lineId), eq(quoteLines.quoteId, quoteId)));

  if (!line) return { error: 'Line not found', status: 404 as const, line: null };

  return { error: null, status: null, line };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, lineId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const { error, status, line } = await getAuthorizedLine(id, lineId, ctx.tenantId);
    if (error || !line) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    // Recompute margin using updated values (fall back to current if not provided)
    const newQty = input.qty ?? line.qty;
    const newClientRate = input.clientRatePaise ?? line.clientRatePaise;
    const newCostRate = input.costRatePaise ?? line.costRatePaise;
    const marginPaise = Math.round((newClientRate - newCostRate) * newQty);

    const [updated] = await db
      .update(quoteLines)
      .set({ ...input, marginPaise })
      .where(and(eq(quoteLines.id, lineId), eq(quoteLines.quoteId, id)))
      .returning();

    await recalculateQuoteTotals(id);

    return NextResponse.json({ data: updated, message: 'Line updated' });
  } catch (err) {
    console.error('[quotes/:id/lines/:lineId PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, lineId } = await params;

  try {
    const { error, status } = await getAuthorizedLine(id, lineId, ctx.tenantId);
    if (error) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    await db
      .delete(quoteLines)
      .where(and(eq(quoteLines.id, lineId), eq(quoteLines.quoteId, id)));

    await recalculateQuoteTotals(id);

    return NextResponse.json({ data: null, message: 'Line deleted' });
  } catch (err) {
    console.error('[quotes/:id/lines/:lineId DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
