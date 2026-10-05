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
  /**
   * Cancel a link that has not been paid. Already paid/expired/cancelled links are
   * left alone. Resolves to the link's status afterwards ('cancelled', 'paid', 'expired', …).
   */
  cancelLink(linkId: string): Promise<string>;
}

export { razorpayProvider } from './razorpay';
