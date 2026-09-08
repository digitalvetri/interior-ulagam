import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// POST /api/v1/me/check-out — employee self check-out for today
export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().slice(0, 10);

  try {
    // Must have checked in first
    const [existing] = await db
      .select({ id: attendanceRecords.id, checkInAt: attendanceRecords.checkInAt })
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        eq(attendanceRecords.userId, ctx.userId),
        eq(attendanceRecords.date, today),
      ))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'No check-in found for today' }, { status: 422 });
    }

    const [row] = await db
      .update(attendanceRecords)
      .set({ checkOutAt: now })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[POST /api/v1/me/check-out]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
