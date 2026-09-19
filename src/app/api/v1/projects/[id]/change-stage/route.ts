import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, leadActivities } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const PROJECT_STAGES = [
  'design_pending',
  'design_in_progress',
  'design_approved',
  'procurement',
  'execution',
  'snagging',
  'handover',
  'complete',
] as const;

const ChangeStageSchema = z.object({
  newStage: z.enum(PROJECT_STAGES),
  note: z.string().max(500).optional(),
});

// POST /api/v1/projects/[id]/change-stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ChangeStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { newStage, note } = parsed.data;

  try {
    const [project] = await db
      .select({ lifecycleStage: projects.lifecycleStage, leadId: projects.leadId })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.lifecycleStage === newStage) {
      return NextResponse.json({ error: 'Project is already at this stage' }, { status: 409 });
    }

    const [updated] = await db
      .update(projects)
      .set({ lifecycleStage: newStage })
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
      .returning();

    // Log to lead activity history
    if (project.leadId) {
      const stageLabel = newStage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      await db.insert(leadActivities).values({
        tenantId: ctx.tenantId,
        leadId: project.leadId,
        type: 'stage_change',
        title: `Project stage → ${stageLabel}`,
        description: note ?? null,
        createdBy: ctx.dbUserId ?? null,
      });
    }

    return NextResponse.json({ data: updated, message: 'Stage updated' });
  } catch (err) {
    console.error('[projects/:id/change-stage POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
