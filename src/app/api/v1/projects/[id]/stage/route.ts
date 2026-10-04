import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { stageGateError } from '@/lib/projects/stage-gates';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { applyStageMoneyEffects } from '@/lib/project-money/server';

const patchBodySchema = z.object({
  stage: z.enum([
    'design_pending',
    'design_in_progress',
    'design_approved',
    'procurement',
    'execution',
    'snagging',
    'handover',
    'complete',
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.DELIVERY);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { stage } = parsed.data;

  // Fetch the project to verify ownership and current state
  const [project] = await db
    .select({
      id: projects.id,
      tenantId: projects.tenantId,
      lifecycleStage: projects.lifecycleStage,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const gateError = await stageGateError(ctx.tenantId, id, project.lifecycleStage, stage);
  if (gateError) return NextResponse.json({ error: gateError }, { status: 422 });

  const [updatedProject] = await db
    .update(projects)
    .set({ lifecycleStage: stage })
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .returning();
  await applyStageMoneyEffects(db, ctx.tenantId, id, stage);

  return NextResponse.json({ data: updatedProject });
}
