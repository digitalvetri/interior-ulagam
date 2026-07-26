import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const UpdateMilestoneSchema = z
  .object({
    label: z.string().min(1).optional(),
    amountPaise: z.number().int().nonnegative().optional(),
    triggerStage: z
      .enum([
        'design_pending',
        'design_in_progress',
        'design_approved',
        'procurement',
        'execution',
        'snagging',
        'handover',
        'complete',
      ])
      .nullable()
      .optional(),
  })
  .strict();

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
    // Verify milestone via JOIN to projects (milestones has no tenantId column)
    const [row] = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        label: milestones.label,
        pctOfTotal: milestones.pctOfTotal,
        amountPaise: milestones.amountPaise,
        triggerStage: milestones.triggerStage,
        invoiceId: milestones.invoiceId,
        paymentStatus: milestones.paymentStatus,
        paidAt: milestones.paidAt,
        razorpayLinkId: milestones.razorpayLinkId,
        createdAt: milestones.createdAt,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(milestones.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!row) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[milestones/:id GET]', err);
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

  const parsed = UpdateMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Verify tenancy via JOIN before updating
    const [existing] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(milestones.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(milestones)
      .set(parsed.data)
      .where(eq(milestones.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[milestones/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
