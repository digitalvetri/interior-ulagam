import { JOB, JobName } from '@/jobs/queue';
import { JobContext } from '@/jobs/context';
import type { JobDefinition } from '@/jobs/define';

import { helloWorld } from '@/jobs/handlers/hello-world';
import { quotePdf } from '@/jobs/handlers/quote-pdf';
import { invoicePdf } from '@/jobs/handlers/invoice-pdf';
import { receiptPdf } from '@/jobs/handlers/receipt-pdf';
import { poPdf } from '@/jobs/handlers/po-pdf';
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
import { sessionCleanup } from '@/jobs/handlers/session-cleanup';

// Multi-day workflows — one handler per wait boundary (see ./workflows/schedule)
import {
  leadFollowupStart, leadFollowupDay3, leadFollowupDay7, leadFollowupDay14,
} from '@/jobs/workflows/lead-followup';
import {
  siteVisitRemindersStart, siteVisitReminder24h, siteVisitReminder2h,
} from '@/jobs/workflows/site-visit-reminders';
import {
  handoverReferralStart, handoverComplete, handoverNps,
} from '@/jobs/workflows/handover-referral';
import { vendorPoSend, vendorPoAckCheck } from '@/jobs/workflows/vendor-po-whatsapp';

type AnyDefinition = JobDefinition<unknown>;

/**
 * Job name → handler.
 *
 * The four multi-day sequences appear here as one entry per stage. Each stage
 * schedules the next as a delayed job under a deterministic id, so the sequence
 * survives worker restarts and a cancel is a removal by id rather than extra
 * bookkeeping. Every stage also re-checks its own preconditions before acting —
 * cancellation is an optimisation, the re-check is the guarantee.
 */
export const HANDLERS: Partial<Record<JobName, AnyDefinition>> = {
  [JOB.helloWorld]: helloWorld as AnyDefinition,
  [JOB.quotePdf]: quotePdf as AnyDefinition,
  [JOB.invoicePdf]: invoicePdf as AnyDefinition,
  [JOB.receiptPdf]: receiptPdf as AnyDefinition,
  [JOB.poPdf]: poPdf as AnyDefinition,
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
  [JOB.sessionCleanup]: sessionCleanup as AnyDefinition,
  // Lead follow-up nudges
  [JOB.leadFollowup]: leadFollowupStart as AnyDefinition,
  [JOB.leadFollowupDay3]: leadFollowupDay3 as AnyDefinition,
  [JOB.leadFollowupDay7]: leadFollowupDay7 as AnyDefinition,
  [JOB.leadFollowupDay14]: leadFollowupDay14 as AnyDefinition,
  // Site-visit reminders
  [JOB.siteVisitReminders]: siteVisitRemindersStart as AnyDefinition,
  [JOB.siteVisitReminder24h]: siteVisitReminder24h as AnyDefinition,
  [JOB.siteVisitReminder2h]: siteVisitReminder2h as AnyDefinition,
  // Handover → NPS
  [JOB.handoverReferral]: handoverReferralStart as AnyDefinition,
  [JOB.handoverComplete]: handoverComplete as AnyDefinition,
  [JOB.handoverNps]: handoverNps as AnyDefinition,
  // Vendor PO
  [JOB.vendorPoWhatsapp]: vendorPoSend as AnyDefinition,
  [JOB.poAckCheck]: vendorPoAckCheck as AnyDefinition,
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
