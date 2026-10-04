import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { serverError } from '@/lib/civil/server';

/** The four numbers on the Civil home page. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  try {
    const [row] = await db.select({
      monthCount: sql<number>`count(*) filter (where date_trunc('month', ${civilJobs.jobDate}) = date_trunc('month', (now() at time zone 'Asia/Kolkata')::date))::int`,
      monthPaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (where date_trunc('month', ${civilJobs.jobDate}) = date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)), 0)::bigint`,
      doneCount: sql<number>`count(*) filter (where ${civilJobs.status} = 'done')::int`,
      donePaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (where ${civilJobs.status} = 'done'), 0)::bigint`,
      billedCount: sql<number>`count(*) filter (where ${civilJobs.status} = 'billed')::int`,
      billedPaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (where ${civilJobs.status} = 'billed'), 0)::bigint`,
      paidThisMonthPaise: sql<number>`coalesce(sum(${civilJobs.totalPaise}) filter (
        where ${civilJobs.status} = 'paid' and date_trunc('month', ${civilJobs.paidDate}) = date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)
      ), 0)::bigint`,
    }).from(civilJobs).where(eq(civilJobs.tenantId, ctx.tenantId));

    const data = Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)]));
    return NextResponse.json({ data });
  } catch (err) {
    return serverError('civil/summary GET', err);
  }
}
