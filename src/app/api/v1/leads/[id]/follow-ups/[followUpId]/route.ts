import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leadFollowUps } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mark_done') }),
  z.object({ action: z.literal('reschedule'), followUpDate: z.string().datetime() }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; followUpId: string }> },
) {
  const { id: leadId, followUpId } = await params;
  void leadId;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const now = new Date();

  try {
    if (parsed.data.action === 'mark_done') {
      await db
        .update(leadFollowUps)
        .set({ completedAt: now, updatedAt: now, updatedBy: ctx.dbUserId ?? undefined })
        .where(and(
          eq(leadFollowUps.id, followUpId),
          eq(leadFollowUps.tenantId, ctx.tenantId),
        ));
    } else {
      const newDate = new Date(parsed.data.followUpDate);
      await db
        .update(leadFollowUps)
        .set({ followUpDate: newDate, completedAt: null, updatedAt: now, updatedBy: ctx.dbUserId ?? undefined })
        .where(and(
          eq(leadFollowUps.id, followUpId),
          eq(leadFollowUps.tenantId, ctx.tenantId),
        ));
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]/follow-ups/[followUpId]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
