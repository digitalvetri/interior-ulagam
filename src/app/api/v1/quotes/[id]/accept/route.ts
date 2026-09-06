import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [existing] = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        approvedAt: quotes.approvedAt,
      })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (existing.status !== 'sent' && existing.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only sent or approved quotes can be accepted' },
        { status: 422 },
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(quotes)
      .set({
        status: 'approved',
        acceptedAt: now,
        approvedAt: existing.approvedAt ?? now,
      })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[quotes/:id/accept POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
