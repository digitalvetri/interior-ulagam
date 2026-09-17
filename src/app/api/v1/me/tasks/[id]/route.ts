import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const UpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  // legacy boolean compat — kept so existing callers don't break
  completed: z.boolean().optional(),
});

// PATCH /api/v1/me/tasks/:id — update status of a task assigned to me
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const [existing] = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, ctx.tenantId), eq(tasks.assignedTo, ctx.userId)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Resolve target status — prefer explicit status, fall back to legacy boolean
  let newStatus = parsed.data.status;
  if (!newStatus && parsed.data.completed !== undefined) {
    newStatus = parsed.data.completed ? 'done' : 'pending';
  }
  if (!newStatus) return NextResponse.json({ error: 'No update provided' }, { status: 400 });

  const updates: Partial<typeof tasks.$inferInsert> = { status: newStatus };

  // Sync completedAt
  if (newStatus === 'done' && existing.status !== 'done') {
    updates.completedAt = new Date();
  } else if (newStatus !== 'done' && existing.status === 'done') {
    updates.completedAt = null;
  }

  const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
  return NextResponse.json({ data: row });
}
