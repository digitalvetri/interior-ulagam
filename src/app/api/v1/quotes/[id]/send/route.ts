import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { enqueue } from '@/jobs/queue';
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

    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: `Quote is already in '${quote.status}' state` },
        { status: 422 },
      );
    }

    await db
      .update(quotes)
      .set({ status: 'sent', sentAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    await enqueue('quote/pdf.requested', { quoteId: id, tenantId: ctx.tenantId });

    return NextResponse.json(
      { data: null, message: 'Quote sent — PDF generation in progress' },
    );
  } catch (err) {
    console.error('[quotes/:id/send POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
