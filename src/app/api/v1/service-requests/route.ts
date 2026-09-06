import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { serviceRequests, users, customers, projects } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const CreateSchema = z.object({
  issue:             z.string().min(1).max(2000),
  customerId:        z.string().uuid().optional(),
  projectId:         z.string().uuid().optional(),
  priority:          z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  photoUrl:          z.string().url().optional(),
  notes:             z.string().max(2000).optional(),
});

// GET /api/v1/service-requests — list for tenant
// Query params: status, priority, projectId
export async function GET(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp        = request.nextUrl.searchParams;
  const statusQ   = sp.get('status');
  const priorityQ = sp.get('priority');
  const projectQ  = sp.get('projectId');
  const limit     = Math.min(parseInt(sp.get('limit') ?? '100', 10), 200);

  const filters = [eq(serviceRequests.tenantId, ctx.tenantId)];
  if (statusQ)   filters.push(eq(serviceRequests.status, statusQ as 'open' | 'assigned' | 'in_progress' | 'resolved'));
  if (priorityQ) filters.push(eq(serviceRequests.priority, priorityQ as 'low' | 'medium' | 'high' | 'urgent'));
  if (projectQ)  filters.push(eq(serviceRequests.projectId, projectQ));

  const rows = await db
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
    .leftJoin(users,      eq(serviceRequests.assignedTo,  users.id))
    .leftJoin(customers,  eq(serviceRequests.customerId,  customers.id))
    .leftJoin(projects,   eq(serviceRequests.projectId,   projects.id))
    .where(and(...filters))
    .orderBy(desc(serviceRequests.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

// POST /api/v1/service-requests — create
export async function POST(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { issue, customerId, projectId, priority, photoUrl, notes } = parsed.data;

  const [row] = await db.insert(serviceRequests).values({
    tenantId:   ctx.tenantId,
    issue,
    customerId:  customerId  ?? null,
    projectId:   projectId   ?? null,
    priority:    priority    ?? 'medium',
    photoUrl:    photoUrl    ?? null,
    notes:       notes       ?? null,
  }).returning();

  return NextResponse.json({ data: row }, { status: 201 });
}
