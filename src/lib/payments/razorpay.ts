import Razorpay from 'razorpay';
import type { PaymentsProvider } from './index';

function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export const razorpayProvider: PaymentsProvider = {
  async createLink({ amountPaise, description, customerName, customerPhone, customerEmail, referenceId }) {
    const razorpay = getRazorpay();
    const link = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      description,
      customer: {
        name: customerName,
        contact: customerPhone,
        email: customerEmail ?? '',
      },
      notify: { sms: true, email: !!customerEmail },
      reference_id: referenceId,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/razorpay`,
      callback_method: 'get',
    });

    return {
      id: link.id,
      shortUrl: link.short_url,
      amount: amountPaise,
    };
  },
};
