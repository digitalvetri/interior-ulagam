import { NextRequest, NextResponse } from 'next/server';
import { and, count, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/attendance/summary?date=YYYY-MM-DD
// Returns today's KPIs + per-employee status for a given date
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = request.nextUrl.searchParams.get('date')
    ?? new Date().toISOString().split('T')[0];

  try {
    // All active employees in this tenant
    const allStaff = await db
      .select({ id: users.id, fullName: users.fullName, role: users.role, jobTitle: users.jobTitle, department: users.department, photoUrl: users.photoUrl })
      .from(users)
      .where(and(eq(users.tenantId, ctx.tenantId), ne(users.status, 'inactive')));

    // Records for this date
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, ctx.tenantId), eq(attendanceRecords.date, date)));

    const recordMap = new Map(records.map(r => [r.userId, r]));

    // Count by status
    const statusCounts = await db
      .select({ status: attendanceRecords.status, cnt: count() })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, ctx.tenantId), eq(attendanceRecords.date, date)))
      .groupBy(attendanceRecords.status);

    const countByStatus: Record<string, number> = {};
    for (const row of statusCounts) countByStatus[row.status] = Number(row.cnt);

    const markedCount = records.length;
    const unmarkedCount = allStaff.length - markedCount;

    const employees = allStaff.map(emp => ({
      ...emp,
      attendance: recordMap.get(emp.id) ?? null,
    }));

    return NextResponse.json({
      data: {
        date,
        totalEmployees: allStaff.length,
        present:  countByStatus['present']  ?? 0,
        absent:   countByStatus['absent']   ?? 0,
        leave:    countByStatus['leave']    ?? 0,
        halfDay:  countByStatus['half_day'] ?? 0,
        late:     countByStatus['late']     ?? 0,
        holiday:  countByStatus['holiday']  ?? 0,
        unmarked: unmarkedCount,
        employees,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/attendance/summary]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
