import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leadFollowUps, leads } from '@/lib/db/schema';
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
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const now = new Date();

  try {
    if (parsed.data.action === 'mark_done') {
      await db.transaction(async (tx) => {
        await tx
          .update(leadFollowUps)
          .set({ completedAt: now, updatedAt: now, updatedBy: ctx.dbUserId ?? undefined })
          .where(and(
            eq(leadFollowUps.id, followUpId),
            eq(leadFollowUps.tenantId, ctx.tenantId),
          ));

        // BR-2/B: Recompute followUpDate from next pending row (if any)
        const [nextPending] = await tx
          .select({ followUpDate: leadFollowUps.followUpDate })
          .from(leadFollowUps)
          .where(and(
            eq(leadFollowUps.leadId, leadId),
            eq(leadFollowUps.tenantId, ctx.tenantId),
            isNull(leadFollowUps.completedAt),
          ))
          .orderBy(asc(leadFollowUps.followUpDate))
          .limit(1);

        await tx
          .update(leads)
          .set({ followUpDate: nextPending?.followUpDate ?? null, lastActivityAt: now })
          .where(and(
            eq(leads.id, leadId),
            eq(leads.tenantId, ctx.tenantId),
          ));
      });
    } else {
      const newDate = new Date(parsed.data.followUpDate);
      // Reject past-date reschedules using midnight IST — same convention as
      // /api/v1/dashboard/follow-ups (IST_OFFSET_MS = 5.5 * 60 * 60 * 1000).
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
      const todayStartIST = new Date(nowIST); todayStartIST.setHours(0, 0, 0, 0);
      const todayStartUTC = new Date(todayStartIST.getTime() - IST_OFFSET_MS);
      if (newDate < todayStartUTC) {
        return NextResponse.json(
          { error: 'Reschedule date cannot be in the past' },
          { status: 422 },
        );
      }

      // BR-3: Block reschedule on terminal leads; preserve historical follow-up rows
      const [leadRow] = await db
        .select({ stage: leads.stage })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);
      if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      if (leadRow.stage === 'won' || leadRow.stage === 'lost') {
        return NextResponse.json(
          { error: 'Cannot reschedule a follow-up for a won or lost lead.' },
          { status: 422 },
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(leadFollowUps)
          .set({ followUpDate: newDate, completedAt: null, updatedAt: now, updatedBy: ctx.dbUserId ?? undefined })
          .where(and(
            eq(leadFollowUps.id, followUpId),
            eq(leadFollowUps.tenantId, ctx.tenantId),
          ));
        await tx
          .update(leads)
          .set({ followUpDate: newDate, lastActivityAt: now })
          .where(and(
            eq(leads.id, leadId),
            eq(leads.tenantId, ctx.tenantId),
          ));
      });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]/follow-ups/[followUpId]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
