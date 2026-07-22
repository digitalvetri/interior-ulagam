import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { siteLogs, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const PatchSiteLogSchema = z.object({
  progressPct: z.number().int().min(0).max(100).optional(),
  delayFlag: z.boolean().optional(),
  transcript: z.string().optional(),
  aiParsedJson: z.unknown().optional(),
  labourCount: z.number().int().nonnegative().optional(),
  blockersJson: z.unknown().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // JOIN projects to verify tenant ownership
    const [log] = await db
      .select({
        id: siteLogs.id,
        tenantId: siteLogs.tenantId,
        projectId: siteLogs.projectId,
        logDate: siteLogs.logDate,
        photos: siteLogs.photos,
        voiceNoteUrl: siteLogs.voiceNoteUrl,
        transcript: siteLogs.transcript,
        progressPct: siteLogs.progressPct,
        stage: siteLogs.stage,
        delayFlag: siteLogs.delayFlag,
        labourCount: siteLogs.labourCount,
        blockersJson: siteLogs.blockersJson,
        aiParsedJson: siteLogs.aiParsedJson,
        source: siteLogs.source,
        createdAt: siteLogs.createdAt,
      })
      .from(siteLogs)
      .innerJoin(projects, eq(siteLogs.projectId, projects.id))
      .where(
        and(
          eq(siteLogs.id, id),
          eq(projects.tenantId, ctx.tenantId),
        ),
      );

    if (!log) {
      return NextResponse.json({ error: 'Site log not found' }, { status: 404 });
    }

    return NextResponse.json({ data: log });
  } catch (err) {
    console.error('[site-logs/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSiteLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Verify the site log belongs to this tenant via JOIN on projects
    const [existing] = await db
      .select({ id: siteLogs.id })
      .from(siteLogs)
      .innerJoin(projects, eq(siteLogs.projectId, projects.id))
      .where(
        and(
          eq(siteLogs.id, id),
          eq(projects.tenantId, ctx.tenantId),
        ),
      );

    if (!existing) {
      return NextResponse.json({ error: 'Site log not found' }, { status: 404 });
    }

    // Build update payload — only include fields that were provided
    const updatePayload: Record<string, unknown> = {};
    if (input.progressPct !== undefined) updatePayload.progressPct = input.progressPct;
    if (input.delayFlag !== undefined) updatePayload.delayFlag = input.delayFlag;
    if (input.transcript !== undefined) updatePayload.transcript = input.transcript;
    if (input.aiParsedJson !== undefined) updatePayload.aiParsedJson = input.aiParsedJson;
    if (input.labourCount !== undefined) updatePayload.labourCount = input.labourCount;
    if (input.blockersJson !== undefined) updatePayload.blockersJson = input.blockersJson;

    const [updated] = await db
      .update(siteLogs)
      .set(updatePayload)
      .where(
        and(
          eq(siteLogs.id, id),
          eq(siteLogs.tenantId, ctx.tenantId),
        ),
      )
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[site-logs/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
