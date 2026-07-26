import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { payments, milestones } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

interface RazorpayPaymentEntity {
  id: string;
  payment_link_id: string;
  amount: number;
}

interface RazorpayEvent {
  event: string;
  payload: {
    payment: {
      entity: RazorpayPaymentEntity;
    };
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body) as RazorpayEvent;

  if (event.event === 'payment.captured') {
    const rpPaymentId = event.payload.payment.entity.id;
    const rpLinkId = event.payload.payment.entity.payment_link_id;
    const amountPaise = event.payload.payment.entity.amount;

    try {
      // Idempotency: find payment row by razorpayLinkId
      const [existingPayment] = await db
        .select({
          id: payments.id,
          status: payments.status,
          razorpayPaymentId: payments.razorpayPaymentId,
          invoiceId: payments.invoiceId,
        })
        .from(payments)
        .where(eq(payments.razorpayLinkId, rpLinkId));

      if (!existingPayment) {
        // No matching payment row — log and move on
        console.error('[Razorpay webhook] No payment row found for link:', rpLinkId);
        return NextResponse.json({ received: true });
      }

      // Idempotency: skip if already captured
      if (existingPayment.razorpayPaymentId || existingPayment.status === 'captured') {
        return NextResponse.json({ received: true });
      }

      // Update payment row: status='captured', razorpayPaymentId, reconciledAt
      await db
        .update(payments)
        .set({
          status: 'captured',
          razorpayPaymentId: rpPaymentId,
          reconciledAt: sql`now()`,
        })
        .where(eq(payments.id, existingPayment.id));

      // Find and update milestone: paymentStatus='paid', paidAt
      const [updatedMilestone] = await db
        .update(milestones)
        .set({
          paymentStatus: 'paid',
          paidAt: sql`now()`,
        })
        .where(eq(milestones.razorpayLinkId, rpLinkId))
        .returning();

      // Fire inngest event
      await inngest.send({
        name: 'milestone/payment.captured',
        data: {
          milestoneId: updatedMilestone?.id ?? null,
          paymentId: existingPayment.id,
          invoiceId: existingPayment.invoiceId,
          razorpayPaymentId: rpPaymentId,
          razorpayLinkId: rpLinkId,
          amountPaise,
        },
      });
    } catch (err) {
      console.error('[Razorpay webhook] Error processing payment.captured:', err);
      // Return 200 to prevent Razorpay retrying on non-signature errors
      return NextResponse.json({ received: true });
    }
  }

  return NextResponse.json({ received: true });
}
