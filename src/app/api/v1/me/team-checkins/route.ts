import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/me/team-checkins — owner/manager view: who has checked in today
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners can see team check-ins
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().slice(0, 10);

  try {
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        eq(attendanceRecords.date, today),
      ))
      .limit(200);

    const userIds = [...new Set(records.map(r => r.userId))];
    const staffList = userIds.length > 0
      ? await db
          .select({ id: users.id, fullName: users.fullName, role: users.role, photoUrl: users.photoUrl, jobTitle: users.jobTitle })
          .from(users)
          .where(and(eq(users.tenantId, ctx.tenantId), inArray(users.id, userIds)))
      : [];

    const staffMap = new Map(staffList.map(u => [u.id, u]));
    const enriched = records.map(r => ({ ...r, user: staffMap.get(r.userId) ?? null }));

    return NextResponse.json({ data: enriched, date: today });
  } catch (e) {
    console.error('[GET /api/v1/me/team-checkins]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
