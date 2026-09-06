import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workOrders, vendors, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const UpdateWorkOrderSchema = z.object({
  title:            z.string().min(1).max(200).optional(),
  type:             z.enum(['inhouse_carpentry', 'factory', 'vendor_job', 'site_work']).optional(),
  status:           z.enum(['planned', 'in_progress', 'ready', 'installed']).optional(),
  assignedUserId:   z.string().uuid().nullable().optional(),
  assignedVendorId: z.string().uuid().nullable().optional(),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes:            z.string().nullable().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: 'No fields to update' });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [row] = await db
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
        assignedUserName:   users.fullName,
        assignedVendorName: vendors.name,
      })
      .from(workOrders)
      .leftJoin(users,   eq(workOrders.assignedUserId,   users.id))
      .leftJoin(vendors, eq(workOrders.assignedVendorId, vendors.id))
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[work-orders/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = UpdateWorkOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const updates: Partial<typeof workOrders.$inferInsert> = {};
    const d = parsed.data;
    if (d.title            !== undefined) updates.title            = d.title;
    if (d.type             !== undefined) updates.type             = d.type;
    if (d.status           !== undefined) updates.status           = d.status;
    if (d.assignedUserId   !== undefined) updates.assignedUserId   = d.assignedUserId;
    if (d.assignedVendorId !== undefined) updates.assignedVendorId = d.assignedVendorId;
    if (d.startDate        !== undefined) updates.startDate        = d.startDate;
    if (d.dueDate          !== undefined) updates.dueDate          = d.dueDate;
    if (d.notes            !== undefined) updates.notes            = d.notes;

    const [updated] = await db
      .update(workOrders)
      .set(updates)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated, message: 'Work order updated' });
  } catch (err) {
    console.error('[work-orders/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
