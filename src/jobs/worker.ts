import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { JOBS_QUEUE, JOB, CRON_JOBS, JobName } from '@/jobs/queue';
import { runJob } from '@/jobs/registry';
import { assertEnv } from '@/lib/env';

// Same fail-fast rule as the web container — a worker with no DATABASE_URL would
// otherwise start, claim jobs, and fail every one of them.
assertEnv();

/**
 * Background job worker — the process that drains the BullMQ queue.
 *
 * Runs as its own container so a long AI call or PDF render never competes with
 * request handling in the web container.
 */
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('[worker] REDIS_URL is not set — cannot start.');
  process.exit(1);
}

const connection = new IORedis(redisUrl, {
  // BullMQ blocks on Redis, so retries must be unlimited rather than giving up.
  maxRetriesPerRequest: null,
});

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

async function registerCrons(): Promise<void> {
  const queue = new Queue(JOBS_QUEUE, { connection });

  // Clear stale schedulers first so a changed cron pattern actually takes effect
  // instead of leaving the old one running alongside the new one.
  const existing = await queue.getJobSchedulers();
  const wanted = new Set<string>(CRON_JOBS.map((c) => c.name));
  for (const scheduler of existing) {
    if (!wanted.has(scheduler.key as JobName)) {
      await queue.removeJobScheduler(scheduler.key);
      console.log(`[worker] removed stale schedule: ${scheduler.key}`);
    }
  }

  for (const { name, pattern } of CRON_JOBS) {
    await queue.upsertJobScheduler(name, { pattern, tz: process.env.CRON_TZ ?? 'Asia/Kolkata' }, {
      name,
      data: {},
    });
    console.log(`[worker] scheduled ${name} (${pattern})`);
  }
}

const worker = new Worker(
  JOBS_QUEUE,
  async (job) => {
    const started = Date.now();
    console.log(`[worker] ▶ ${job.name} (${job.id}) attempt ${job.attemptsMade + 1}`);
    const result = await runJob(job.name as JobName, job.data ?? {});
    console.log(`[worker] ✓ ${job.name} (${job.id}) in ${Date.now() - started}ms`);
    return result;
  },
  { connection, concurrency: CONCURRENCY },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] ✗ ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}:`, err?.message);
});

worker.on('error', (err) => {
  console.error('[worker] error:', err);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} — finishing in-flight jobs…`);
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void registerCrons()
  .then(() => {
    console.log(
      `[worker] ready — queue "${JOBS_QUEUE}", concurrency ${CONCURRENCY}, ` +
        `${Object.keys(JOB).length} job types`,
    );
  })
  .catch((err) => {
    console.error('[worker] failed to register schedules:', err);
    process.exit(1);
  });
