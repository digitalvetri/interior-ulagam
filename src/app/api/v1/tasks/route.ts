import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, desc, eq, or, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, users, notifications, leadActivities } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const CreateSchema = z.object({
  title:       z.string().min(1).max(500),
  assignedTo:  z.string().uuid().optional(),
  relatedType: z.enum(['lead', 'project', 'quote', 'invoice']).optional(),
  relatedId:   z.string().uuid().optional(),
  dueAt:       z.string().datetime().optional(),
  notes:       z.string().max(2000).optional(),
});

// GET /api/v1/tasks
// Query params: assigned=me, status=pending|in_progress|done|active|completed, relatedType, relatedId, limit
export async function GET(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp          = request.nextUrl.searchParams;
  const mine        = sp.get('assigned') === 'me';
  const statusParam = sp.get('status');
  const relType     = sp.get('relatedType');
  const relId       = sp.get('relatedId');
  const limit       = Math.min(parseInt(sp.get('limit') ?? '100', 10), 200);

  const filters = [eq(tasks.tenantId, ctx.tenantId)];

  // Non-owner roles always see only their own tasks (server-enforced)
  if (!ctx.isAdmin || mine) {
    filters.push(eq(tasks.assignedTo, ctx.userId));
  }

  // Status filtering
  if (statusParam === 'active') {
    // active = pending OR in_progress (not done)
    filters.push(or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))!);
  } else if (statusParam === 'pending' || statusParam === 'in_progress' || statusParam === 'done') {
    filters.push(eq(tasks.status, statusParam));
  } else if (statusParam === 'completed') {
    // legacy compat: 'completed' → has completedAt set
    filters.push(isNotNull(tasks.completedAt));
  }

  // Context filter (lead/project tasks section)
  if (relType && relId) {
    filters.push(eq(tasks.relatedType, relType));
    filters.push(eq(tasks.relatedId, relId));
  }

  const rows = await db
    .select({
      id:           tasks.id,
      title:        tasks.title,
      status:       tasks.status,
      assignedTo:   tasks.assignedTo,
      assigneeName: users.fullName,
      createdBy:    tasks.createdBy,
      relatedType:  tasks.relatedType,
      relatedId:    tasks.relatedId,
      dueAt:        tasks.dueAt,
      completedAt:  tasks.completedAt,
      notes:        tasks.notes,
      createdAt:    tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(and(...filters))
    .orderBy(asc(tasks.completedAt), desc(tasks.dueAt), desc(tasks.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

// POST /api/v1/tasks — only owners can assign to others
export async function POST(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { title, assignedTo, relatedType, relatedId, dueAt, notes } = parsed.data;

  // Only owners can assign tasks to other users
  if (assignedTo && assignedTo !== ctx.userId && !ctx.isAdmin) {
    return NextResponse.json({ error: 'Only owners can assign tasks to other users' }, { status: 403 });
  }

  // Validate assignee belongs to same tenant
  if (assignedTo && assignedTo !== ctx.userId) {
    const [assignee] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, assignedTo), eq(users.tenantId, ctx.tenantId)))
      .limit(1);
    if (!assignee) return NextResponse.json({ error: 'Assignee not found in this organisation' }, { status: 400 });
  }

  const [task] = await db.insert(tasks).values({
    tenantId:    ctx.tenantId,
    title,
    status:      'pending',
    assignedTo:  assignedTo ?? null,
    createdBy:   ctx.userId,
    relatedType: relatedType ?? null,
    relatedId:   relatedId ?? null,
    dueAt:       dueAt ? new Date(dueAt) : null,
    notes:       notes ?? null,
  }).returning();

  // Side effects — non-blocking failures don't affect task creation
  const sideEffects: Promise<unknown>[] = [];

  // Notify assignee when assigned to someone else
  if (assignedTo && assignedTo !== ctx.userId) {
    const dueLine = dueAt
      ? `Due: ${new Date(dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : null;
    sideEffects.push(
      db.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId:   assignedTo,
        severity: 'info',
        title:    `Task assigned: "${title}"`,
        body:     dueLine,
        href:     '/tasks',
      }),
    );
  }

  // Log task creation in lead activity timeline
  if (relatedType === 'lead' && relatedId) {
    sideEffects.push(
      db.insert(leadActivities).values({
        tenantId:  ctx.tenantId,
        leadId:    relatedId,
        type:      'task',
        title:     `Task assigned: "${title}"`,
        createdBy: ctx.userId,
      }),
    );
  }

  await Promise.allSettled(sideEffects);

  return NextResponse.json({ data: task }, { status: 201 });
}
