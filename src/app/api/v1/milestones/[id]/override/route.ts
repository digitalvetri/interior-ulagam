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

    // 'overdue' — just update status, no invoice or payment row needed
    if (newStatus === 'overdue') {
      const [updatedMilestone] = await db
        .update(milestones)
        .set({ paymentStatus: 'overdue' })
        .where(eq(milestones.id, milestoneId))
        .returning();
      return NextResponse.json({ data: { milestone: updatedMilestone } });
    }

    // 'paid' — requires an invoice so we can create a payment record
    if (!milestone.invoiceId) {
      return NextResponse.json(
        { error: 'No invoice found for this milestone. Send a payment link first to generate an invoice, then use Manual Override to mark it as paid.' },
        { status: 400 },
      );
    }

    const [updatedMilestone] = await db
      .update(milestones)
      .set({ paymentStatus: 'paid', paidAt: sql`now()` })
      .where(eq(milestones.id, milestoneId))
      .returning();

    // Create a captured payment row — manual confirmation by owner is equivalent to a confirmed receipt
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId: ctx.tenantId,
        invoiceId: milestone.invoiceId,
        amountPaise: milestone.amountPaise,
        status: 'captured',
        reconciledAt: new Date(),
        manualOverrideBy: ctx.dbUserId,
        manualOverrideNote: note,
      })
      .returning();

    return NextResponse.json({ data: { milestone: updatedMilestone, payment } });
  } catch (err) {
    console.error('[milestones/:id/override POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
