import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { siteLogs, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

const CreateSiteLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'logDate must be YYYY-MM-DD'),
  photos: z.array(z.string().url()).optional(),
  voiceNoteUrl: z.string().url().optional(),
  transcript: z.string().optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  stage: z.string().optional(),
  delayFlag: z.boolean().optional(),
  labourCount: z.number().int().nonnegative().optional(),
  blockersJson: z.unknown().optional(),
  source: z.enum(['whatsapp', 'manual']).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify the project belongs to this tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const conditions = [
      eq(siteLogs.tenantId, ctx.tenantId),
      eq(siteLogs.projectId, projectId),
    ];

    if (startDate) {
      conditions.push(gte(siteLogs.logDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(siteLogs.logDate, endDate));
    }

    const logs = await db
      .select()
      .from(siteLogs)
      .where(and(...conditions))
      .orderBy(desc(siteLogs.logDate));

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error('[projects/:id/site-logs GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify the project belongs to this tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSiteLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    const [created] = await db
      .insert(siteLogs)
      .values({
        tenantId: ctx.tenantId,
        projectId,
        logDate: input.logDate,
        photos: input.photos ?? [],
        voiceNoteUrl: input.voiceNoteUrl,
        transcript: input.transcript,
        progressPct: input.progressPct,
        stage: input.stage,
        delayFlag: input.delayFlag ?? false,
        labourCount: input.labourCount,
        blockersJson: input.blockersJson ?? null,
        source: input.source ?? 'manual',
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[projects/:id/site-logs POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
