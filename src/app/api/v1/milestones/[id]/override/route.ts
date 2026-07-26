import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects, payments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

const OverrideSchema = z.object({
  newStatus: z.enum(['paid', 'overdue']),
  note: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — owner role required' }, { status: 403 });
  }

  const { id: milestoneId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { newStatus, note } = parsed.data;

  try {
    // Verify milestone belongs to tenant via JOIN
    const [milestone] = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        amountPaise: milestones.amountPaise,
        invoiceId: milestones.invoiceId,
        paymentStatus: milestones.paymentStatus,
        label: milestones.label,
        pctOfTotal: milestones.pctOfTotal,
        triggerStage: milestones.triggerStage,
        paidAt: milestones.paidAt,
        razorpayLinkId: milestones.razorpayLinkId,
        createdAt: milestones.createdAt,
        tenantId: projects.tenantId,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(milestones.id, milestoneId), eq(projects.tenantId, ctx.tenantId)));

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    if (!milestone.invoiceId) {
      return NextResponse.json(
        { error: 'Milestone has no invoice — trigger a payment link first' },
        { status: 400 },
      );
    }

    // Update milestone paymentStatus; set paidAt if status is 'paid'
    const milestoneSet: Record<string, unknown> = { paymentStatus: newStatus };
    if (newStatus === 'paid') {
      milestoneSet.paidAt = sql`now()`;
    }

    const [updatedMilestone] = await db
      .update(milestones)
      .set(milestoneSet)
      .where(eq(milestones.id, milestoneId))
      .returning();

    // Insert payment audit row for manual override
    // NOTE: payments.status is intentionally NOT set here — it defaults to 'pending' at DB level.
    // IRON RULE: payments.status is written ONLY by the Razorpay webhook handler.
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId: ctx.tenantId,
        invoiceId: milestone.invoiceId,
        amountPaise: milestone.amountPaise,
        manualOverrideBy: ctx.userId,
        manualOverrideNote: note,
      })
      .returning();

    return NextResponse.json({ data: { milestone: updatedMilestone, payment } });
  } catch (err) {
    console.error('[milestones/:id/override POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
