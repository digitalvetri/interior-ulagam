import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { siteLogs, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const QuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
});

// GET /api/v1/site-logs — all site logs across all projects for this tenant
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    projectId: sp.get('projectId') ?? undefined,
    from:      sp.get('from')      ?? undefined,
    to:        sp.get('to')        ?? undefined,
    limit:     sp.get('limit')     ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, from, to, limit } = parsed.data;

  try {
    const conditions = [
      eq(siteLogs.tenantId, ctx.tenantId),
    ];

    if (projectId) conditions.push(eq(siteLogs.projectId, projectId));
    if (from)      conditions.push(gte(siteLogs.logDate, from));
    if (to)        conditions.push(lte(siteLogs.logDate, to));

    const rows = await db
      .select({
        id:          siteLogs.id,
        projectId:   siteLogs.projectId,
        projectName: projects.name,
        logDate:     siteLogs.logDate,
        transcript:  siteLogs.transcript,
        progressPct: siteLogs.progressPct,
        delayFlag:   siteLogs.delayFlag,
        labourCount: siteLogs.labourCount,
        source:      siteLogs.source,
        photos:      siteLogs.photos,
        createdAt:   siteLogs.createdAt,
      })
      .from(siteLogs)
      .innerJoin(projects, eq(siteLogs.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(siteLogs.logDate), desc(siteLogs.createdAt))
      .limit(limit);

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[site-logs GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
