import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { helloWorld } from '@/inngest/functions/hello-world'
import { quotePdf } from '@/inngest/functions/quote-pdf'
import { leadFollowupNudge } from '@/inngest/functions/lead-followup'
import { leadScoreCompute } from '@/inngest/functions/lead-score'
import { leadEnrich } from '@/inngest/functions/lead-enrich'
import { milestonePaymentCaptured } from '@/inngest/functions/milestone-payment'
import { overdueEscalation } from '@/inngest/functions/overdue-escalation'
import { siteVisitReminders } from '@/inngest/functions/site-visit-reminders'
import { siteIntelligence } from '@/inngest/functions/site-intelligence'
import { mondayBrief } from '@/inngest/functions/monday-brief'
import { aiQuoteDraft } from '@/inngest/functions/ai-quote-draft'
import { handoverReferral } from '@/inngest/functions/handover-referral'
import { photoBOQDraft } from '@/inngest/functions/photo-boq-draft'
import { aiSnagDetection } from '@/inngest/functions/ai-snag-detection'
import { languageDetection } from '@/inngest/functions/language-detection'
import { clientChatbot } from '@/inngest/functions/client-chatbot'
import { vendorPOWhatsApp } from '@/inngest/functions/vendor-po-whatsapp'
import { costOverrunAlert } from '@/inngest/functions/cost-overrun-alert'
import { customerEnrich } from '@/inngest/functions/customer-enrich'
import { customerHealthWeekly } from '@/inngest/functions/customer-health-weekly'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld, quotePdf, leadFollowupNudge, leadScoreCompute, leadEnrich,
    milestonePaymentCaptured,
    overdueEscalation, siteVisitReminders, siteIntelligence, mondayBrief,
    aiQuoteDraft, handoverReferral, photoBOQDraft, aiSnagDetection,
    languageDetection, clientChatbot, vendorPOWhatsApp,
    costOverrunAlert, customerEnrich, customerHealthWeekly,
  ],
})
