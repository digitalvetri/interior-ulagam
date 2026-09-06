import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clientTokens, designDeliverables, deliverableComments } from '@/lib/db/schema';
import { checkRateLimit, clientPortalLimiter } from '@/lib/ratelimit';

const BodySchema = z.object({
  action:  z.enum(['approve', 'changes_requested']),
  comment: z.string().max(1000).optional(),
});

function validateToken(token: string) {
  return /^[0-9a-f]{64}$/.test(token);
}

// PATCH /api/v1/client-view/[token]/deliverables/[id]
// — client approves or requests changes on a shared design deliverable
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const rateLimitResponse = await checkRateLimit(clientPortalLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const { token, id: deliverableId } = await params;

  if (!validateToken(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { action, comment } = parsed.data;

  try {
    // Resolve token → projectId + tenantId
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

    // Verify the deliverable belongs to this token's project
    const [deliverable] = await db
      .select({ id: designDeliverables.id, status: designDeliverables.status })
      .from(designDeliverables)
      .where(
        and(
          eq(designDeliverables.id, deliverableId),
          eq(designDeliverables.projectId, tokenRow.projectId),
          eq(designDeliverables.tenantId, tokenRow.tenantId),
        ),
      )
      .limit(1);

    if (!deliverable) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    // Only allow action on shared deliverables
    if (deliverable.status !== 'shared') {
      return NextResponse.json(
        { error: `Cannot act on deliverable with status "${deliverable.status}"` },
        { status: 422 },
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'changes_requested';

    await db
      .update(designDeliverables)
      .set({
        status: newStatus,
        ...(action === 'approve' ? { approvedAt: new Date(), approvedByClient: 'client' } : {}),
      })
      .where(eq(designDeliverables.id, deliverableId));

    // Record comment if provided
    if (comment?.trim()) {
      await db.insert(deliverableComments).values({
        deliverableId,
        body: comment.trim(),
        fromClient: true,
        createdBy: null,
      });
    }

    return NextResponse.json({ data: { id: deliverableId, status: newStatus } });
  } catch (err) {
    console.error('[PATCH client-view/:token/deliverables/:id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
