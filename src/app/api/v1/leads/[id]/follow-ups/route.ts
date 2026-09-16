import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leadActivities, leadFollowUps, leads, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const VALID_STAGES = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement', 'measured', 'booked',
  'quotation', 'negotiation', 'won', 'lost',
  // legacy
  'site_visit_scheduled', 'consultation_done', 'proposal_sent',
] as const;

const VALID_STATUSES = [
  'interested', 'not_interested', 'callback', 'meeting_scheduled',
  'thinking', 'no_response', 'negotiating', 'deal_closed',
] as const;

const CreateFollowUpSchema = z.object({
  followUpDate:  z.string().datetime().nullable().optional(),
  stage:         z.enum(VALID_STAGES),
  clientStatus:  z.enum(VALID_STATUSES),
  comments:      z.string().max(2000).nullable().optional(),
  addToCalendar: z.boolean().default(true),
});

function isMissingTable(e: unknown): boolean {
  return e instanceof Error && (
    e.message.includes('42P01') ||
    e.message.includes('does not exist') && e.message.includes('lead_follow_ups')
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db
      .select({
        id:            leadFollowUps.id,
        followUpDate:  leadFollowUps.followUpDate,
        stage:         leadFollowUps.stage,
        clientStatus:  leadFollowUps.clientStatus,
        comments:      leadFollowUps.comments,
        completedAt:   leadFollowUps.completedAt,
        addToCalendar: leadFollowUps.addToCalendar,
        createdByName: users.fullName,
        createdByRole: users.role,
        createdAt:     leadFollowUps.createdAt,
        updatedAt:     leadFollowUps.updatedAt,
      })
      .from(leadFollowUps)
      .leftJoin(users, eq(leadFollowUps.createdBy, users.id))
      .where(and(
        eq(leadFollowUps.leadId, id),
        eq(leadFollowUps.tenantId, ctx.tenantId),
      ))
      .orderBy(desc(leadFollowUps.createdAt));

    return NextResponse.json({ data: rows });
  } catch (e) {
    if (isMissingTable(e)) {
      return NextResponse.json({
        error: 'Run drizzle/migrate-lead-follow-ups.sql in Supabase SQL Editor to enable this feature.',
        code: 'MIGRATION_REQUIRED',
      }, { status: 503 });
    }
    console.error('[GET /api/v1/leads/[id]/follow-ups]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = CreateFollowUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { followUpDate, stage, clientStatus, comments, addToCalendar } = parsed.data;
  const followUpDateObj = followUpDate ? new Date(followUpDate) : null;

  try {
    // BR-3/A: Block new follow-ups on terminal stages
    const [leadRow] = await db
      .select({ stage: leads.stage })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (leadRow.stage === 'won' || leadRow.stage === 'lost') {
      return NextResponse.json(
        { error: 'Cannot create a follow-up for a won or lost lead.' },
        { status: 422 },
      );
    }

    // BR-2/A: At most one pending follow-up per lead
    const [existingPending] = await db
      .select({ id: leadFollowUps.id })
      .from(leadFollowUps)
      .where(and(
        eq(leadFollowUps.leadId, id),
        eq(leadFollowUps.tenantId, ctx.tenantId),
        isNull(leadFollowUps.completedAt),
      ))
      .limit(1);
    if (existingPending) {
      return NextResponse.json(
        { error: 'This lead already has an active follow-up. Complete or reschedule it before adding a new one.' },
        { status: 422 },
      );
    }

    const activity = await db.transaction(async (tx) => {
      await tx.insert(leadFollowUps).values({
        tenantId:      ctx.tenantId,
        leadId:        id,
        followUpDate:  followUpDateObj,
        stage,
        clientStatus,
        comments:      comments ?? null,
        addToCalendar,
        createdBy:     ctx.dbUserId ?? undefined,
        updatedBy:     ctx.dbUserId ?? undefined,
      });

      await tx
        .update(leads)
        .set({
          lastActivityAt: new Date(),
          ...(addToCalendar ? { followUpDate: followUpDateObj } : {}),
        })
        .where(and(
          eq(leads.id, id),
          eq(leads.tenantId, ctx.tenantId),
        ));

      // B-3: Atomic with the follow-up row; IST timezone for human-readable title
      const activityTitle = followUpDateObj
        ? `Follow-up scheduled — ${followUpDateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}`
        : 'Follow-up scheduled';
      const [inserted] = await tx.insert(leadActivities).values({
        tenantId:    ctx.tenantId,
        leadId:      id,
        type:        'follow_up',
        title:       activityTitle,
        description: comments ?? null,
        scheduledAt: followUpDateObj,
        status:      'pending',
        createdBy:   ctx.dbUserId ?? undefined,
      }).returning({
        id:          leadActivities.id,
        leadId:      leadActivities.leadId,
        type:        leadActivities.type,
        title:       leadActivities.title,
        description: leadActivities.description,
        scheduledAt: leadActivities.scheduledAt,
        status:      leadActivities.status,
        createdBy:   leadActivities.createdBy,
        createdAt:   leadActivities.createdAt,
      });
      return inserted ?? null;
    });

    return NextResponse.json({ success: true, activity }, { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) {
      return NextResponse.json({
        error: 'Run drizzle/migrate-lead-follow-ups.sql in Supabase SQL Editor to enable this feature.',
        code: 'MIGRATION_REQUIRED',
      }, { status: 503 });
    }
    console.error('[POST /api/v1/leads/[id]/follow-ups]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
