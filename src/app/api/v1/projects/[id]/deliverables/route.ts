import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, deliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const postBodySchema = z.object({
  type: z.enum(['2d_plan', '3d_render', 'color_palette', 'working_drawings', 'bom']),
  revisionCap: z.number().int().min(0).optional().default(2),
});

async function verifyProjectTenant(
  projectId: string,
  tenantId: string
): Promise<boolean> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  return !!project;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const projectExists = await verifyProjectTenant(id, ctx.tenantId);
  if (!projectExists) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const rows = await db
    .select({
      id: deliverables.id,
      projectId: deliverables.projectId,
      type: deliverables.type,
      status: deliverables.status,
      revisionCount: deliverables.revisionCount,
      revisionCap: deliverables.revisionCap,
      latestFileUrl: deliverables.latestFileUrl,
      approvedAt: deliverables.approvedAt,
      createdAt: deliverables.createdAt,
    })
    .from(deliverables)
    .where(eq(deliverables.projectId, id))
    .orderBy(desc(deliverables.createdAt));

  return NextResponse.json({ data: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const projectExists = await verifyProjectTenant(id, ctx.tenantId);
  if (!projectExists) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { type, revisionCap } = parsed.data;

  const [created] = await db
    .insert(deliverables)
    .values({
      projectId: id,
      type,
      revisionCap,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
