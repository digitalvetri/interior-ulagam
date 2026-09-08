import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// PATCH /api/v1/me/tasks/:id — toggle complete or update a task I own
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

  const { completed } = body as { completed?: boolean };

  try {
    const [existing] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(
        eq(tasks.id, id),
        eq(tasks.tenantId, ctx.tenantId),
        eq(tasks.assignedTo, ctx.userId),
      ))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const [row] = await db
      .update(tasks)
      .set({ completedAt: completed ? new Date() : null })
      .where(eq(tasks.id, id))
      .returning();

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/me/tasks/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
