import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, leaveRequests } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ReviewSchema = z.object({
  action:     z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(500).optional().nullable(),
});

// PATCH /api/v1/attendance/leave-requests/[id] — approve or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.tenantId, ctx.tenantId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status:     parsed.data.action,
        reviewedBy: ctx.dbUserId ?? undefined,
        reviewedAt: new Date(),
        reviewNote: parsed.data.reviewNote ?? null,
      })
      .where(eq(leaveRequests.id, id))
      .returning();

    // When approved, write attendance_records rows (one per day in range)
    if (parsed.data.action === 'approved') {
      const from = new Date(existing.fromDate);
      const to   = new Date(existing.toDate);
      const days: string[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().split('T')[0]);
      }

      for (const day of days) {
        await db
          .insert(attendanceRecords)
          .values({
            tenantId: ctx.tenantId,
            userId:   existing.userId,
            date:     day,
            status:   'leave',
            markedBy: ctx.dbUserId ?? undefined,
          })
          .onConflictDoUpdate({
            target: [attendanceRecords.userId, attendanceRecords.date],
            set:    { status: 'leave', markedBy: ctx.dbUserId ?? undefined },
          });
      }
    }

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error('[PATCH /api/v1/attendance/leave-requests/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
