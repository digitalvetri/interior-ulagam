import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { deliverables, snagItems } from '@/lib/db/schema';
import { geminiProvider } from '@/lib/ai/gemini';
import { groqProvider } from '@/lib/ai/groq';

interface SiteLogPhotosUploadedData {
  projectId: string;
  tenantId: string;
  siteLogId: string;
  photos: string[];
}

const SnagAnalysisSchema = z.object({
  snagItems: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      photoRef: z.string(),
    })
  ),
});

type SnagAnalysis = z.infer<typeof SnagAnalysisSchema>;

interface DetectedSnag {
  description: string;
  severity: 'low' | 'medium' | 'high';
  photoUrl: string;
}

export const aiSnagDetection = defineJob(
  {
    id: 'ai-snag-detection',
    name: 'AI Snag Detection — Site Photos to Snag Items',
  },
  { event: 'site_log/photos.uploaded' },
  async ({ event, step }) => {
    const { projectId, tenantId, siteLogId, photos } =
      event.data as SiteLogPhotosUploadedData;

    const { referenceUrl } = await step.run('get-design-reference', async () => {
      // deliverables has no tenantId — filter by projectId only
      const rows = await db
        .select({ latestFileUrl: deliverables.latestFileUrl })
        .from(deliverables)
        .where(eq(deliverables.projectId, projectId));

      const approved = rows.find((r) => r.latestFileUrl);
      return {
        referenceUrl: approved?.latestFileUrl ?? null,
        projectId,
      };
    });

    const allSnags = await step.run('analyze-photos', async () => {
      const photosToAnalyze = photos.slice(0, 5);
      const detected: DetectedSnag[] = [];

      for (const photoUrl of photosToAnalyze) {
        const description = await geminiProvider.describeImage(
          photoUrl,
          'You are a quality inspector for an interior design project. Examine this site photo and identify any construction defects, incomplete work, surface imperfections, wrong material placements, or deviations from quality standards. List each issue as a snag item with a short description. Return JSON.'
        );

        const analysis: SnagAnalysis = await groqProvider.chatJSON({
          system:
            'You are a quality control assistant for interior design projects. ' +
            'Parse the following site inspection description into a structured list of snag items. ' +
            'Each snag must have a short description and a severity level (low/medium/high). ' +
            'If no issues are found, return an empty snagItems array. ' +
            'Respond with valid JSON only.',
          user: description,
          schema: SnagAnalysisSchema,
          model: 'light',
        });

        for (const snag of analysis.snagItems) {
          detected.push({
            description: snag.description,
            severity: snag.severity,
            // Always use the actual photo URL we sent — never trust model echo
            photoUrl,
          });
        }
      }

      return detected;
    });

    await step.run('create-snag-items', async () => {
      if (allSnags.length === 0) {
        return { insertedCount: 0 };
      }

      // snagItems has no tenantId column — insert by projectId only
      await db.insert(snagItems).values(
        allSnags.map((snag) => ({
          projectId,
          description: snag.description + ' [AI detected]',
          photoUrl: snag.photoUrl,
          status: 'open' as const,
        }))
      );

      return { insertedCount: allSnags.length };
    });

    if (allSnags.length > 0) {
      await step.sendEvent('snags-detected', {
        name: 'site_log/snags_detected',
        data: {
          projectId,
          tenantId,
          siteLogId,
          count: allSnags.length,
        },
      });
    }

    return {
      done: true,
      projectId,
      siteLogId,
      photosAnalyzed: Math.min(photos.length, 5),
      snagsDetected: allSnags.length,
      referenceUsed: referenceUrl !== null,
    };
  }
);
