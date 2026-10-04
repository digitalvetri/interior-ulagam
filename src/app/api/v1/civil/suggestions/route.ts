import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobLines, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { serverError } from '@/lib/civil/server';

/** Headings and line descriptions typed before, most used first — feeds the job editor's autosuggest. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  try {
    const headingKey = sql<string>`upper(trim(${civilJobs.heading}))`;
    const descKey = sql<string>`upper(trim(${civilJobLines.description}))`;
    const [headings, descriptions] = await Promise.all([
      db.select({ text: headingKey, uses: sql<number>`count(*)::int` }).from(civilJobs)
        .where(eq(civilJobs.tenantId, ctx.tenantId))
        .groupBy(headingKey).orderBy(desc(sql`count(*)`)).limit(300),
      db.select({ text: descKey, uses: sql<number>`count(*)::int` }).from(civilJobLines)
        .where(eq(civilJobLines.tenantId, ctx.tenantId))
        .groupBy(descKey).orderBy(desc(sql`count(*)`)).limit(500),
    ]);
    return NextResponse.json({ data: { headings, descriptions } });
  } catch (err) {
    return serverError('civil/suggestions GET', err);
  }
}
