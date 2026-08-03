import { JOB, JobName } from '@/jobs/queue';
import { JobContext } from '@/jobs/context';
import type { JobDefinition } from '@/jobs/define';

import { helloWorld } from '@/jobs/handlers/hello-world';
import { quotePdf } from '@/jobs/handlers/quote-pdf';
import { leadScoreCompute } from '@/jobs/handlers/lead-score';
import { leadEnrich } from '@/jobs/handlers/lead-enrich';
import { milestonePaymentCaptured } from '@/jobs/handlers/milestone-payment';
import { overdueEscalation } from '@/jobs/handlers/overdue-escalation';
import { siteIntelligence } from '@/jobs/handlers/site-intelligence';
import { mondayBrief } from '@/jobs/handlers/monday-brief';
import { aiQuoteDraft } from '@/jobs/handlers/ai-quote-draft';
import { photoBOQDraft } from '@/jobs/handlers/photo-boq-draft';
import { aiSnagDetection } from '@/jobs/handlers/ai-snag-detection';
import { languageDetection } from '@/jobs/handlers/language-detection';
import { clientChatbot } from '@/jobs/handlers/client-chatbot';
import { costOverrunAlert } from '@/jobs/handlers/cost-overrun-alert';
import { customerEnrich } from '@/jobs/handlers/customer-enrich';
import { customerHealthWeekly } from '@/jobs/handlers/customer-health-weekly';

type AnyDefinition = JobDefinition<unknown>;

/**
 * Job name → handler.
 *
 * Deliberately omitted: lead-followup, site-visit-reminders, handover-referral
 * and vendor-po-whatsapp. Those are multi-day workflows built on step.sleep
 * (20h–7d) with event-driven cancellation, which a single BullMQ job cannot
 * express. Registering them here would be worse than leaving them out: each one
 * performs a real side effect (a WhatsApp message) *before* its first sleep, so
 * the handler would message the client, throw at the sleep, retry, and message
 * them again. They are rebuilt as chained delayed jobs in a follow-up phase.
 */
export const HANDLERS: Partial<Record<JobName, AnyDefinition>> = {
  [JOB.helloWorld]: helloWorld as AnyDefinition,
  [JOB.quotePdf]: quotePdf as AnyDefinition,
  [JOB.leadEnrich]: leadEnrich as AnyDefinition,
  [JOB.leadScore]: leadScoreCompute as AnyDefinition,
  [JOB.languageDetection]: languageDetection as AnyDefinition,
  [JOB.customerEnrich]: customerEnrich as AnyDefinition,
  [JOB.aiQuoteDraft]: aiQuoteDraft as AnyDefinition,
  [JOB.aiSnagDetection]: aiSnagDetection as AnyDefinition,
  [JOB.siteIntelligence]: siteIntelligence as AnyDefinition,
  [JOB.photoBoqDraft]: photoBOQDraft as AnyDefinition,
  [JOB.clientChatbot]: clientChatbot as AnyDefinition,
  [JOB.milestonePayment]: milestonePaymentCaptured as AnyDefinition,
  // Scheduled
  [JOB.costOverrunAlert]: costOverrunAlert as AnyDefinition,
  [JOB.customerHealthWeekly]: customerHealthWeekly as AnyDefinition,
  [JOB.leadScoreNightly]: leadScoreCompute as AnyDefinition,
  [JOB.mondayBrief]: mondayBrief as AnyDefinition,
  [JOB.overdueEscalation]: overdueEscalation as AnyDefinition,
};

export async function runJob(name: JobName, data: Record<string, unknown>): Promise<unknown> {
  const definition = HANDLERS[name];
  if (!definition) {
    throw new Error(`No handler registered for job "${name}".`);
  }
  const { createJobContext } = await import('@/jobs/context');
  const ctx = createJobContext(name, data) as JobContext<unknown>;
  return definition.handler(ctx);
}
