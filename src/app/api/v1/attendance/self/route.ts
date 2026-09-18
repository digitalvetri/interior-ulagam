import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const SelfAttendanceSchema = z.object({
  action: z.enum(['checkin', 'checkout']),
});

// POST /api/v1/attendance/self  — employee self check-in or check-out for today
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = SelfAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { action } = parsed.data;
  const now = new Date();
  // Use IST (UTC+5:30) date to avoid recording yesterday's date for employees
  // working after 18:30 UTC (midnight IST). Matches /api/v1/me/check-in behaviour.
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const todayStr = istDate.toISOString().slice(0, 10);

  try {
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        eq(attendanceRecords.userId,   ctx.userId),
        eq(attendanceRecords.date,     todayStr),
      ))
      .limit(1);

    let row;

    if (action === 'checkin') {
      if (existing?.checkInAt) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 409 });
      }
      [row] = await db
        .insert(attendanceRecords)
        .values({
          tenantId:  ctx.tenantId,
          userId:    ctx.userId,
          date:      todayStr,
          status:    'present',
          checkInAt: now,
          markedBy:  ctx.userId,
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.userId, attendanceRecords.date],
          set: { status: 'present', checkInAt: now, markedBy: ctx.userId },
        })
        .returning();
    } else {
      if (!existing?.checkInAt) {
        return NextResponse.json({ error: 'No check-in recorded today' }, { status: 409 });
      }
      if (existing.checkOutAt) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 409 });
      }
      [row] = await db
        .update(attendanceRecords)
        .set({ checkOutAt: now })
        .where(and(
          eq(attendanceRecords.tenantId, ctx.tenantId),
          eq(attendanceRecords.userId,   ctx.userId),
          eq(attendanceRecords.date,     todayStr),
        ))
        .returning();
    }

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[POST /api/v1/attendance/self]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
