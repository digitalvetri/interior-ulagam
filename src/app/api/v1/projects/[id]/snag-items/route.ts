import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, snagItems } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';

const CreateSnagItemSchema = z.object({
  description: z.string().min(1),
  photoUrl: z.string().url().optional(),
  assigneeId: z.string().uuid().optional(),
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
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(snagItems)
      .where(eq(snagItems.projectId, id))
      .orderBy(asc(snagItems.createdAt));

    return NextResponse.json({ data: items });
  } catch (err) {
    console.error('[projects/:id/snag-items GET]', err);
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

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSnagItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [created] = await db
      .insert(snagItems)
      .values({
        projectId: id,
        description: input.description,
        photoUrl: input.photoUrl ?? null,
        assigneeId: input.assigneeId ?? null,
        status: 'open',
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[projects/:id/snag-items POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
