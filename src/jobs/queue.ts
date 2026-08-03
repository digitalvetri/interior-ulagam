import { Queue, JobsOptions } from 'bullmq';
import { getRedis } from '@/lib/redis';

/**
 * Background jobs — BullMQ on our own Redis, replacing hosted Inngest.
 *
 * One queue carries every job type; the job *name* selects the handler. That
 * keeps ordering and observability in one place and means a single worker
 * process drains everything.
 */
export const JOBS_QUEUE = 'jobs';

/** Every job name in the system. Mirrors the old Inngest event names. */
export const JOB = {
  leadEnrich: 'lead/created',
  leadScore: 'lead/score.compute',
  languageDetection: 'lead/first_message.received',
  customerEnrich: 'customer/created',
  quotePdf: 'quote/pdf.requested',
  aiQuoteDraft: 'requirements/completed',
  aiSnagDetection: 'site_log/photos.uploaded',
  siteIntelligence: 'site_log/voice.received',
  photoBoqDraft: 'wa_message/image.received',
  clientChatbot: 'wa_message/client_query.received',
  milestonePayment: 'milestone/payment.captured',
  helloWorld: 'test/hello.world',
  // Multi-day workflows. Each wait boundary is its own delayed job, scheduled
  // under a deterministic id so it can be cancelled — see ./workflows/schedule.
  leadFollowup: 'lead/followup.start',
  leadFollowupDay3: 'lead/followup.day3',
  leadFollowupDay7: 'lead/followup.day7',
  leadFollowupDay14: 'lead/followup.day14',
  siteVisitReminders: 'site_visit/scheduled',
  siteVisitReminder24h: 'site_visit/reminder.24h',
  siteVisitReminder2h: 'site_visit/reminder.2h',
  handoverReferral: 'project/handover.initiated',
  handoverComplete: 'project/handover.complete',
  handoverNps: 'project/handover.nps',
  vendorPoWhatsapp: 'po/sent',
  poAckCheck: 'po/ack-check',
  // Scheduled
  costOverrunAlert: 'cron/cost-overrun-alert',
  customerHealthWeekly: 'cron/customer-health-weekly',
  leadScoreNightly: 'cron/lead-score-nightly',
  mondayBrief: 'cron/monday-brief',
  overdueEscalation: 'cron/overdue-escalation',
} as const;

export type JobName = (typeof JOB)[keyof typeof JOB];

/** Cron schedules, carried over unchanged from the Inngest definitions. */
export const CRON_JOBS: { name: JobName; pattern: string }[] = [
  { name: JOB.costOverrunAlert, pattern: '0 18 * * *' },
  { name: JOB.customerHealthWeekly, pattern: '30 0 * * 1' },
  { name: JOB.leadScoreNightly, pattern: '30 20 * * *' },
  { name: JOB.mondayBrief, pattern: '0 8 * * 1' },
  { name: JOB.overdueEscalation, pattern: '0 9 * * *' },
];

let queue: Queue | null = null;

export function getQueue(): Queue | null {
  if (queue) return queue;
  const connection = getRedis();
  if (!connection) return null;

  queue = new Queue(JOBS_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      // Deterministic job ids are used for cancellable delayed work, so completed
      // jobs must not linger in Redis — a retained id silently swallows a later
      // enqueue of the same id.
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  });
  return queue;
}

/**
 * Enqueue a job.
 *
 * Deliberately throws when Redis is unavailable rather than resolving quietly.
 * The Inngest client this replaces swallowed send failures whenever its key was
 * absent, which is how work could disappear with nothing in the logs.
 */
export async function enqueue(
  name: JobName,
  data: Record<string, unknown>,
  opts?: JobsOptions,
): Promise<void> {
  const q = getQueue();
  if (!q) {
    throw new Error(`Cannot enqueue "${name}": REDIS_URL is not configured.`);
  }
  await q.add(name, data, opts);
}

/**
 * Enqueue work whose loss is survivable — scoring, enrichment, background
 * refreshes. Logs and swallows failures.
 *
 * Use this, never a bare `void enqueue(...)`: enqueue() rejects when Redis is
 * unreachable, and an unhandled rejection takes the process down on Node 22.
 * Use `enqueue` directly where the caller must learn about the failure — a
 * user asking to send a quote, or a payment webhook that should be retried.
 */
export async function enqueueBestEffort(
  name: JobName,
  data: Record<string, unknown>,
  opts?: JobsOptions,
): Promise<void> {
  try {
    await enqueue(name, data, opts);
  } catch (err) {
    console.error(`[jobs] best-effort enqueue of "${name}" failed:`, err);
  }
}

/**
 * Placeholder for the four multi-day workflows that do not yet have a handler.
 *
 * They cannot simply be enqueued: each performs a real side effect (a WhatsApp
 * message) before its first long wait, so a handler-less job would retry to
 * exhaustion and a half-built one would message the client repeatedly. Logging
 * keeps the trigger point visible until the workflow runtime lands.
 */
export function logPendingWorkflow(name: string, data: Record<string, unknown>): void {
  console.info(`[jobs] "${name}" not dispatched — workflow runtime pending:`, data);
}

/**
 * Enqueue work to run later under a caller-chosen id, so it can be cancelled.
 * Used by the multi-day follow-up workflows.
 */
export async function enqueueDelayed(
  name: JobName,
  jobId: string,
  data: Record<string, unknown>,
  delayMs: number,
): Promise<void> {
  const q = getQueue();
  if (!q) {
    throw new Error(`Cannot schedule "${name}": REDIS_URL is not configured.`);
  }
  await q.add(name, data, { jobId, delay: delayMs });
}

/** Cancel previously scheduled work. Safe to call when nothing is pending. */
export async function cancelScheduled(jobId: string): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  const job = await q.getJob(jobId);
  if (!job) return false;
  try {
    await job.remove();
    return true;
  } catch {
    // Already running or completed — nothing to cancel.
    return false;
  }
}
