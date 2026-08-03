import { JOB, JobName, enqueueDelayed, cancelScheduled } from '@/jobs/queue';

/**
 * Scheduling helpers for the multi-day workflows.
 *
 * Inngest expressed these as one function that slept between steps. BullMQ has
 * no durable sleep, so each wait boundary becomes a separate delayed job. The
 * job id is derived from the entity it concerns — `followup:<leadId>:day7` —
 * which makes cancellation a removal by id and needs no extra bookkeeping.
 */
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const followupJobId = (leadId: string, stage: string) => `followup:${leadId}:${stage}`;
export const siteVisitJobId = (visitId: string, stage: string) => `sitevisit:${visitId}:${stage}`;
export const handoverJobId = (projectId: string, stage: string) => `handover:${projectId}:${stage}`;
export const poJobId = (poId: string) => `po:${poId}:ack-check`;

async function schedule(
  name: JobName,
  jobId: string,
  data: Record<string, unknown>,
  delayMs: number,
): Promise<void> {
  // Remove any previous run for this entity first. Re-triggering a workflow
  // should reset the timer rather than be silently dropped — BullMQ ignores an
  // add() whose jobId already exists.
  await cancelScheduled(jobId);
  await enqueueDelayed(name, jobId, data, delayMs);
}

// ── Lead follow-up nudges ────────────────────────────────────────────────────

export function scheduleFollowupDay3(data: Record<string, unknown>, leadId: string) {
  return schedule(JOB.leadFollowupDay3, followupJobId(leadId, 'day3'), data, 3 * DAY);
}
export function scheduleFollowupDay7(data: Record<string, unknown>, leadId: string) {
  return schedule(JOB.leadFollowupDay7, followupJobId(leadId, 'day7'), data, 4 * DAY);
}
export function scheduleFollowupDay14(data: Record<string, unknown>, leadId: string) {
  return schedule(JOB.leadFollowupDay14, followupJobId(leadId, 'day14'), data, 7 * DAY);
}

/** Called when a lead replies — stops the remaining nudges. */
export async function cancelFollowupSequence(leadId: string): Promise<number> {
  const removed = await Promise.all(
    ['day3', 'day7', 'day14'].map((stage) => cancelScheduled(followupJobId(leadId, stage))),
  );
  return removed.filter(Boolean).length;
}

// ── Site-visit reminders ─────────────────────────────────────────────────────

export function scheduleVisitReminder24h(data: Record<string, unknown>, visitId: string) {
  return schedule(JOB.siteVisitReminder24h, siteVisitJobId(visitId, '24h'), data, 20 * HOUR);
}
export function scheduleVisitReminder2h(data: Record<string, unknown>, visitId: string) {
  return schedule(JOB.siteVisitReminder2h, siteVisitJobId(visitId, '2h'), data, 22 * HOUR);
}
export async function cancelVisitReminders(visitId: string): Promise<number> {
  const removed = await Promise.all(
    ['24h', '2h'].map((stage) => cancelScheduled(siteVisitJobId(visitId, stage))),
  );
  return removed.filter(Boolean).length;
}

// ── Handover → referral ──────────────────────────────────────────────────────

export function scheduleHandoverComplete(data: Record<string, unknown>, projectId: string) {
  return schedule(JOB.handoverComplete, handoverJobId(projectId, 'complete'), data, 1 * DAY);
}
export function scheduleHandoverNps(data: Record<string, unknown>, projectId: string) {
  return schedule(JOB.handoverNps, handoverJobId(projectId, 'nps'), data, 7 * DAY);
}
export async function cancelHandoverSequence(projectId: string): Promise<number> {
  const removed = await Promise.all(
    ['complete', 'nps'].map((stage) => cancelScheduled(handoverJobId(projectId, stage))),
  );
  return removed.filter(Boolean).length;
}

// ── Purchase-order acknowledgement ───────────────────────────────────────────

export function schedulePoAckCheck(data: Record<string, unknown>, poId: string) {
  return schedule(JOB.poAckCheck, poJobId(poId), data, 24 * HOUR);
}
export function cancelPoAckCheck(poId: string): Promise<boolean> {
  return cancelScheduled(poJobId(poId));
}
