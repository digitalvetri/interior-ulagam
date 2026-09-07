import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workOrders, projects, vendors, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── GET /api/v1/work-orders ──────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db
      .select({
        id:           workOrders.id,
        projectId:    workOrders.projectId,
        title:        workOrders.title,
        type:         workOrders.type,
        status:       workOrders.status,
        startDate:    workOrders.startDate,
        dueDate:      workOrders.dueDate,
        notes:        workOrders.notes,
        createdAt:    workOrders.createdAt,
        projectName:  projects.name,
        vendorName:   vendors.name,
        assigneeName: users.fullName,
      })
      .from(workOrders)
      .leftJoin(projects, eq(workOrders.projectId, projects.id))
      .leftJoin(vendors,  eq(workOrders.assignedVendorId, vendors.id))
      .leftJoin(users,    eq(workOrders.assignedUserId,   users.id))
      .where(eq(workOrders.tenantId, ctx.tenantId))
      .orderBy(desc(workOrders.createdAt));

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/work-orders]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
