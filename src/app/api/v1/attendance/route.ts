import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const MarkAttendanceSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'absent', 'leave', 'half_day', 'late', 'holiday']),
  checkInAt: z.string().datetime({ offset: true }).optional().nullable(),
  checkOutAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// GET /api/v1/attendance?date=YYYY-MM-DD  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=uuid
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const date    = searchParams.get('date');
  const from    = searchParams.get('from');
  const to      = searchParams.get('to');
  const userId  = searchParams.get('userId');

  try {
    const conditions = [eq(attendanceRecords.tenantId, ctx.tenantId)];

    if (date) {
      conditions.push(eq(attendanceRecords.date, date));
    } else if (from && to) {
      conditions.push(gte(attendanceRecords.date, from));
      conditions.push(lte(attendanceRecords.date, to));
    }
    if (userId) {
      conditions.push(eq(attendanceRecords.userId, userId));
    }

    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date))
      .limit(1000);

    // Enrich with user names
    const userIds = [...new Set(rows.map(r => r.userId))];
    const staffList = userIds.length > 0
      ? await db
          .select({ id: users.id, fullName: users.fullName, role: users.role, jobTitle: users.jobTitle, department: users.department, photoUrl: users.photoUrl })
          .from(users)
          .where(and(eq(users.tenantId, ctx.tenantId), inArray(users.id, userIds)))
      : [];

    const staffMap = new Map(staffList.map(u => [u.id, u]));
    const enriched = rows.map(r => ({ ...r, user: staffMap.get(r.userId) ?? null }));

    return NextResponse.json({ data: enriched });
  } catch (e) {
    console.error('[GET /api/v1/attendance]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/attendance  — mark or update attendance for one employee on one day
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = MarkAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const { userId, date, status, checkInAt, checkOutAt, notes } = parsed.data;

    // Upsert — one record per (user, date)
    const [row] = await db
      .insert(attendanceRecords)
      .values({
        tenantId:   ctx.tenantId,
        userId,
        date,
        status,
        checkInAt:  checkInAt  ? new Date(checkInAt)  : null,
        checkOutAt: checkOutAt ? new Date(checkOutAt) : null,
        notes:      notes ?? null,
        markedBy:   ctx.dbUserId ?? undefined,
      })
      .onConflictDoUpdate({
        target: [attendanceRecords.userId, attendanceRecords.date],
        set: {
          status,
          checkInAt:  checkInAt  ? new Date(checkInAt)  : null,
          checkOutAt: checkOutAt ? new Date(checkOutAt) : null,
          notes:      notes ?? null,
          markedBy:   ctx.dbUserId ?? undefined,
        },
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/attendance]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
