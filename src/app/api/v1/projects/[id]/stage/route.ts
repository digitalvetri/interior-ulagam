import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, milestones } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

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

  // Stage gate: procurement requires design_approved AND at least one paid milestone
  if (stage === 'procurement') {
    if (project.lifecycleStage !== 'design_approved') {
      return NextResponse.json(
        {
          error: 'Stage gate failed: project must be in design_approved stage before moving to procurement',
        },
        { status: 422 }
      );
    }

    const paidMilestones = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, id),
          eq(milestones.paymentStatus, 'paid')
        )
      )
      .limit(1);

    if (paidMilestones.length === 0) {
      return NextResponse.json(
        {
          error: 'Stage gate failed: at least one milestone must be paid before moving to procurement',
        },
        { status: 422 }
      );
    }
  }

  const [updatedProject] = await db
    .update(projects)
    .set({ lifecycleStage: stage })
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .returning();

  return NextResponse.json({ data: updatedProject });
}
