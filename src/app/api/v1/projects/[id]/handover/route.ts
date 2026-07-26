import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, snagItems } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, inArray, count } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [project] = await db
      .select({
        id: projects.id,
        tenantId: projects.tenantId,
        name: projects.name,
        lifecycleStage: projects.lifecycleStage,
        expectedEndAt: projects.expectedEndAt,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [openSnagCount] = await db
      .select({ count: count() })
      .from(snagItems)
      .where(
        and(
          eq(snagItems.projectId, id),
          inArray(snagItems.status, ['open', 'in_progress']),
        ),
      );

    const pendingCount = openSnagCount?.count ?? 0;

    if (pendingCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot initiate handover: ${pendingCount} snag item(s) still open or in progress`,
        },
        { status: 422 },
      );
    }

    const [updatedProject] = await db
      .update(projects)
      .set({ lifecycleStage: 'handover' })
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
      .returning();

    await inngest.send({
      name: 'project/handover.initiated',
      data: {
        projectId: id,
        tenantId: ctx.tenantId,
        initiatedBy: ctx.userId,
      },
    });

    return NextResponse.json(
      { data: { project: updatedProject, message: 'Handover initiated' } },
      { status: 200 },
    );
  } catch (err) {
    console.error('[projects/:id/handover POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
