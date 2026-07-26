import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, snagItems } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

const SnagStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'client_confirmed']);

const UpdateSnagItemSchema = z.object({
  status: SnagStatusSchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
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
    const [item] = await db
      .select({
        id: snagItems.id,
        projectId: snagItems.projectId,
        description: snagItems.description,
        photoUrl: snagItems.photoUrl,
        assigneeId: snagItems.assigneeId,
        status: snagItems.status,
        clientConfirmedAt: snagItems.clientConfirmedAt,
        waMessageId: snagItems.waMessageId,
        createdAt: snagItems.createdAt,
      })
      .from(snagItems)
      .innerJoin(projects, eq(snagItems.projectId, projects.id))
      .where(and(eq(snagItems.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!item) {
      return NextResponse.json({ error: 'Snag item not found' }, { status: 404 });
    }

    return NextResponse.json({ data: item });
  } catch (err) {
    console.error('[snag-items/:id GET]', err);
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

  const parsed = UpdateSnagItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Verify snag item belongs to tenant via JOIN
    const [existing] = await db
      .select({ id: snagItems.id })
      .from(snagItems)
      .innerJoin(projects, eq(snagItems.projectId, projects.id))
      .where(and(eq(snagItems.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Snag item not found' }, { status: 404 });
    }

    interface SnagUpdatePayload {
      status?: 'open' | 'in_progress' | 'resolved' | 'client_confirmed';
      assigneeId?: string | null;
      photoUrl?: string | null;
      clientConfirmedAt?: ReturnType<typeof sql>;
    }

    const updatePayload: SnagUpdatePayload = {};

    if (input.status !== undefined) {
      updatePayload.status = input.status;
      if (input.status === 'client_confirmed') {
        updatePayload.clientConfirmedAt = sql`now()`;
      }
    }

    if (input.assigneeId !== undefined) {
      updatePayload.assigneeId = input.assigneeId;
    }

    if (input.photoUrl !== undefined) {
      updatePayload.photoUrl = input.photoUrl;
    }

    const [updated] = await db
      .update(snagItems)
      .set(updatePayload)
      .where(eq(snagItems.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[snag-items/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
