import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai/groq';

interface LanguageDetectionEventData {
  leadId: string;
  tenantId: string;
  messageText: string;
}

const LangSchema = z.object({
  language: z.enum(['ta', 'hi', 'kn', 'en', 'te', 'ml']),
  confidence: z.number(),
});

export const languageDetection = inngest.createFunction(
  {
    id: 'language-detection',
    name: 'Language Detection',
  },
  { event: 'lead/first_message.received' },
  async ({ event, step }) => {
    const { leadId, tenantId, messageText } =
      event.data as LanguageDetectionEventData;

    const detected = await step.run('detect-language', async () => {
      return groqProvider.chatJSON({
        system:
          'You are a language detection assistant. Detect the language of the given text. Options: ta (Tamil/Tanglish), hi (Hindi), kn (Kannada), en (English), te (Telugu), ml (Malayalam).',
        user: messageText,
        schema: LangSchema,
        model: 'light',
      });
    });

    await step.run('update-lead', async () => {
      await db
        .update(leads)
        .set({ preferredLanguage: detected.language })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
    });

    return { leadId, detectedLanguage: detected.language, confidence: detected.confidence };
  },
);
