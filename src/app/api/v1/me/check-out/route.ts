import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { istToday } from '@/lib/dates/ist';
import { AttendanceLocationSchema, resolveLocation } from '@/lib/attendance/location';

// POST /api/v1/me/check-out — self check-out for today with optional GPS location
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.STAFF);
  if (denied) return denied;

  // Older callers send no body — treat that as "no location".
  let body: unknown;
  try { body = await request.json(); }
  catch { body = {}; }

  const parsed = AttendanceLocationSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const now = new Date();
  const today = istToday();

  try {
    // Must have checked in first
    const [existing] = await db
      .select({ id: attendanceRecords.id, checkInAt: attendanceRecords.checkInAt, checkOutAt: attendanceRecords.checkOutAt })
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        eq(attendanceRecords.userId, ctx.userId),
        eq(attendanceRecords.date, today),
      ))
      .limit(1);

    if (!existing?.checkInAt) {
      return NextResponse.json({ error: 'No check-in found for today' }, { status: 422 });
    }
    if (existing.checkOutAt) {
      const at = existing.checkOutAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      return NextResponse.json({ error: `You already checked out today at ${at}.` }, { status: 409 });
    }

    // Reverse geocoding has its own 5s timeout and never throws.
    const loc = await resolveLocation(parsed.data);

    const [row] = await db
      .update(attendanceRecords)
      .set({
        checkOutAt:        now,
        checkOutLatitude:  loc.latitude,
        checkOutLongitude: loc.longitude,
        checkOutAddress:   loc.address,
        checkOutAccuracyM: loc.accuracyM,
      })
      .where(and(eq(attendanceRecords.id, existing.id), eq(attendanceRecords.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[POST /api/v1/me/check-out]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
