import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CheckInSchema = z.object({
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address:   z.string().max(500).optional(),
});

// POST /api/v1/me/check-in — employee self check-in with optional GPS location
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { body = {}; }

  const parsed = CheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { latitude, longitude, address } = parsed.data;

  // IST date for "today" — use UTC+5:30 offset
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().slice(0, 10);

  try {
    const [row] = await db
      .insert(attendanceRecords)
      .values({
        tenantId:          ctx.tenantId,
        userId:            ctx.userId,
        date:              today,
        status:            'present',
        checkInAt:         now,
        checkInLatitude:   latitude?.toString()  ?? null,
        checkInLongitude:  longitude?.toString() ?? null,
        checkInAddress:    address ?? null,
        markedBy:          ctx.userId,
      })
      .onConflictDoUpdate({
        target: [attendanceRecords.userId, attendanceRecords.date],
        set: {
          checkInAt:        now,
          checkInLatitude:  latitude?.toString()  ?? null,
          checkInLongitude: longitude?.toString() ?? null,
          checkInAddress:   address ?? null,
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

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().slice(0, 10);

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
