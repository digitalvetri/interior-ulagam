import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leaveRequests } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CreateLeaveSchema = z.object({
  leaveType: z.enum(['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'comp_off']),
  fromDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().min(5).max(1000),
});

// GET /api/v1/me/leave-requests — get my own leave requests
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get('status') ?? 'all';

  const conditions = [
    eq(leaveRequests.tenantId, ctx.tenantId),
    eq(leaveRequests.userId, ctx.userId),
  ];

  if (statusParam !== 'all') {
    const valid = ['pending', 'approved', 'rejected', 'cancelled'] as const;
    if (!valid.includes(statusParam as typeof valid[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    conditions.push(eq(leaveRequests.status, statusParam as typeof valid[number]));
  }

  try {
    const rows = await db
      .select()
      .from(leaveRequests)
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(200);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/me/leave-requests]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/me/leave-requests — submit a leave request as the current user
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

  const { leaveType, fromDate, toDate, reason } = parsed.data;

  if (fromDate > toDate) {
    return NextResponse.json({ error: 'fromDate must be before or equal to toDate' }, { status: 422 });
  }

  try {
    const [row] = await db
      .insert(leaveRequests)
      .values({
        tenantId:  ctx.tenantId,
        userId:    ctx.userId,
        leaveType,
        fromDate,
        toDate,
        reason,
        status: 'pending',
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/me/leave-requests]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
