import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { portfolios, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

const PortfolioBodySchema = z.object({
  title: z.string().optional(),
  photos: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  clientConsent: z.boolean().optional(),
  coverPhotoUrl: z.string().url().nullable().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Verify project belongs to tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.projectId, projectId), eq(portfolios.tenantId, ctx.tenantId)));

    // May be undefined if not yet created
    return NextResponse.json({ data: portfolio ?? null });
  } catch (err) {
    console.error('[projects/:id/portfolio GET]', err);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PortfolioBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify project belongs to tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if portfolio already exists for this project
    const [existing] = await db
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(and(eq(portfolios.projectId, projectId), eq(portfolios.tenantId, ctx.tenantId)));

    if (existing) {
      // Update existing portfolio
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.photos !== undefined) updateData.photos = input.photos;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
      if (input.clientConsent !== undefined) updateData.clientConsent = input.clientConsent;
      if (input.coverPhotoUrl !== undefined) updateData.coverPhotoUrl = input.coverPhotoUrl;

      const [updated] = await db
        .update(portfolios)
        .set(updateData)
        .where(and(eq(portfolios.id, existing.id), eq(portfolios.tenantId, ctx.tenantId)))
        .returning();

      return NextResponse.json({ data: updated });
    } else {
      // Insert new portfolio
      const [inserted] = await db
        .insert(portfolios)
        .values({
          tenantId: ctx.tenantId,
          projectId,
          title: input.title ?? '',
          photos: input.photos ?? [],
          isPublic: input.isPublic ?? false,
          clientConsent: input.clientConsent ?? false,
          coverPhotoUrl: input.coverPhotoUrl ?? null,
          createdAt: sql`now()`,
        })
        .returning();

      return NextResponse.json({ data: inserted }, { status: 201 });
    }
  } catch (err) {
    console.error('[projects/:id/portfolio POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
