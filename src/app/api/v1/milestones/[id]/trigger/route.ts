import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, projects, invoices, payments } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, ne, sql } from 'drizzle-orm';
import { razorpayProvider as paymentsProvider } from '@/lib/payments';
import { logPendingWorkflow } from '@/jobs/queue';
import { loadProjectMoney } from '@/lib/project-money/server';
import { milestoneLinkAmounts } from '@/lib/finance/gst';
import { nextInvoiceNumber } from '@/lib/finance/invoice-number';
import { retryOnUniqueViolation } from '@/lib/finance/receipt-number';
import { DEFAULT_INVOICE_DUE_DAYS } from '@/lib/finance/constants';
import { addDaysToDateStr, istToday } from '@/lib/dates/ist';

const TriggerSchema = z.object({
  clientName: z.string().min(1),
  contactPhone: z.string().min(1),
  placeOfSupply: z.string().optional(),
  isInterstate: z.boolean().optional(),
  /** Ignored — GST follows the project's GST rate (0 for no GST). Kept so older clients still validate. */
  noGst: z.boolean().optional(),
  /** Cancel the milestone's live link and send a fresh one. */
  replace: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { id: milestoneId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { clientName, contactPhone, placeOfSupply, isInterstate = false, replace = false } = parsed.data;
  const tenantId = ctx.tenantId;

  try {
    const [milestone] = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        label: milestones.label,
        paymentStatus: milestones.paymentStatus,
        invoiceId: milestones.invoiceId,
        razorpayLinkId: milestones.razorpayLinkId,
        customerId: projects.customerId,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(milestones.id, milestoneId), eq(milestones.tenantId, tenantId), eq(projects.tenantId, tenantId)));

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Amounts come from the project money engine (current ex-GST share + what is still owed).
    const money = await loadProjectMoney(tenantId, milestone.projectId);
    const view = money?.milestones.find(m => m.id === milestoneId);
    if (!money || !view) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (milestone.paymentStatus === 'paid' || view.status === 'paid' || view.balancePaise <= 0) {
      return NextResponse.json({ error: 'This milestone is already paid.' }, { status: 409 });
    }

    // A live link must be cancelled before a new one goes out — never two links for one milestone.
    const [livePending] = milestone.razorpayLinkId
      ? await db.select({ id: payments.id }).from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.razorpayLinkId, milestone.razorpayLinkId), eq(payments.status, 'pending')))
        .limit(1)
      : [];
    if (livePending && milestone.razorpayLinkId) {
      if (!replace) {
        return NextResponse.json(
          { error: 'A payment link is already active for this milestone. Resend to cancel it and send a new one.' },
          { status: 409 },
        );
      }
      const oldStatus = await paymentsProvider.cancelLink(milestone.razorpayLinkId);
      if (oldStatus === 'paid' || oldStatus === 'partially_paid') {
        return NextResponse.json(
          { error: 'The client has already paid on the current link — wait a minute for the payment to be recorded.' },
          { status: 409 },
        );
      }
    }

    // Reuse the milestone's invoice unless it was voided. Its amounts are only
    // rewritten while nothing has been received against it.
    let reuseInvoice: { id: string; locked: boolean } | null = null;
    if (milestone.invoiceId) {
      const [inv] = await db.select({
        id: invoices.id, status: invoices.status,
        received: sql<number>`(select coalesce(sum(p.amount_paise), 0) from payments p where p.invoice_id = ${invoices.id} and p.status <> 'pending' and p.tenant_id = ${tenantId})`.mapWith(Number),
      }).from(invoices).where(and(eq(invoices.id, milestone.invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
      if (inv && inv.status !== 'void') reuseInvoice = { id: inv.id, locked: inv.received > 0 };
    }

    const amounts = milestoneLinkAmounts(view.amountPaise, money.project.gstPct, isInterstate, view.balancePaise);
    let linkAmountPaise = amounts.linkAmountPaise;
    if (reuseInvoice?.locked) linkAmountPaise = view.balancePaise; // invoice keeps its original figures
    if (linkAmountPaise <= 0) {
      return NextResponse.json({ error: 'Nothing left to collect on this milestone.' }, { status: 409 });
    }

    // Create the link first; if saving fails afterwards it is cancelled again.
    const link = await paymentsProvider.createLink({
      amountPaise: linkAmountPaise,
      description: milestone.label,
      customerName: clientName,
      customerPhone: contactPhone,
      // Unique per attempt — Razorpay rejects a reused reference_id.
      referenceId: `MS-${milestone.id.slice(0, 8)}-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    });

    let saved;
    try {
      saved = await retryOnUniqueViolation(() => db.transaction(async (tx) => {
        // Dropping the old pending row keeps one outstanding link per milestone.
        if (milestone.razorpayLinkId) {
          await tx.delete(payments).where(and(
            eq(payments.tenantId, tenantId), eq(payments.razorpayLinkId, milestone.razorpayLinkId), eq(payments.status, 'pending'),
          ));
        }

        const dueDate = addDaysToDateStr(istToday(), DEFAULT_INVOICE_DUE_DAYS);
        let invoice;
        if (reuseInvoice) {
          [invoice] = await tx.update(invoices).set({
            ...(reuseInvoice.locked ? {} : {
              subtotalPaise: view.amountPaise, cgstPaise: amounts.cgstPaise, sgstPaise: amounts.sgstPaise,
              igstPaise: amounts.igstPaise, isInterstate, placeOfSupply: placeOfSupply ?? null,
            }),
            // Sending the link issues the invoice, so it counts in receivables and the GST report.
            status: sql`case when ${invoices.status} = 'draft' then 'issued'::invoice_lifecycle_status else ${invoices.status} end`,
            issuedAt: sql`coalesce(${invoices.issuedAt}, now())`,
            dueDate: sql`coalesce(${invoices.dueDate}, ${dueDate}::date)`,
          }).where(and(eq(invoices.id, reuseInvoice.id), eq(invoices.tenantId, tenantId), ne(invoices.status, 'void'))).returning();
        } else {
          [invoice] = await tx.insert(invoices).values({
            tenantId,
            projectId: milestone.projectId,
            invoiceNumber: await nextInvoiceNumber(tx, tenantId),
            invoiceDate: sql`(now() AT TIME ZONE 'Asia/Kolkata')::date`,
            subtotalPaise: view.amountPaise,
            cgstPaise: amounts.cgstPaise,
            sgstPaise: amounts.sgstPaise,
            igstPaise: amounts.igstPaise,
            placeOfSupply: placeOfSupply ?? null,
            isInterstate,
            status: 'issued',
            issuedAt: new Date(),
            dueDate,
          }).returning();
        }
        if (!invoice) throw new Error('Invoice could not be saved');

        const [payment] = await tx.insert(payments).values({
          tenantId,
          invoiceId: invoice.id,
          projectId: milestone.projectId,
          customerId: milestone.customerId,
          razorpayLinkId: link.id,
          amountPaise: linkAmountPaise,
          mode: 'razorpay',
          status: 'pending',
        }).returning();

        const [updatedMilestone] = await tx.update(milestones)
          .set({ paymentStatus: 'link_sent', razorpayLinkId: link.id, invoiceId: invoice.id })
          .where(and(eq(milestones.id, milestoneId), eq(milestones.tenantId, tenantId)))
          .returning();

        return { invoice, payment, updatedMilestone };
      }));
    } catch (err) {
      await paymentsProvider.cancelLink(link.id).catch((e: unknown) => console.error('[milestones/:id/trigger] cancel after failure', e));
      throw err;
    }

    await logPendingWorkflow('milestone/payment-link.sent', {
      milestoneId: milestone.id,
      projectId: milestone.projectId,
      tenantId,
      invoiceId: saved.invoice.id,
      paymentId: saved.payment.id,
      amountPaise: linkAmountPaise,
      clientName,
      contactPhone,
      paymentLinkId: link.id,
      paymentLinkUrl: link.shortUrl,
    });

    return NextResponse.json(
      {
        data: {
          milestone: saved.updatedMilestone,
          invoice: saved.invoice,
          paymentLink: { id: link.id, shortUrl: link.shortUrl, amountPaise: linkAmountPaise },
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[milestones/:id/trigger POST]', err);
    const message = err instanceof Error && /Razorpay is not connected/.test(err.message) ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
