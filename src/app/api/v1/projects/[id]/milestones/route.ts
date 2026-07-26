import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';

const CreateMilestoneSchema = z.object({
  label: z.string().min(1),
  pctOfTotal: z.number().int().min(0).max(100),
  amountPaise: z.number().int().nonnegative(),
  triggerStage: z
    .enum([
      'design_pending',
      'design_in_progress',
      'design_approved',
      'procurement',
      'execution',
      'snagging',
      'handover',
      'complete',
    ])
    .optional(),
});

const SeedSchema = z.object({
  seedDefaults: z.literal(true),
});

const PostBodySchema = z.union([CreateMilestoneSchema, SeedSchema]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Verify project belongs to tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(asc(milestones.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[projects/:id/milestones GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    // Verify project belongs to tenant
    const [project] = await db
      .select({ id: projects.id, totalContractPaise: projects.totalContractPaise })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Seed mode
    if ('seedDefaults' in parsed.data && parsed.data.seedDefaults) {
      if (!project.totalContractPaise) {
        return NextResponse.json(
          { error: 'Project totalContractPaise is not set — cannot seed milestones' },
          { status: 400 },
        );
      }

      const total = project.totalContractPaise;

      const defaults: Array<{ label: string; pctOfTotal: number }> = [
        { label: 'Advance', pctOfTotal: 10 },
        { label: 'Design Approval', pctOfTotal: 40 },
        { label: 'Work Completion', pctOfTotal: 40 },
        { label: 'Handover', pctOfTotal: 10 },
      ];

      // Insert sequentially so createdAt ordering is guaranteed
      const created = [];
      for (const def of defaults) {
        const amountPaise = Math.round((total * def.pctOfTotal) / 100);
        const [row] = await db
          .insert(milestones)
          .values({
            projectId,
            label: def.label,
            pctOfTotal: def.pctOfTotal,
            amountPaise,
          })
          .returning();
        created.push(row);
      }

      return NextResponse.json({ data: created }, { status: 201 });
    }

    // Normal mode
    const input = parsed.data as z.infer<typeof CreateMilestoneSchema>;

    const [created] = await db
      .insert(milestones)
      .values({
        projectId,
        label: input.label,
        pctOfTotal: input.pctOfTotal,
        amountPaise: input.amountPaise,
        triggerStage: input.triggerStage,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[projects/:id/milestones POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
