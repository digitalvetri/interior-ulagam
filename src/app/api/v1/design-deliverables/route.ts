import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designDeliverables, leads, projects } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { projectDesignDeliverablesWhere } from '@/lib/projects/link';

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
    if (projectId) {
      // Deliverables made on the lead before booking count for its project too.
      const [proj] = await db.select({ leadId: projects.leadId }).from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId))).limit(1);
      conditions.push(projectDesignDeliverablesWhere(ctx.tenantId, projectId, proj?.leadId ?? null)!);
    }

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
  const denied = requireApiRole(ctx, ROLES.DELIVERY);
  if (denied) return denied;

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
    let leadId = parsed.data.leadId ?? null;
    let projectId = parsed.data.projectId ?? null;
    if (leadId) {
      const [lead] = await db.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId))).limit(1);
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (projectId) {
      const [proj] = await db.select({ id: projects.id, leadId: projects.leadId }).from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId))).limit(1);
      if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      leadId = leadId ?? proj.leadId;
    } else if (leadId) {
      // A lead that is already booked: attach the deliverable to its project so
      // the design gate and the client portal see it.
      const [proj] = await db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.leadId, leadId), eq(projects.tenantId, ctx.tenantId)))
        .orderBy(asc(projects.createdAt)).limit(1);
      projectId = proj?.id ?? null;
    }

    const [deliverable] = await db
      .insert(designDeliverables)
      .values({
        tenantId: ctx.tenantId,
        leadId,
        projectId,
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
