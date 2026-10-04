import Razorpay from 'razorpay';
import type { PaymentsProvider } from './index';
import { getRazorpayConfig } from '@/lib/integrations/resolve';

async function getRazorpay(): Promise<Razorpay> {
  // Saved in Settings → Integrations, or the server environment.
  const { keyId, keySecret } = await getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not connected — the owner can set it up in Settings → Integrations.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export const razorpayProvider: PaymentsProvider = {
  async createLink({ amountPaise, description, customerName, customerPhone, customerEmail, referenceId }) {
    const razorpay = await getRazorpay();
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
