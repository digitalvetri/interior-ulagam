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
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'approved') {
      return NextResponse.json({ error: 'Quote is already approved' }, { status: 422 });
    }

    if (quote.status !== 'sent') {
      return NextResponse.json(
        { error: `Only sent quotes can be approved (current status: '${quote.status}')` },
        { status: 422 },
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(quotes)
      .set({
        status: 'approved',
        approvedAt: now,
        approvalAuditJson: {
          approvedBy: ctx.userId,
          approvedAt: now.toISOString(),
        },
      })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated, message: 'Quote approved' });
  } catch (err) {
    console.error('[quotes/:id/approve POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
