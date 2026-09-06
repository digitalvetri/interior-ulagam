import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, desc, eq, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, users } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const CreateSchema = z.object({
  title:       z.string().min(1).max(500),
  assignedTo:  z.string().uuid().optional(),
  relatedType: z.enum(['lead', 'project', 'quote', 'invoice']).optional(),
  relatedId:   z.string().uuid().optional(),
  dueAt:       z.string().datetime().optional(),
  notes:       z.string().max(2000).optional(),
});

// GET /api/v1/tasks — list tasks for tenant
// Query params: assigned=me, status=pending|completed, limit
export async function GET(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp    = request.nextUrl.searchParams;
  const mine  = sp.get('assigned') === 'me';
  const status = sp.get('status'); // 'pending' | 'completed'
  const limit = Math.min(parseInt(sp.get('limit') ?? '100', 10), 200);

  const filters = [eq(tasks.tenantId, ctx.tenantId)];
  if (mine)               filters.push(eq(tasks.assignedTo, ctx.userId));
  if (status === 'pending')   filters.push(isNull(tasks.completedAt));
  if (status === 'completed') filters.push(isNotNull(tasks.completedAt));

  const rows = await db
    .select({
      id:          tasks.id,
      title:       tasks.title,
      assignedTo:  tasks.assignedTo,
      assigneeName: users.fullName,
      relatedType: tasks.relatedType,
      relatedId:   tasks.relatedId,
      dueAt:       tasks.dueAt,
      completedAt: tasks.completedAt,
      notes:       tasks.notes,
      createdAt:   tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(and(...filters))
    .orderBy(asc(tasks.completedAt), desc(tasks.dueAt), desc(tasks.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

// POST /api/v1/tasks — create task
export async function POST(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { title, assignedTo, relatedType, relatedId, dueAt, notes } = parsed.data;

  const [task] = await db.insert(tasks).values({
    tenantId:    ctx.tenantId,
    title,
    assignedTo:  assignedTo ?? null,
    relatedType: relatedType ?? null,
    relatedId:   relatedId ?? null,
    dueAt:       dueAt ? new Date(dueAt) : null,
    notes:       notes ?? null,
  }).returning();

  return NextResponse.json({ data: task }, { status: 201 });
}
