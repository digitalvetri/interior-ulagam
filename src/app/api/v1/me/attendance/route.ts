import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/me/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the authenticated user's own attendance records.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const conditions = [
    eq(attendanceRecords.tenantId, ctx.tenantId),
    eq(attendanceRecords.userId, ctx.userId),
  ];

  if (from) conditions.push(gte(attendanceRecords.date, from));
  if (to)   conditions.push(lte(attendanceRecords.date, to));

  try {
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date))
      .limit(366);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/me/attendance]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
