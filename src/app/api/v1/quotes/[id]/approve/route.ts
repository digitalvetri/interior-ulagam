import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes } from '@/lib/db/schema';
import { requireUuid } from '@/lib/http';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;


  const badId = requireUuid(id);

  if (badId) return badId;
  try {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote is already accepted' }, { status: 422 });
    }

    if (quote.status !== 'sent') {
      return NextResponse.json(
        { error: `Only sent quotes can be accepted (current status: '${quote.status}')` },
        { status: 422 },
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(quotes)
      .set({
        status: 'accepted',
        approvedAt: now,
        acceptedAt: now,
        approvalAuditJson: {
          approvedBy: ctx.userId,
          approvedAt: now.toISOString(),
        },
      })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
      .returning();

    // An accepted revision supersedes the version it was made from.
    if (updated?.parentQuoteId) {
      await db.update(quotes).set({ status: 'revised' })
        .where(and(
          eq(quotes.id, updated.parentQuoteId),
          eq(quotes.tenantId, ctx.tenantId),
          inArray(quotes.status, ['sent', 'accepted', 'approved']),
        ));
    }

    // Return the accepted quote total so the UI can pre-fill the Won Flow modal
    return NextResponse.json({
      data: updated,
      message: 'Quote accepted — open Won Flow to convert this lead',
      acceptedTotalPaise: updated.totalPaise,
      leadId: updated.leadId,
    });
  } catch (err) {
    console.error('[quotes/:id/approve POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
