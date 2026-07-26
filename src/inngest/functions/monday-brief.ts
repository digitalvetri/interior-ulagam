import { z } from 'zod';
import { eq, ne, and } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { projects, users } from '@/lib/db/schema';
import { groqProvider } from '@/lib/ai/groq';
import { whatsapp } from '@/lib/whatsapp/send';

const BriefSchema = z.object({
  summary: z.string(),
  riskItems: z.array(z.string()),
  receivableAlert: z.string(),
});

type Brief = z.infer<typeof BriefSchema>;

interface ProjectRow {
  id: string;
  name: string;
  lifecycleStage: string;
  totalContractPaise: number | null;
}

export const mondayBrief = inngest.createFunction(
  {
    id: 'monday-brief',
    name: 'Monday Morning Brief — AI Digest per Tenant',
  },
  { cron: '0 8 * * 1' },
  async ({ step }) => {
    const tenantRows = await step.run('gather', async () => {
      const rows = await db
        .selectDistinct({ tenantId: projects.tenantId })
        .from(projects)
        .where(ne(projects.lifecycleStage, 'complete'));
      return rows;
    });

    const results: Array<{ tenantId: string; sent: boolean; reason?: string }> = [];

    for (const { tenantId } of tenantRows) {
      const result = await step.run(`brief-${tenantId}`, async () => {
        // Fetch active projects for this tenant
        const tenantProjects: ProjectRow[] = await db
          .select({
            id: projects.id,
            name: projects.name,
            lifecycleStage: projects.lifecycleStage,
            totalContractPaise: projects.totalContractPaise,
          })
          .from(projects)
          .where(
            and(
              eq(projects.tenantId, tenantId),
              ne(projects.lifecycleStage, 'complete'),
            ),
          );

        // Find the owner's phone for this tenant
        const [owner] = await db
          .select({ phone: users.phone, fullName: users.fullName })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')));

        if (!owner?.phone) {
          return { tenantId, sent: false, reason: 'no owner phone found' };
        }

        const brief: Brief = await groqProvider.chatJSON({
          system:
            'You are an interior design studio operations assistant. ' +
            'Generate a concise Monday morning brief in English for the studio owner. ' +
            'Include a summary of active projects, flag any risks or delayed stages, ' +
            'and note any receivables that need attention. Keep it under 300 words.',
          user: JSON.stringify({ tenantId, projects: tenantProjects }),
          schema: BriefSchema,
          model: 'heavy',
        });

        await whatsapp.send({
          type: 'text',
          to: owner.phone,
          text: `Good morning! Here is your Monday brief:\n\n${brief.summary}`,
        });

        return { tenantId, sent: true };
      });

      results.push(result);
    }

    return { done: true, results };
  },
);
