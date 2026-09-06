import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteSections } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';

const CreateSectionSchema = z.object({
  room: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    // Verify quote belongs to tenant
    const [quote] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const sections = await db
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.quoteId, id))
      .orderBy(asc(quoteSections.sortOrder));

    return NextResponse.json({ data: sections });
  } catch (err) {
    console.error('[quotes/:id/sections GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSectionSchema.safeParse(body);
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
        { error: 'Only draft quotes can be updated' },
        { status: 422 },
      );
    }

    const [section] = await db
      .insert(quoteSections)
      .values({
        quoteId: id,
        room: input.room,
        sortOrder: input.sortOrder,
      })
      .returning();

    return NextResponse.json({ data: section }, { status: 201 });
  } catch (err) {
    console.error('[quotes/:id/sections POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
