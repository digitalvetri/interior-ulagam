import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { requirements, materials } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai/groq';

interface RequirementsCompletedData {
  requirementsId: string;
  projectId: string;
  tenantId: string;
}

const LineSchema = z.object({
  room: z.string(),
  item: z.string(),
  unit: z.string(),
  qty: z.number().int(),
  estimatedCostRupees: z.number(),
  estimatedClientRupees: z.number(),
});

const DraftSchema = z.object({
  lines: z.array(LineSchema),
});

type DraftLine = z.infer<typeof LineSchema>;

export const aiQuoteDraft = inngest.createFunction(
  {
    id: 'ai-quote-draft',
    name: 'AI Quote Draft Generator',
  },
  { event: 'requirements/completed' },
  async ({ event, step }) => {
    const { requirementsId, projectId, tenantId } =
      event.data as RequirementsCompletedData;

    const { requirementsRow, topMaterials } = await step.run('gather', async () => {
      const [reqRow] = await db
        .select({
          id: requirements.id,
          roomsJson: requirements.roomsJson,
          styleTags: requirements.styleTags,
          budgetBand: requirements.budgetBand,
          totalAreaSqft: requirements.totalAreaSqft,
          notes: requirements.notes,
        })
        .from(requirements)
        .where(
          and(
            eq(requirements.id, requirementsId),
            eq(requirements.tenantId, tenantId),
          ),
        );

      const mats = await db
        .select({
          id: materials.id,
          name: materials.name,
          category: materials.category,
          brand: materials.brand,
          unit: materials.unit,
          currentRatePaise: materials.currentRatePaise,
          hsnSac: materials.hsnSac,
        })
        .from(materials)
        .where(eq(materials.tenantId, tenantId))
        .orderBy(desc(materials.createdAt))
        .limit(20);

      return { requirementsRow: reqRow, topMaterials: mats };
    });

    const draftLines = await step.run('draft', async () => {
      const draft = await groqProvider.chatJSON({
        system:
          'You are an expert interior design BOQ (Bill of Quantities) generator for an Indian interior studio. ' +
          'Generate a realistic BOQ from the provided project requirements and available materials catalogue. ' +
          'Use materials from the catalogue where relevant. ' +
          'Provide quantities as integers. ' +
          'Provide costs in Indian Rupees (numbers only, not paise). ' +
          'estimatedClientRupees should be estimatedCostRupees plus a reasonable margin (20-40%).',
        user: JSON.stringify({ requirements: requirementsRow, materials: topMaterials }),
        schema: DraftSchema,
        model: 'heavy',
      });
      return draft.lines as DraftLine[];
    });

    await step.sendEvent('fire-ready', {
      name: 'quote/draft.ready',
      data: {
        projectId,
        tenantId,
        draftLines,
        requiresHumanApproval: true,
      },
    });

    return {
      done: true,
      projectId,
      lineCount: draftLines.length,
      requiresHumanApproval: true,
    };
  },
);
