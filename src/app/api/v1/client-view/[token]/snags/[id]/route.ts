import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clientTokens, snagItems } from '@/lib/db/schema';
import { checkRateLimit, clientPortalLimiter } from '@/lib/ratelimit';

function validateToken(token: string) {
  return /^[0-9a-f]{64}$/.test(token);
}

// PATCH /api/v1/client-view/[token]/snags/[id]
// — client confirms a resolved snag item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const rateLimitResponse = await checkRateLimit(clientPortalLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const { token, id: snagId } = await params;

  if (!validateToken(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const [tokenRow] = await db
      .select({ projectId: clientTokens.projectId, tenantId: clientTokens.tenantId })
      .from(clientTokens)
      .where(
        and(
          eq(clientTokens.token, token),
          isNull(clientTokens.revokedAt),
          gt(clientTokens.expiresAt, sql`now()`),
        ),
      )
      .limit(1);

    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    }

    // Verify the snag belongs to this token's project
    const [snag] = await db
      .select({ id: snagItems.id, status: snagItems.status, projectId: snagItems.projectId })
      .from(snagItems)
      .where(
        and(
          eq(snagItems.id, snagId),
          eq(snagItems.projectId, tokenRow.projectId),
        ),
      )
      .limit(1);

    if (!snag) {
      return NextResponse.json({ error: 'Snag item not found' }, { status: 404 });
    }

    // Only allow confirm on resolved snags
    if (snag.status !== 'resolved') {
      return NextResponse.json(
        { error: `Cannot confirm snag with status "${snag.status}"` },
        { status: 422 },
      );
    }

    await db
      .update(snagItems)
      .set({ status: 'client_confirmed', clientConfirmedAt: new Date() })
      .where(eq(snagItems.id, snagId));

    return NextResponse.json({ data: { id: snagId, status: 'client_confirmed' } });
  } catch (err) {
    console.error('[PATCH client-view/:token/snags/:id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
