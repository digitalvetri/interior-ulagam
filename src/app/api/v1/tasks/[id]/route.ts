import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, notifications, leadActivities } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const OwnerUpdateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  assignedTo:  z.string().uuid().nullable().optional(),
  relatedType: z.enum(['lead', 'project', 'quote', 'invoice']).nullable().optional(),
  relatedId:   z.string().uuid().nullable().optional(),
  dueAt:       z.string().datetime().nullable().optional(),
  notes:       z.string().max(2000).nullable().optional(),
  status:      z.enum(['pending', 'in_progress', 'done']).optional(),
});

// Assignees (non-owner) can only change status
const AssigneeUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']),
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

  // Permission: owner updates all fields; assignee updates status only; others 403
  const isOwner   = ctx.isAdmin;
  const isAssignee = task.assignedTo === ctx.userId;
  if (!isOwner && !isAssignee) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = isOwner
    ? OwnerUpdateSchema.safeParse(body)
    : AssigneeUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updates: Partial<typeof tasks.$inferInsert> = {};
  const prevStatus = task.status ?? 'pending';

  if (isOwner) {
    const d = parsed.data as z.infer<typeof OwnerUpdateSchema>;
    if (d.title       !== undefined) updates.title       = d.title;
    if (d.assignedTo  !== undefined) updates.assignedTo  = d.assignedTo;
    if (d.relatedType !== undefined) updates.relatedType = d.relatedType;
    if (d.relatedId   !== undefined) updates.relatedId   = d.relatedId;
    if (d.dueAt       !== undefined) updates.dueAt       = d.dueAt ? new Date(d.dueAt) : null;
    if (d.notes       !== undefined) updates.notes       = d.notes;
    if (d.status      !== undefined) updates.status      = d.status;
  } else {
    const d = parsed.data as z.infer<typeof AssigneeUpdateSchema>;
    updates.status = d.status;
  }

  // Sync completedAt with status transitions
  const newStatus = updates.status;
  if (newStatus === 'done' && prevStatus !== 'done') {
    updates.completedAt = new Date();
  } else if (newStatus && newStatus !== 'done' && prevStatus === 'done') {
    updates.completedAt = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: task });
  }

  const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();

  // Side effects on status transition to 'done'
  if (newStatus === 'done' && prevStatus !== 'done') {
    const sideEffects: Promise<unknown>[] = [];
    const taskTitle = updated.title;

    // Log completion in lead activity
    if (updated.relatedType === 'lead' && updated.relatedId) {
      sideEffects.push(
        db.insert(leadActivities).values({
          tenantId:    ctx.tenantId,
          leadId:      updated.relatedId,
          type:        'task',
          title:       `Task completed: "${taskTitle}"`,
          completedAt: updated.completedAt,
          createdBy:   ctx.userId,
        }),
      );
    }

    // Notify the task creator when a non-creator completes it
    if (updated.createdBy && updated.createdBy !== ctx.userId) {
      sideEffects.push(
        db.insert(notifications).values({
          tenantId: ctx.tenantId,
          userId:   updated.createdBy,
          severity: 'info',
          title:    `Task done: "${taskTitle}"`,
          body:     `Completed by ${ctx.fullName}`,
          href:     '/tasks',
        }),
      );
    }

    await Promise.allSettled(sideEffects);
  }

  // Notify new assignee when owner reassigns
  if (isOwner && updates.assignedTo && updates.assignedTo !== task.assignedTo) {
    await db.insert(notifications).values({
      tenantId: ctx.tenantId,
      userId:   updates.assignedTo,
      severity: 'info',
      title:    `Task assigned: "${updated.title}"`,
      body:     null,
      href:     '/tasks',
    }).catch(() => {});
  }

  return NextResponse.json({ data: updated });
}

// DELETE /api/v1/tasks/[id]
// Owner can delete any task; non-owner can delete only their own self-created tasks
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await resolveTask(ctx.tenantId, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isSelfCreated = task.createdBy === ctx.userId && task.assignedTo === ctx.userId;
  if (!ctx.isAdmin && !isSelfCreated) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ data: { id } });
}
