import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leaveRequests, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CreateLeaveSchema = z.object({
  userId:    z.string().uuid(),
  leaveType: z.enum(['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'comp_off']),
  fromDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().min(5).max(1000),
});

// GET /api/v1/attendance/leave-requests?status=pending|approved|rejected|all
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get('status') ?? 'all';

  try {
    const conditions = [eq(leaveRequests.tenantId, ctx.tenantId)];
    if (statusParam !== 'all') {
      const valid = ['pending', 'approved', 'rejected', 'cancelled'] as const;
      if (!valid.includes(statusParam as typeof valid[number])) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      conditions.push(eq(leaveRequests.status, statusParam as typeof valid[number]));
    }

    const rows = await db
      .select()
      .from(leaveRequests)
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(500);

    // Enrich with requester + reviewer names
    const userIds = [...new Set([
      ...rows.map(r => r.userId),
      ...rows.map(r => r.reviewedBy).filter(Boolean) as string[],
    ])];

    const staffList = userIds.length > 0
      ? await db
          .select({ id: users.id, fullName: users.fullName, role: users.role, jobTitle: users.jobTitle, photoUrl: users.photoUrl })
          .from(users)
          .where(and(eq(users.tenantId, ctx.tenantId), inArray(users.id, userIds)))
      : [];

    const staffMap = new Map(staffList.map(u => [u.id, u]));
    const enriched = rows.map(r => ({
      ...r,
      user:     staffMap.get(r.userId)     ?? null,
      reviewer: r.reviewedBy ? (staffMap.get(r.reviewedBy) ?? null) : null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (e) {
    console.error('[GET /api/v1/attendance/leave-requests]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/attendance/leave-requests — raise a leave request on behalf of employee
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [row] = await db
      .insert(leaveRequests)
      .values({
        tenantId:  ctx.tenantId,
        userId:    parsed.data.userId,
        leaveType: parsed.data.leaveType,
        fromDate:  parsed.data.fromDate,
        toDate:    parsed.data.toDate,
        reason:    parsed.data.reason,
        status:    'pending',
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/attendance/leave-requests]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
