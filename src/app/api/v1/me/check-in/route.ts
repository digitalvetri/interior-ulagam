import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { istToday } from '@/lib/dates/ist';
import { AttendanceLocationSchema, resolveLocation } from '@/lib/attendance/location';

// POST /api/v1/me/check-in — self check-in (any staff role, owner included) with optional GPS location
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.STAFF);
  if (denied) return denied;

  let body: unknown;
  try { body = await request.json(); }
  catch { body = {}; }

  const parsed = AttendanceLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const now = new Date();
  const today = istToday();
  // Don't let a second check-in rewrite the first one, or turn an approved
  // leave day into "present" (payroll reads this status).
  const [existing] = await db
    .select({ status: attendanceRecords.status, checkInAt: attendanceRecords.checkInAt })
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.tenantId, ctx.tenantId),
      eq(attendanceRecords.userId, ctx.userId),
      eq(attendanceRecords.date, today),
    ))
    .limit(1);
  if (existing?.checkInAt) {
    const at = existing.checkInAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    return NextResponse.json({ error: `You already checked in today at ${at}.` }, { status: 409 });
  }
  if (existing?.status === 'leave') {
    return NextResponse.json({ error: 'You are on approved leave today. Ask the owner to change it if you are working.' }, { status: 409 });
  }

  // Reverse geocoding has its own 5s timeout and never throws.
  const loc = await resolveLocation(parsed.data);

  try {
    const [row] = await db
      .insert(attendanceRecords)
      .values({
        tenantId:          ctx.tenantId,
        userId:            ctx.userId,
        date:              today,
        status:            'present',
        checkInAt:         now,
        checkInLatitude:   loc.latitude,
        checkInLongitude:  loc.longitude,
        checkInAddress:    loc.address,
        checkInAccuracyM:  loc.accuracyM,
        markedBy:          ctx.userId,
      })
      .onConflictDoUpdate({
        target: [attendanceRecords.userId, attendanceRecords.date],
        set: {
          checkInAt:        now,
          checkInLatitude:  loc.latitude,
          checkInLongitude: loc.longitude,
          checkInAddress:   loc.address,
          checkInAccuracyM: loc.accuracyM,
          status:           'present',
          markedBy:         ctx.userId,
        },
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/me/check-in]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/v1/me/check-in — get today's check-in status for the current user
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = istToday();

  try {
    const [row] = await db
      .select()
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        eq(attendanceRecords.userId, ctx.userId),
        eq(attendanceRecords.date, today),
      ))
      .limit(1);

    return NextResponse.json({ data: row ?? null });
  } catch (e) {
    console.error('[GET /api/v1/me/check-in]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
