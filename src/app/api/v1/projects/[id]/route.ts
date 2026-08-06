import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, leads, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  lifecycleStage: z
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
  totalContractPaise: z.number().int().nonnegative().optional(),
  designerIds: z.array(z.string().uuid()).optional(),
  expectedEndAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [row] = await db
      .select({
        id:                 projects.id,
        tenantId:           projects.tenantId,
        leadId:             projects.leadId,
        clientId:           projects.clientId,
        customerId:         projects.customerId,
        name:               projects.name,
        designerIds:        projects.designerIds,
        totalContractPaise: projects.totalContractPaise,
        lifecycleStage:     projects.lifecycleStage,
        timelineJson:       projects.timelineJson,
        startedAt:          projects.startedAt,
        expectedEndAt:      projects.expectedEndAt,
        createdAt:          projects.createdAt,
        // Lead + customer context for breadcrumb display
        leadContactName:    leads.contactName,
        customerFullName:   customers.fullName,
        siteAddress:        leads.projectLocation,
      })
      .from(projects)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!row) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[projects/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const { expectedEndAt, ...rest } = input;
    const updateData = {
      ...rest,
      ...(expectedEndAt !== undefined
        ? { expectedEndAt: expectedEndAt ? new Date(expectedEndAt + 'T00:00:00.000Z') : null }
        : {}),
    };

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated, message: 'Project updated' });
  } catch (err) {
    console.error('[projects/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
