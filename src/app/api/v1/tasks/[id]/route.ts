import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const UpdateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  assignedTo:  z.string().uuid().nullable().optional(),
  relatedType: z.enum(['lead', 'project', 'quote', 'invoice']).nullable().optional(),
  relatedId:   z.string().uuid().nullable().optional(),
  dueAt:       z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  notes:       z.string().max(2000).nullable().optional(),
});

async function resolveTask(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/tasks/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await resolveTask(ctx.tenantId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: task });
}

// PATCH /api/v1/tasks/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await resolveTask(ctx.tenantId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updates: Partial<typeof tasks.$inferInsert> = {};
  const d = parsed.data;
  if (d.title       !== undefined) updates.title       = d.title;
  if (d.assignedTo  !== undefined) updates.assignedTo  = d.assignedTo;
  if (d.relatedType !== undefined) updates.relatedType = d.relatedType;
  if (d.relatedId   !== undefined) updates.relatedId   = d.relatedId;
  if (d.dueAt       !== undefined) updates.dueAt       = d.dueAt ? new Date(d.dueAt) : null;
  if (d.completedAt !== undefined) updates.completedAt = d.completedAt ? new Date(d.completedAt) : null;
  if (d.notes       !== undefined) updates.notes       = d.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: task });
  }

  const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
  return NextResponse.json({ data: updated });
}

// DELETE /api/v1/tasks/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await resolveTask(ctx.tenantId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ data: { id } });
}
