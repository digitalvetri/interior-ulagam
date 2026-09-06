import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designDeliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CreateDeliverableSchema = z.object({
  leadId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  type: z.enum(['mood_board', '2d_layout', '3d_render', 'working_drawing', 'material_board']),
  title: z.string().min(1).max(200),
  revisionCap: z.number().int().min(1).max(10).default(3),
});

// GET /api/v1/design-deliverables
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const projectId = searchParams.get('projectId');

  // Validate optional uuid params
  if (leadId && !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: 'Invalid leadId' }, { status: 400 });
  }
  if (projectId && !z.string().uuid().safeParse(projectId).success) {
    return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
  }

  try {
    const conditions = [eq(designDeliverables.tenantId, ctx.tenantId)];
    if (leadId) conditions.push(eq(designDeliverables.leadId, leadId));
    if (projectId) conditions.push(eq(designDeliverables.projectId, projectId));

    const deliverables = await db
      .select()
      .from(designDeliverables)
      .where(and(...conditions))
      .orderBy(desc(designDeliverables.createdAt));

    return NextResponse.json({ data: deliverables });
  } catch (err) {
    console.error('[GET /api/v1/design-deliverables]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/design-deliverables
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const [deliverable] = await db
      .insert(designDeliverables)
      .values({
        tenantId: ctx.tenantId,
        leadId: parsed.data.leadId ?? null,
        projectId: parsed.data.projectId ?? null,
        type: parsed.data.type,
        title: parsed.data.title,
        revisionCap: parsed.data.revisionCap,
        createdBy: ctx.dbUserId ?? null,
      })
      .returning();

    return NextResponse.json({ data: deliverable }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/design-deliverables]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
