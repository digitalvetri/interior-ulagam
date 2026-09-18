import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits, notifications } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { applyStageTransition } from '@/lib/leads/transitions';
import { createFollowUp } from '@/lib/leads/createFollowUp';
import type { FollowUpStage, FollowUpClientStatus } from '@/lib/leads/createFollowUp';

const VALID_STAGES = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement', 'measured', 'booked',
  'quotation', 'negotiation', 'won', 'lost',
  'site_visit_scheduled', 'consultation_done', 'proposal_sent',
] as const;

const VALID_STATUSES = [
  'interested', 'not_interested', 'callback', 'meeting_scheduled',
  'thinking', 'no_response', 'negotiating', 'deal_closed',
] as const;

const CompleteSiteVisitSchema = z.object({
  notes:   z.string().optional(),
  outcome: z.string().optional(),
  photos:  z.array(z.string().url()).optional(),
  followUp: z.object({
    followUpDate:  z.string().datetime().nullable().optional(),
    stage:         z.enum(VALID_STAGES),
    clientStatus:  z.enum(VALID_STATUSES),
    comments:      z.string().max(2000).optional(),
    addToCalendar: z.boolean().default(true),
  }).optional(),
});

// POST /api/v1/site-visits/[id]/complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid site visit id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CompleteSiteVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const [visit] = await db
      .select()
      .from(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!visit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    }

    if (visit.completedAt !== null) {
      return NextResponse.json(
        { error: 'Site visit is already marked as completed' },
        { status: 409 },
      );
    }

    // Cannot complete before the scheduled time
    const now = new Date();
    if (now < visit.scheduledAt) {
      const scheduledIST = visit.scheduledAt.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      return NextResponse.json(
        { error: `This visit is scheduled for ${scheduledIST} IST. It cannot be completed before its scheduled time.` },
        { status: 422 },
      );
    }

    const { notes, outcome, photos, followUp } = parsed.data;

    const updateValues: Partial<typeof siteVisits.$inferInsert> = {
      completedAt: new Date(),
      status:      'completed',
    };
    if (notes   !== undefined) updateValues.notes         = notes;
    if (outcome !== undefined) updateValues.followUpNotes = outcome;
    if (photos  !== undefined && photos.length > 0) updateValues.photos = photos;

    const [updated] = await db
      .update(siteVisits)
      .set(updateValues)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .returning();

    // Advance lead stage to measurement
    await applyStageTransition(visit.leadId, ctx.tenantId, ctx.dbUserId ?? null, 'measurement');

    // Create optional follow-up via shared service
    let followUpWarning: string | undefined;
    if (followUp) {
      const fuResult = await createFollowUp({
        tenantId:     ctx.tenantId,
        leadId:       visit.leadId,
        createdBy:    ctx.dbUserId,
        followUpDate: followUp.followUpDate ? new Date(followUp.followUpDate) : null,
        stage:        followUp.stage as FollowUpStage,
        clientStatus: followUp.clientStatus as FollowUpClientStatus,
        comments:     followUp.comments ?? null,
        addToCalendar: followUp.addToCalendar,
      });
      if (!fuResult.ok) {
        followUpWarning = fuResult.message;
      }
    }

    // Notify assigned designer
    if (visit.designerId) {
      await db.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId:   visit.designerId,
        severity: 'success',
        title:    'Site visit completed',
        body:     outcome ?? notes ?? 'Visit has been marked as completed.',
        href:     `/site-visits/${id}`,
      });
    }

    return NextResponse.json({
      data: updated,
      message: 'Site visit marked as completed',
      ...(followUpWarning ? { followUpWarning } : {}),
    });
  } catch (e) {
    console.error('[POST /api/v1/site-visits/[id]/complete]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
