import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, leadFollowUps, leadActivities } from '@/lib/db/schema';

const VALID_STAGES = [
  'new', 'contacted', 'qualified', 'site_visit', 'measurement', 'measured', 'booked',
  'quotation', 'negotiation', 'won', 'lost',
  'site_visit_scheduled', 'consultation_done', 'proposal_sent',
] as const;

const VALID_STATUSES = [
  'interested', 'not_interested', 'callback', 'meeting_scheduled',
  'thinking', 'no_response', 'negotiating', 'deal_closed',
] as const;

export type FollowUpStage = (typeof VALID_STAGES)[number];
export type FollowUpClientStatus = (typeof VALID_STATUSES)[number];

export interface CreateFollowUpInput {
  tenantId: string;
  leadId: string;
  createdBy: string | null | undefined;
  followUpDate: Date | null;
  stage: FollowUpStage;
  clientStatus: FollowUpClientStatus;
  comments?: string | null;
  addToCalendar?: boolean;
}

export type CreateFollowUpResult =
  | { ok: true; activity: { id: string; leadId: string; title: string; scheduledAt: Date | null } }
  | { ok: false; code: 'TERMINAL_STAGE' | 'PENDING_EXISTS' | 'LEAD_NOT_FOUND'; message: string };

export async function createFollowUp(input: CreateFollowUpInput): Promise<CreateFollowUpResult> {
  const { tenantId, leadId, createdBy, followUpDate, stage, clientStatus, comments, addToCalendar = true } = input;

  // BR-3/A: Block follow-ups on terminal stages
  const [leadRow] = await db
    .select({ stage: leads.stage })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!leadRow) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Lead not found.' };
  if (leadRow.stage === 'won' || leadRow.stage === 'lost') {
    return { ok: false, code: 'TERMINAL_STAGE', message: 'Cannot create a follow-up for a won or lost lead.' };
  }

  // BR-2/A: At most one pending follow-up per lead
  const [existingPending] = await db
    .select({ id: leadFollowUps.id })
    .from(leadFollowUps)
    .where(and(
      eq(leadFollowUps.leadId, leadId),
      eq(leadFollowUps.tenantId, tenantId),
      isNull(leadFollowUps.completedAt),
    ))
    .limit(1);

  if (existingPending) {
    return {
      ok: false,
      code: 'PENDING_EXISTS',
      message: 'This lead already has an active follow-up. Complete or reschedule it before adding a new one.',
    };
  }

  const activity = await db.transaction(async (tx) => {
    await tx.insert(leadFollowUps).values({
      tenantId,
      leadId,
      followUpDate,
      stage,
      clientStatus,
      comments: comments ?? null,
      addToCalendar,
      createdBy:  createdBy ?? undefined,
      updatedBy:  createdBy ?? undefined,
    });

    await tx
      .update(leads)
      .set({
        lastActivityAt: new Date(),
        ...(addToCalendar ? { followUpDate } : {}),
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    const activityTitle = followUpDate
      ? `Follow-up scheduled — ${followUpDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Follow-up scheduled';

    const [inserted] = await tx.insert(leadActivities).values({
      tenantId,
      leadId,
      type:        'follow_up',
      title:       activityTitle,
      description: comments ?? null,
      scheduledAt: followUpDate,
      status:      'pending',
      createdBy:   createdBy ?? undefined,
    }).returning({
      id:          leadActivities.id,
      leadId:      leadActivities.leadId,
      title:       leadActivities.title,
      scheduledAt: leadActivities.scheduledAt,
    });

    return inserted ?? null;
  });

  if (!activity) return { ok: false, code: 'LEAD_NOT_FOUND', message: 'Failed to create follow-up.' };
  return { ok: true, activity };
}
