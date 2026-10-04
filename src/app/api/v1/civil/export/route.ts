import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { buildCivilExcel } from '@/lib/civil/excel-statement';
import {
  downloadName, jobFilterConditions, jobsWithLines, periodTitle, serverError, statementTitle,
} from '@/lib/civil/server';

/** The filtered jobs as a styled .xlsx work statement (title, summary boxes, boxed job blocks, totals). */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const filters = jobFilterConditions(params);
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });

  try {
    const jobs = await jobsWithLines(ctx.tenantId, filters.conditions);
    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);

    const buf = await buildCivilExcel({
      title: statementTitle(jobs, params),
      period: periodTitle(params),
      studioName: tenant?.name ?? 'Konst Design',
      jobs,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadName(jobs, params)}.xlsx"`,
      },
    });
  } catch (err) {
    return serverError('civil/export GET', err);
  }
}
