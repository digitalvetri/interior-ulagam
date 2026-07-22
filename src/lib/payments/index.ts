export interface PaymentLink {
  id: string;
  shortUrl: string;
  amount: number; // in paise
}

export interface PaymentsProvider {
  createLink(opts: {
    amountPaise: number;
    description: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    referenceId: string;
  }): Promise<PaymentLink>;
}

export { razorpayProvider } from './razorpay';
