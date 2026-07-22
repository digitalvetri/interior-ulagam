import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, deliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const patchBodySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'in_review', 'approved', 'rejected'])
    .optional(),
  revisionCount: z.number().int().min(0).optional(),
  latestFileUrl: z.string().url().optional().nullable(),
});

async function fetchDeliverableWithTenantCheck(
  deliverableId: string,
  tenantId: string
) {
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
    .innerJoin(projects, eq(deliverables.projectId, projects.id))
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(projects.tenantId, tenantId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
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

  const deliverable = await fetchDeliverableWithTenantCheck(id, ctx.tenantId);
  if (!deliverable) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
  }

  return NextResponse.json({ data: deliverable });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await fetchDeliverableWithTenantCheck(id, ctx.tenantId);
  if (!existing) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
  }

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

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: 'No fields provided for update' },
      { status: 400 }
    );
  }

  const updatePayload: Partial<{
    status: typeof existing.status;
    revisionCount: number;
    latestFileUrl: string | null;
  }> = {};

  if (parsed.data.status !== undefined) {
    updatePayload.status = parsed.data.status;
  }
  if (parsed.data.revisionCount !== undefined) {
    updatePayload.revisionCount = parsed.data.revisionCount;
  }
  if (parsed.data.latestFileUrl !== undefined) {
    updatePayload.latestFileUrl = parsed.data.latestFileUrl;
  }

  const [updated] = await db
    .update(deliverables)
    .set(updatePayload)
    .where(eq(deliverables.id, id))
    .returning();

  // Determine effective revisionCount after update
  const effectiveRevisionCount =
    updatePayload.revisionCount !== undefined
      ? updatePayload.revisionCount
      : existing.revisionCount;

  const changeOrderNeeded = effectiveRevisionCount > existing.revisionCap;

  return NextResponse.json({
    data: updated,
    ...(changeOrderNeeded ? { changeOrderNeeded: true } : {}),
  });
}
