import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { siteLogs, projects, portfolios, users } from '@/lib/db/schema';
import { geminiProvider } from '@/lib/ai/gemini';
import { groqProvider } from '@/lib/ai/groq';

interface ProjectHandoverInitiatedData {
  projectId: string;
  tenantId: string;
}

const PhotoScoreSchema = z.object({
  photos: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      reason: z.string(),
    })
  ),
});

type PhotoScore = z.infer<typeof PhotoScoreSchema>;

export const portfolioBuilder = inngest.createFunction(
  {
    id: 'portfolio-builder',
    name: 'Portfolio Builder — Handover to AI-Curated Portfolio',
    cancelOn: [
      {
        event: 'project/handover.cancelled',
        if: 'event.data.projectId == async.data.projectId',
      },
    ],
  },
  { event: 'project/handover.initiated' },
  async ({ event, step }) => {
    const { projectId, tenantId } = event.data as ProjectHandoverInitiatedData;

    const { allPhotos } = await step.run('collect-photos', async () => {
      const logs = await db
        .select({ photos: siteLogs.photos })
        .from(siteLogs)
        .where(
          and(eq(siteLogs.projectId, projectId), eq(siteLogs.tenantId, tenantId))
        );

      const flattened: string[] = [];
      for (const log of logs) {
        if (Array.isArray(log.photos)) {
          flattened.push(...log.photos);
        }
      }

      // Cap at 50 photos
      return { allPhotos: flattened.slice(0, 50) };
    });

    const { curatedPhotos, projectName, scoringResult } = await step.run(
      'curate-with-ai',
      async () => {
        if (allPhotos.length === 0) {
          return { curatedPhotos: [] as string[], projectName: '', scoringResult: null };
        }

        const [projectRow] = await db
          .select({ name: projects.name })
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

        const name = projectRow?.name ?? 'Completed Project';

        // Score up to 10 photos with Gemini (text-based, per spec)
        const photosToScore = allPhotos.slice(0, 10);
        const photoListText = photosToScore
          .map((url, i) => `Photo ${i + 1}: ${url}`)
          .join('\n');

        const scoringDescription = await geminiProvider.describeImage(
          photosToScore[0],
          `You are a portfolio curator for an interior design studio. Score each of the following ${photosToScore.length} interior design site photos from 0-10 for portfolio quality. Criteria: good lighting (3pts), no workers or equipment visible (2pts), shows finished or near-finished surfaces (3pts), good composition (2pts).\n\nPhoto URLs to score:\n${photoListText}\n\nReturn JSON array of {url, score, reason}`
        );

        const scored: PhotoScore = await groqProvider.chatJSON({
          system:
            'You are a portfolio curator for an interior design studio. ' +
            'Parse the following portfolio scoring description into a structured JSON array. ' +
            'Each entry must have the photo url, a numeric score (0-10), and a brief reason. ' +
            'Respond with valid JSON only.',
          user: scoringDescription,
          schema: PhotoScoreSchema,
          model: 'heavy',
        });

        // Filter score >= 6, take top 8 by score descending
        const qualified = scored.photos
          .filter((p) => p.score >= 6)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        return {
          curatedPhotos: qualified.map((p) => p.url),
          projectName: name,
          scoringResult: scored,
        };
      }
    );

    await step.run('create-portfolio', async () => {
      const title = projectName
        ? `${projectName} — Completed Portfolio`
        : 'Completed Portfolio';

      const coverPhotoUrl = curatedPhotos[0] ?? null;

      // Manual upsert: no unique constraint on (tenantId, projectId)
      const existing = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(
          and(eq(portfolios.tenantId, tenantId), eq(portfolios.projectId, projectId))
        );

      if (existing.length > 0) {
        await db
          .update(portfolios)
          .set({
            title,
            photos: curatedPhotos,
            coverPhotoUrl,
            aiCuratedJson: scoringResult,
          })
          .where(
            and(
              eq(portfolios.tenantId, tenantId),
              eq(portfolios.projectId, projectId)
            )
          );
      } else {
        await db.insert(portfolios).values({
          tenantId,
          projectId,
          title,
          photos: curatedPhotos,
          coverPhotoUrl,
          aiCuratedJson: scoringResult,
        });
      }
    });

    await step.run('notify-owner', async () => {
      const ownerRows = await db
        .select({ phone: users.phone })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')));

      const ownerPhone = ownerRows[0]?.phone ?? null;

      if (ownerPhone) {
        await step.sendEvent('portfolio-created', {
          name: 'portfolio/created',
          data: {
            projectId,
            tenantId,
            ownerPhone,
            curatedCount: curatedPhotos.length,
          },
        });
      }
    });

    return {
      done: true,
      projectId,
      totalPhotos: allPhotos.length,
      curatedCount: curatedPhotos.length,
      coverPhotoUrl: curatedPhotos[0] ?? null,
    };
  }
);
