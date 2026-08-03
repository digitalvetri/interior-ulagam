import { enqueue, JobName } from '@/jobs/queue';

/**
 * Execution context handed to a job handler.
 *
 * ⚠️ THIS IS NOT A DURABLE WORKFLOW ENGINE.
 *
 * Inngest memoised each `step.run`, so a failure part-way through replayed only
 * the unfinished steps. BullMQ has no such thing: a retry re-runs the handler
 * from the top. The shape is preserved so the handler bodies did not have to be
 * rewritten, but the semantics are different in one way that matters:
 *
 *   **Every handler must be idempotent.** If a handler sends a message, takes a
 *   payment, or inserts a row, it has to check first whether that already
 *   happened — see the `quotes.waMessageId` guard in quote-pdf for the pattern.
 *
 * `step.run` here is bookkeeping only: it names and times a section, and makes
 * failures point at the right place in the logs.
 */
export interface JobSteps {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  sleep(name: string, duration: string): Promise<never>;
  sendEvent(name: string, payload: { name: string; data: Record<string, unknown> }): Promise<void>;
}

export interface JobContext<TData = unknown> {
  event: { name: string; data: TData };
  step: JobSteps;
}

export function createJobContext<TData>(
  jobName: string,
  data: TData,
): JobContext<TData> {
  const step: JobSteps = {
    async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const startedAt = Date.now();
      try {
        return await fn();
      } catch (err) {
        console.error(`[job ${jobName}] step "${name}" failed after ${Date.now() - startedAt}ms:`, err);
        throw err;
      }
    },

    async sleep(name: string, duration: string): Promise<never> {
      // Blocking a worker for hours would pin a concurrency slot and lose the
      // timer on restart. Long waits must be modelled as a separate delayed job
      // with a deterministic id (see enqueueDelayed / cancelScheduled).
      throw new Error(
        `[job ${jobName}] step.sleep("${name}", "${duration}") is not supported. ` +
          'Split this handler at the wait boundary and schedule the next stage ' +
          'with enqueueDelayed().',
      );
    },

    async sendEvent(name: string, payload: { name: string; data: Record<string, unknown> }) {
      await enqueue(payload.name as JobName, payload.data);
    },
  };

  return { event: { name: jobName, data }, step };
}
