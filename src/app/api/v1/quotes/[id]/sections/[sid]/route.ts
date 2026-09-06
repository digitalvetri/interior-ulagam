import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteSections } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const UpdateSectionSchema = z
  .object({
    room: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

/** Verify the quote belongs to this tenant and the section belongs to the quote. */
async function getAuthorizedSection(
  quoteId: string,
  sectionId: string,
  tenantId: string,
  requireDraft = false,
) {
  const [quote] = await db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

  if (!quote) return { error: 'Quote not found', status: 404 as const, section: null };

  if (requireDraft && quote.status !== 'draft') {
    return { error: 'Only draft quotes can be updated', status: 422 as const, section: null };
  }

  const [section] = await db
    .select()
    .from(quoteSections)
    .where(and(eq(quoteSections.id, sectionId), eq(quoteSections.quoteId, quoteId)));

  if (!section) return { error: 'Section not found', status: 404 as const, section: null };

  return { error: null, status: null, section };
}

export async function PATCH(
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

  const parsed = UpdateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const { error, status } = await getAuthorizedSection(id, sid, ctx.tenantId, true);
    if (error) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    const [updated] = await db
      .update(quoteSections)
      .set(input)
      .where(and(eq(quoteSections.id, sid), eq(quoteSections.quoteId, id)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[quotes/:id/sections/:sid PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, sid } = await params;

  try {
    const { error, status } = await getAuthorizedSection(id, sid, ctx.tenantId);
    if (error) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    // Deleting the section sets quoteLines.sectionId = NULL via ON DELETE SET NULL
    await db
      .delete(quoteSections)
      .where(and(eq(quoteSections.id, sid), eq(quoteSections.quoteId, id)));

    return NextResponse.json({ message: 'Section deleted' });
  } catch (err) {
    console.error('[quotes/:id/sections/:sid DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
