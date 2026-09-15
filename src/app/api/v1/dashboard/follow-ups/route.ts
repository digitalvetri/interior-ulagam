import { NextResponse } from 'next/server';
import { and, eq, isNull, isNotNull, lt, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/dashboard/follow-ups
// Returns counts of leads with an active follow-up date, bucketed by urgency.
// Uses leads.followUpDate as the source of truth — matches what the leads page chip shows.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Build IST-based day boundaries (UTC equivalents)
    const nowUTC = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);
    const todayStartIST = new Date(nowIST);
    todayStartIST.setHours(0, 0, 0, 0);
    const todayStartUTC = new Date(todayStartIST.getTime() - IST_OFFSET_MS);
    const tomorrowStartUTC = new Date(todayStartUTC.getTime() + 86_400_000);
    const nextWeekUTC = new Date(todayStartUTC.getTime() + 7 * 86_400_000);

    const baseFilter = and(
      eq(leads.tenantId, ctx.tenantId),
      isNotNull(leads.followUpDate),
      isNull(leads.archivedAt),
    );

    const [all, overdueRows, todayRows, upcomingRows] = await Promise.all([
      db.select({ id: leads.id }).from(leads).where(baseFilter),
      db.select({ id: leads.id }).from(leads)
        .where(and(baseFilter, lt(leads.followUpDate, todayStartUTC))),
      db.select({ id: leads.id }).from(leads)
        .where(and(baseFilter, gte(leads.followUpDate, todayStartUTC), lt(leads.followUpDate, tomorrowStartUTC))),
      db.select({ id: leads.id }).from(leads)
        .where(and(baseFilter, gte(leads.followUpDate, tomorrowStartUTC), lt(leads.followUpDate, nextWeekUTC))),
    ]);

    return NextResponse.json({
      data: {
        overdue:  overdueRows.length,
        dueToday: todayRows.length,
        upcoming: upcomingRows.length,
        total:    all.length,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/dashboard/follow-ups]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
