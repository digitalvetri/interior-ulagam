import { JobContext } from '@/jobs/context';

/**
 * Declares a background job.
 *
 * The signature intentionally mirrors the `inngest.createFunction(config,
 * trigger, handler)` shape it replaces, so the handler bodies did not need
 * rewriting during the migration. Only the runtime changed — see the warning in
 * ./context.ts about durability and idempotency.
 */
export interface JobConfig {
  id: string;
  name?: string;
  /** Carried over from Inngest. Honoured by the workflow stages in ./workflows. */
  cancelOn?: unknown;
  retries?: number;
}

export interface JobTrigger {
  event?: string;
  cron?: string;
}

export interface JobDefinition<TData = unknown> {
  id: string;
  displayName: string;
  trigger: JobTrigger | JobTrigger[];
  handler: (ctx: JobContext<TData>) => Promise<unknown>;
  /** True when the handler still calls step.sleep and cannot run as a single job. */
  requiresWorkflowRuntime: boolean;
}

export function defineJob<TData = unknown>(
  config: JobConfig,
  trigger: JobTrigger | JobTrigger[],
  handler: (ctx: JobContext<TData>) => Promise<unknown>,
): JobDefinition<TData> {
  return {
    id: config.id,
    displayName: config.name ?? config.id,
    trigger,
    handler,
    requiresWorkflowRuntime: false,
  };
}
