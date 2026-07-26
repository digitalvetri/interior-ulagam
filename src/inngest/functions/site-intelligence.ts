import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { siteLogs } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai/groq';

interface SiteLogVoiceReceivedData {
  projectId: string;
  tenantId: string;
  voiceNoteUrl: string;
}

const ParsedSiteReportSchema = z.object({
  progressPct: z.number().min(0).max(100),
  stage: z.string(),
  labourCount: z.number().nullable(),
  delayFlag: z.boolean(),
  blockers: z.array(z.string()),
});

type ParsedSiteReport = z.infer<typeof ParsedSiteReportSchema>;

export const siteIntelligence = inngest.createFunction(
  {
    id: 'site-intelligence',
    name: 'Site Intelligence — Voice to Structured Log',
  },
  { event: 'site_log/voice.received' },
  async ({ event, step }) => {
    const { projectId, tenantId, voiceNoteUrl } =
      event.data as SiteLogVoiceReceivedData;

    // CRITICAL: download + transcribe immediately — Meta voice URLs expire fast
    const { transcript } = await step.run('download-transcribe', async () => {
      const text = await groqProvider.transcribe(voiceNoteUrl);
      return { transcript: text };
    });

    const parsed = await step.run('parse-llm', async () => {
      const result: ParsedSiteReport = await groqProvider.chatJSON({
        system:
          'Parse Tanglish interior design site report into JSON. ' +
          'Tanglish means Tamil sentences mixed with English. ' +
          'Extract progress percentage, current construction stage, number of labourers, ' +
          'whether there is a delay risk, and a list of any blockers mentioned.',
        user: transcript,
        schema: ParsedSiteReportSchema,
        model: 'light',
      });
      return result;
    });

    const { siteLogId } = await step.run('write-log', async () => {
      const [inserted] = await db
        .insert(siteLogs)
        .values({
          tenantId,
          projectId,
          logDate: sql`CURRENT_DATE`,
          voiceNoteUrl,
          transcript,
          progressPct: parsed.progressPct,
          stage: parsed.stage,
          delayFlag: parsed.delayFlag,
          labourCount: parsed.labourCount,
          blockersJson: parsed.blockers,
          aiParsedJson: parsed,
          source: 'whatsapp',
        })
        .returning({ id: siteLogs.id });
      return { siteLogId: inserted.id };
    });

    if (parsed.delayFlag) {
      await step.sendEvent('send-delay-event', {
        name: 'site_log/delay.detected',
        data: { projectId, tenantId, siteLogId },
      });
    }

    return {
      done: true,
      siteLogId,
      progressPct: parsed.progressPct,
      delayFlag: parsed.delayFlag,
    };
  },
);
