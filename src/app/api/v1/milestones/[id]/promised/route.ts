import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { milestones, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const PromisedSchema = z.object({
  promisedAt:   z.string().datetime(),
  promisedNote: z.string().max(500).optional(),
});

// POST /api/v1/milestones/[id]/promised
// Records a client payment promise (date + optional note).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = PromisedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    // Verify milestone belongs to this tenant via project join
    const [ms] = await db
      .select({ id: milestones.id, projectId: milestones.projectId })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(eq(milestones.id, id))
      .limit(1);

    if (!ms) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [updated] = await db.update(milestones)
      .set({
        promisedAt:   new Date(parsed.data.promisedAt),
        promisedNote: parsed.data.promisedNote ?? null,
      })
      .where(eq(milestones.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/v1/milestones/[id]/promised]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
