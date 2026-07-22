import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, deliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify deliverable exists and belongs to this tenant via JOIN
  const rows = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .innerJoin(projects, eq(deliverables.projectId, projects.id))
    .where(
      and(
        eq(deliverables.id, id),
        eq(projects.tenantId, ctx.tenantId)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(deliverables)
    .set({
      status: 'approved',
      approvedAt: sql`now()`,
    })
    .where(eq(deliverables.id, id))
    .returning();

  return NextResponse.json({ data: updated }, { status: 200 });
}
