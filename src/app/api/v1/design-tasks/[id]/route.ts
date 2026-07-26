import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designTasks } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const StatusEnum = z.enum(['todo', 'in_progress', 'review', 'done']);
const PriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    patch[k] = v;
  }
  // When marking done, stamp completedAt
  if (patch.status === 'done') patch.completedAt = new Date();
  if (patch.status && patch.status !== 'done') patch.completedAt = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(designTasks)
      .set(patch)
      .where(and(eq(designTasks.id, id), eq(designTasks.tenantId, ctx.tenantId)))
      .returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/design-tasks/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    const [row] = await db
      .delete(designTasks)
      .where(and(eq(designTasks.id, id), eq(designTasks.tenantId, ctx.tenantId)))
      .returning({ id: designTasks.id });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: { id: row.id } });
  } catch (e) {
    console.error('[DELETE /api/v1/design-tasks/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
