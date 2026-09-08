import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/me/tasks?status=pending|completed|all
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get('status') ?? 'all';

  const conditions = [
    eq(tasks.tenantId, ctx.tenantId),
    eq(tasks.assignedTo, ctx.userId),
  ];

  if (statusParam === 'pending') {
    conditions.push(isNull(tasks.completedAt));
  } else if (statusParam === 'completed') {
    // completedAt IS NOT NULL — use a workaround
    // drizzle: isNotNull
    const { isNotNull } = await import('drizzle-orm');
    conditions.push(isNotNull(tasks.completedAt));
  }

  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.dueAt), desc(tasks.createdAt))
      .limit(200);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/me/tasks]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/me/tasks/:id — mark a task as complete/incomplete (done via [id] route)
// POST /api/v1/me/tasks — create a personal task
const CreateTaskSchema = z.object({
  title:  z.string().min(1).max(500),
  dueAt:  z.string().datetime({ offset: true }).optional().nullable(),
  notes:  z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [row] = await db
      .insert(tasks)
      .values({
        tenantId:   ctx.tenantId,
        title:      parsed.data.title,
        assignedTo: ctx.userId,
        dueAt:      parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        notes:      parsed.data.notes ?? null,
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/me/tasks]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
