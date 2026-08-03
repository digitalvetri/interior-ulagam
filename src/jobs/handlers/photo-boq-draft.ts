import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { geminiProvider } from '@/lib/ai/gemini';
import { groqProvider } from '@/lib/ai/groq';

interface WaImageReceivedData {
  imageUrl: string;
  leadId: string;
  tenantId: string;
  contactPhone: string;
}

const RoomAnalysisSchema = z.object({
  roomType: z.string(),
  stylePref: z.enum(['modern', 'contemporary', 'traditional', 'rustic', 'other']),
  qualityLevel: z.enum(['budget', 'mid_range', 'premium']),
  dimensions: z.string().nullable(),
  existingItems: z.array(z.string()),
  suggestedItems: z.array(
    z.object({
      item: z.string(),
      unit: z.string(),
      estimatedQty: z.number().int(),
      estimatedCostRupees: z.number(),
      estimatedClientRupees: z.number(),
    })
  ),
});

type RoomAnalysis = z.infer<typeof RoomAnalysisSchema>;

export const photoBOQDraft = defineJob(
  {
    id: 'photo-boq-draft',
    name: 'Photo BOQ Draft — WhatsApp Image to Room Analysis',
  },
  { event: 'wa_message/image.received' },
  async ({ event, step }) => {
    const { imageUrl, leadId, tenantId, contactPhone } =
      event.data as WaImageReceivedData;

    // CRITICAL: Meta image URLs expire in ~5 minutes — download immediately with auth header
    const { base64, mimeType } = await step.run('download-image', async () => {
      const res = await fetch(imageUrl, {
        headers: { Authorization: 'Bearer ' + process.env.WHATSAPP_ACCESS_TOKEN },
      });
      if (!res.ok) {
        throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
      }
      const buffer = await res.arrayBuffer();
      const b64 = Buffer.from(buffer).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      return { base64: b64, mimeType: mime };
    });

    const roomAnalysis = await step.run('analyze-image', async () => {
      // Build a data URL so Gemini fetches from memory — never re-hits the expired Meta URL
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const description = await geminiProvider.describeImage(
        dataUrl,
        'Analyze this interior design room photo. Identify: 1) Room type (living room/bedroom/kitchen/bathroom/etc) 2) Approximate dimensions if visible 3) Existing furniture and fixtures 4) Style preference (modern/contemporary/traditional/rustic) 5) Material quality level (budget/mid-range/premium) based on visible finishes. Return JSON.'
      );

      const analysis: RoomAnalysis = await groqProvider.chatJSON({
        system:
          'You are an interior design estimator. Parse the following room description into structured JSON for a BOQ draft. ' +
          'Suggest typical items needed to furnish or renovate the room, with realistic cost and client rate estimates in Indian Rupees. ' +
          'Respond with valid JSON only.',
        user: description,
        schema: RoomAnalysisSchema,
        model: 'heavy',
      });

      return analysis;
    });

    await step.run('fire-event', async () => {
      await step.sendEvent('photo-draft-ready', {
        name: 'requirements/photo_draft.ready',
        data: {
          leadId,
          tenantId,
          contactPhone,
          analysis: roomAnalysis,
          requiresHumanApproval: true,
        },
      });

      // Update lastActivityAt on the lead if leadId is provided
      if (leadId) {
        await db
          .update(leads)
          .set({ lastActivityAt: sql`now()` })
          .where(eq(leads.id, leadId));
      }
    });

    return {
      done: true,
      leadId,
      roomType: roomAnalysis.roomType,
      suggestedItemsCount: roomAnalysis.suggestedItems.length,
      requiresHumanApproval: true,
    };
  }
);
