import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects, invoices, payments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, count, sql } from 'drizzle-orm';
import { razorpayProvider as paymentsProvider } from '@/lib/payments';
import { logPendingWorkflow } from '@/jobs/queue';

const TriggerSchema = z.object({
  clientName: z.string().min(1),
  contactPhone: z.string().min(1),
  placeOfSupply: z.string().optional(),
  isInterstate: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: milestoneId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { clientName, contactPhone, placeOfSupply, isInterstate = false } = parsed.data;

  try {
    // a. Verify milestone belongs to tenant via JOIN
    const [milestone] = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        label: milestones.label,
        amountPaise: milestones.amountPaise,
        paymentStatus: milestones.paymentStatus,
        pctOfTotal: milestones.pctOfTotal,
        triggerStage: milestones.triggerStage,
        invoiceId: milestones.invoiceId,
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

    // b. Count existing invoices for tenant → build invoice number
    const [{ value: invoiceCount }] = await db
      .select({ value: count() })
      .from(invoices)
      .where(eq(invoices.tenantId, ctx.tenantId));

    const currentYear = new Date().getFullYear();
    const invoiceNumber =
      'INV-' + String(currentYear) + '-' + String(Number(invoiceCount) + 1).padStart(4, '0');

    // c. subtotalPaise = milestone.amountPaise
    const subtotalPaise = milestone.amountPaise;

    // d. GST calculation
    const igstPaise = isInterstate ? Math.round(subtotalPaise * 0.18) : 0;
    const cgstPaise = isInterstate ? 0 : Math.round(subtotalPaise * 0.09);
    const sgstPaise = isInterstate ? 0 : Math.round(subtotalPaise * 0.09);

    // e. Insert invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        tenantId: ctx.tenantId,
        projectId: milestone.projectId,
        invoiceNumber,
        invoiceDate: sql`CURRENT_DATE`,
        subtotalPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        placeOfSupply: placeOfSupply ?? null,
        isInterstate,
      })
      .returning();

    // f. Create Razorpay payment link
    const link = await paymentsProvider.createLink({
      amountPaise: subtotalPaise,
      description: milestone.label,
      customerName: clientName,
      customerPhone: contactPhone,
      referenceId: milestone.id,
    });

    // g. Insert payment row
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        razorpayLinkId: link.id,
        amountPaise: subtotalPaise,
        status: 'pending',
      })
      .returning();

    // h. Update milestone: paymentStatus='link_sent', razorpayLinkId, invoiceId
    const [updatedMilestone] = await db
      .update(milestones)
      .set({
        paymentStatus: 'link_sent',
        razorpayLinkId: link.id,
        invoiceId: invoice.id,
      })
      .where(eq(milestones.id, milestoneId))
      .returning();

    // i. Enqueue the follow-up job
    await logPendingWorkflow('milestone/payment-link.sent', {
        milestoneId: milestone.id,
        projectId: milestone.projectId,
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        amountPaise: subtotalPaise,
        clientName,
        contactPhone,
        paymentLinkId: link.id,
        paymentLinkUrl: link.shortUrl,
      });

    // j. Return response
    return NextResponse.json(
      {
        data: {
          milestone: updatedMilestone,
          invoice,
          paymentLink: { id: link.id, shortUrl: link.shortUrl },
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[milestones/:id/trigger POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
