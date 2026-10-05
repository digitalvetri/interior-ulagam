import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects, payments } from '@/lib/db/schema';
import { allocatePayment, loadProjectMoney } from '@/lib/project-money/server';
import { syncInvoiceStatus } from '@/lib/finance/payments-server';
import { nextReceiptNumber, retryOnUniqueViolation } from '@/lib/finance/receipt-number';
import { razorpayProvider as paymentsProvider } from '@/lib/payments';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

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
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id: milestoneId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
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
        gstPct: projects.gstPct,
        customerId: projects.customerId,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(milestones.id, milestoneId), eq(milestones.tenantId, ctx.tenantId), eq(projects.tenantId, ctx.tenantId)));

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    if (milestone.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This milestone is already paid.' }, { status: 409 });
    }

    // 'overdue' — just update status, no invoice or payment row needed
    if (newStatus === 'overdue') {
      const [updatedMilestone] = await db
        .update(milestones)
        .set({ paymentStatus: 'overdue' })
        .where(and(eq(milestones.id, milestoneId), eq(milestones.tenantId, ctx.tenantId)))
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
    const invoiceId = milestone.invoiceId;

    // What is still owed on the milestone incl. GST (part payments already counted).
    const money = await loadProjectMoney(ctx.tenantId, milestone.projectId);
    const view = money?.milestones.find(m => m.id === milestoneId);
    if (!view || view.status === 'paid' || view.balancePaise <= 0) {
      return NextResponse.json({ error: 'This milestone is already paid.' }, { status: 409 });
    }
    const totalPaise = view.balancePaise;

    // A live Razorpay link would let the client pay a second time — cancel it first.
    if (milestone.razorpayLinkId) {
      const linkStatus = await paymentsProvider.cancelLink(milestone.razorpayLinkId).catch((e: unknown) => {
        console.error('[milestones/:id/override] cancel link failed', e);
        return 'unknown';
      });
      if (linkStatus === 'paid' || linkStatus === 'partially_paid') {
        return NextResponse.json(
          { error: 'The client has already paid on the payment link — wait a minute for it to be recorded instead of overriding.' },
          { status: 409 },
        );
      }
      if (linkStatus === 'unknown') {
        return NextResponse.json(
          { error: 'Could not cancel the live payment link on Razorpay. Try again, or cancel it in the Razorpay dashboard first.' },
          { status: 502 },
        );
      }
    }

    const { updatedMilestone, payment } = await retryOnUniqueViolation(() => db.transaction(async (tx) => {
      if (milestone.razorpayLinkId) {
        await tx.delete(payments).where(and(
          eq(payments.tenantId, ctx.tenantId), eq(payments.razorpayLinkId, milestone.razorpayLinkId), eq(payments.status, 'pending'),
        ));
      }
      // Manual confirmation by the owner stands in for a confirmed receipt; the
      // manual_override_* columns are the audit trail.
      const receiptNumber = await nextReceiptNumber(tx, ctx.tenantId);
      const [payment] = await tx
        .insert(payments)
        .values({
          tenantId: ctx.tenantId,
          invoiceId,
          projectId: milestone.projectId,
          customerId: milestone.customerId,
          amountPaise: totalPaise,
          status: 'captured',
          receiptNumber,
          receivedAt: new Date(),
          recordedBy: ctx.userId,
          reconciledAt: new Date(),
          manualOverrideBy: ctx.dbUserId,
          manualOverrideNote: note,
        })
        .returning();
      await allocatePayment(tx, ctx.tenantId, payment.id, milestone.projectId, totalPaise, [{ milestoneId, amountPaise: totalPaise }]);
      await syncInvoiceStatus(tx, ctx.tenantId, invoiceId);
      const [updatedMilestone] = await tx.select().from(milestones)
        .where(and(eq(milestones.id, milestoneId), eq(milestones.tenantId, ctx.tenantId)));
      return { updatedMilestone, payment };
    }));

    return NextResponse.json({ data: { milestone: updatedMilestone, payment } });
  } catch (err) {
    console.error('[milestones/:id/override POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
