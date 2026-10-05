import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { payments, milestones, invoices, projects } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { enqueue } from '@/jobs/queue';
import { checkRateLimit, webhookLimiter } from '@/lib/ratelimit';
import { nextReceiptNumber, retryOnUniqueViolation } from '@/lib/finance/receipt-number';
import { syncInvoiceStatus } from '@/lib/finance/payments-server';
import { allocatePayment } from '@/lib/project-money/server';
import { getRazorpayConfig } from '@/lib/integrations/resolve';

// Razorpay Payment Links fire `payment_link.paid` with payload.payment_link.entity
// (id = plink_…, reference_id) and payload.payment.entity (id = pay_…, amount).
// The payment entity of a plain `payment.captured` has no link id (only order_id),
// so link payments are matched on `payment_link.paid`. A `payment.captured` that
// does carry `payment_link_id` is handled the same way. Both are idempotent on
// razorpay_payment_id, and only a still-pending link row is ever settled.

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity?: { id?: string; amount?: number; payment_link_id?: string } };
    payment_link?: { entity?: { id?: string; reference_id?: string } };
  };
}

type Outcome =
  | { kind: 'ignored'; reason: string }
  | { kind: 'captured'; tenantId: string; paymentId: string; invoiceId: string | null; projectId: string | null; milestoneId: string | null };

async function settleLinkPayment(linkId: string, rpPaymentId: string, amountPaise: number): Promise<Outcome> {
  // Already recorded under this Razorpay payment id → nothing to do.
  const [dup] = await db.select({ id: payments.id }).from(payments)
    .where(eq(payments.razorpayPaymentId, rpPaymentId)).limit(1);
  if (dup) return { kind: 'ignored', reason: 'duplicate' };

  return retryOnUniqueViolation(() => db.transaction(async (tx): Promise<Outcome> => {
    // Tenant comes from our own pending row for this link (row-locked against a concurrent delivery).
    const [row] = await tx.select({
      id: payments.id, tenantId: payments.tenantId, status: payments.status,
      razorpayPaymentId: payments.razorpayPaymentId, invoiceId: payments.invoiceId, projectId: payments.projectId,
    }).from(payments)
      .where(and(eq(payments.razorpayLinkId, linkId), eq(payments.status, 'pending')))
      .limit(1).for('update');
    if (!row) return { kind: 'ignored', reason: 'no pending payment for link' };
    if (row.razorpayPaymentId) return { kind: 'ignored', reason: 'already settled' };

    const tenantId = row.tenantId;
    let projectId = row.projectId;
    let customerId: string | null = null;
    if (row.invoiceId && !projectId) {
      const [inv] = await tx.select({ projectId: invoices.projectId }).from(invoices)
        .where(and(eq(invoices.id, row.invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
      projectId = inv?.projectId ?? null;
    }
    if (projectId) {
      const [p] = await tx.select({ customerId: projects.customerId }).from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
      customerId = p?.customerId ?? null;
    }

    const receiptNumber = await nextReceiptNumber(tx, tenantId);
    await tx.update(payments).set({
      status: 'captured', razorpayPaymentId: rpPaymentId, amountPaise,
      reconciledAt: sql`now()`, receivedAt: sql`now()`, mode: 'razorpay', receiptNumber,
      projectId, customerId: sql`coalesce(${payments.customerId}, ${customerId})`,
    }).where(and(eq(payments.id, row.id), eq(payments.tenantId, tenantId)));

    const [ms] = await tx.select({ id: milestones.id }).from(milestones)
      .where(and(eq(milestones.tenantId, tenantId), eq(milestones.razorpayLinkId, linkId))).limit(1);

    // Allocation drives milestone state: it is marked paid only once allocations cover it incl. GST.
    if (projectId) {
      await allocatePayment(tx, tenantId, row.id, projectId, amountPaise,
        ms ? [{ milestoneId: ms.id, amountPaise }] : undefined);
    }
    if (row.invoiceId) await syncInvoiceStatus(tx, tenantId, row.invoiceId);

    return { kind: 'captured', tenantId, paymentId: row.id, invoiceId: row.invoiceId, projectId, milestoneId: ms?.id ?? null };
  }));
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(webhookLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  const { webhookSecret } = await getRazorpayConfig();
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  const signatureValid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: RazorpayEvent;
  try { event = JSON.parse(body) as RazorpayEvent; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const payment = event.payload?.payment?.entity;
  let linkId: string | undefined;
  if (event.event === 'payment_link.paid') linkId = event.payload?.payment_link?.entity?.id;
  else if (event.event === 'payment.captured') linkId = payment?.payment_link_id;

  if (!linkId || !payment?.id || typeof payment.amount !== 'number') {
    // Not a payment-link settlement we track (other events, or a capture with no link id).
    return NextResponse.json({ received: true });
  }

  try {
    const outcome = await settleLinkPayment(linkId, payment.id, payment.amount);
    if (outcome.kind === 'ignored') {
      if (outcome.reason === 'no pending payment for link') {
        console.error('[Razorpay webhook] No pending payment row for link:', linkId);
      }
      return NextResponse.json({ received: true });
    }

    if (outcome.milestoneId && outcome.projectId) {
      // The money is already recorded; a failed enqueue must not make Razorpay
      // retry (the retry would be a no-op duplicate), so log it instead.
      await enqueue('milestone/payment.captured', {
        milestoneId: outcome.milestoneId,
        projectId: outcome.projectId,
        tenantId: outcome.tenantId,
        paymentId: outcome.paymentId,
        invoiceId: outcome.invoiceId,
        razorpayPaymentId: payment.id,
        razorpayLinkId: linkId,
        amountPaise: payment.amount,
      }).catch((err: unknown) => console.error('[Razorpay webhook] enqueue failed:', err));
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Razorpay webhook] Error settling link payment:', err);
    // 5xx so Razorpay retries; processing is idempotent on razorpay_payment_id.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
