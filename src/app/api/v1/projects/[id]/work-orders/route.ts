import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workOrders, vendors, users, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const WorkOrderTypeEnum = z.enum(['inhouse_carpentry', 'factory', 'vendor_job', 'site_work']);

const CreateWorkOrderSchema = z.object({
  title: z.string().min(1).max(200),
  type: WorkOrderTypeEnum.default('site_work'),
  assignedUserId: z.string().uuid().optional(),
  assignedVendorId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quoteLineId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  // Verify project belongs to tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  try {
    const rows = await db
      .select({
        id:               workOrders.id,
        tenantId:         workOrders.tenantId,
        projectId:        workOrders.projectId,
        quoteLineId:      workOrders.quoteLineId,
        title:            workOrders.title,
        type:             workOrders.type,
        assignedUserId:   workOrders.assignedUserId,
        assignedVendorId: workOrders.assignedVendorId,
        startDate:        workOrders.startDate,
        dueDate:          workOrders.dueDate,
        status:           workOrders.status,
        notes:            workOrders.notes,
        createdAt:        workOrders.createdAt,
        assignedUserName: users.fullName,
        assignedVendorName: vendors.name,
      })
      .from(workOrders)
      .leftJoin(users,   eq(workOrders.assignedUserId,   users.id))
      .leftJoin(vendors, eq(workOrders.assignedVendorId, vendors.id))
      .where(and(eq(workOrders.projectId, projectId), eq(workOrders.tenantId, ctx.tenantId)))
      .orderBy(desc(workOrders.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[work-orders GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = CreateWorkOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Verify project belongs to tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  try {
    const [wo] = await db
      .insert(workOrders)
      .values({
        tenantId:         ctx.tenantId,
        projectId,
        quoteLineId:      parsed.data.quoteLineId ?? null,
        title:            parsed.data.title,
        type:             parsed.data.type,
        assignedUserId:   parsed.data.assignedUserId ?? null,
        assignedVendorId: parsed.data.assignedVendorId ?? null,
        startDate:        parsed.data.startDate ?? null,
        dueDate:          parsed.data.dueDate ?? null,
        notes:            parsed.data.notes ?? null,
        status:           'planned',
      })
      .returning();

    return NextResponse.json({ data: wo, message: 'Work order created' }, { status: 201 });
  } catch (err) {
    console.error('[work-orders POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
