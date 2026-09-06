import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { serviceRequests, users, customers, projects } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const UpdateSchema = z.object({
  issue:            z.string().min(1).max(2000).optional(),
  status:           z.enum(['open', 'assigned', 'in_progress', 'resolved']).optional(),
  priority:         z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo:       z.string().uuid().nullable().optional(),
  scheduledVisitAt: z.string().datetime().nullable().optional(),
  resolvedAt:       z.string().datetime().nullable().optional(),
  notes:            z.string().max(2000).nullable().optional(),
  photoUrl:         z.string().url().nullable().optional(),
});

async function resolveRequest(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(serviceRequests)
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/service-requests/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [row] = await db
    .select({
      id:                 serviceRequests.id,
      issue:              serviceRequests.issue,
      photoUrl:           serviceRequests.photoUrl,
      priority:           serviceRequests.priority,
      status:             serviceRequests.status,
      assignedTo:         serviceRequests.assignedTo,
      assigneeName:       users.fullName,
      customerId:         serviceRequests.customerId,
      customerName:       customers.fullName,
      projectId:          serviceRequests.projectId,
      projectName:        projects.name,
      scheduledVisitAt:   serviceRequests.scheduledVisitAt,
      resolvedAt:         serviceRequests.resolvedAt,
      notes:              serviceRequests.notes,
      createdAt:          serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .leftJoin(users,     eq(serviceRequests.assignedTo, users.id))
    .leftJoin(customers, eq(serviceRequests.customerId, customers.id))
    .leftJoin(projects,  eq(serviceRequests.projectId,  projects.id))
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: row });
}

// PATCH /api/v1/service-requests/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await resolveRequest(ctx.tenantId, id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updates: Partial<typeof serviceRequests.$inferInsert> = {};
  const d = parsed.data;
  if (d.issue            !== undefined) updates.issue            = d.issue;
  if (d.status           !== undefined) updates.status           = d.status;
  if (d.priority         !== undefined) updates.priority         = d.priority;
  if (d.assignedTo       !== undefined) updates.assignedTo       = d.assignedTo;
  if (d.scheduledVisitAt !== undefined) updates.scheduledVisitAt = d.scheduledVisitAt ? new Date(d.scheduledVisitAt) : null;
  if (d.resolvedAt       !== undefined) updates.resolvedAt       = d.resolvedAt ? new Date(d.resolvedAt) : null;
  if (d.notes            !== undefined) updates.notes            = d.notes;
  if (d.photoUrl         !== undefined) updates.photoUrl         = d.photoUrl;

  if (Object.keys(updates).length === 0) return NextResponse.json({ data: existing });

  const [updated] = await db
    .update(serviceRequests)
    .set(updates)
    .where(eq(serviceRequests.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}
