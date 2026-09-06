import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designDeliverables } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ApproveSchema = z.object({
  approvedByClient: z.string().min(1),
});

// POST /api/v1/design-deliverables/[id]/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const [deliverable] = await db
      .select({ id: designDeliverables.id, status: designDeliverables.status })
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    if (deliverable.status !== 'shared') {
      return NextResponse.json(
        { error: 'Deliverable must be in shared status to approve' },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(designDeliverables)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedByClient: parsed.data.approvedByClient,
      })
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/v1/design-deliverables/[id]/approve]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
