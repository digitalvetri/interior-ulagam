import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designDeliverables, deliverableVersions } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const UpdateDeliverableSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    revisionCap: z.number().int().min(1).max(10).optional(),
  })
  .strict();

// GET /api/v1/design-deliverables/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [deliverable] = await db
      .select()
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    const versions = await db
      .select()
      .from(deliverableVersions)
      .where(eq(deliverableVersions.deliverableId, id))
      .orderBy(asc(deliverableVersions.versionNumber));

    return NextResponse.json({ data: { ...deliverable, versions } });
  } catch (err) {
    console.error('[GET /api/v1/design-deliverables/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/design-deliverables/[id]
export async function PATCH(
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

  const parsed = UpdateDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [deliverable] = await db
      .select({ id: designDeliverables.id, status: designDeliverables.status })
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    if (deliverable.status !== 'draft' && deliverable.status !== 'changes_requested') {
      return NextResponse.json(
        { error: 'Deliverable can only be edited in draft or changes_requested status' },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(designDeliverables)
      .set(parsed.data)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/v1/design-deliverables/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/design-deliverables/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [deliverable] = await db
      .select({ id: designDeliverables.id })
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    // Hard delete — cascade removes deliverableVersions and deliverableComments
    await db
      .delete(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)));

    return NextResponse.json({ message: 'Deliverable deleted' });
  } catch (err) {
    console.error('[DELETE /api/v1/design-deliverables/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
