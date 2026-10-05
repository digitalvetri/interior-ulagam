import type { Metadata } from 'next';

// Public page Razorpay sends the client to after a payment link is paid.
// It only says thanks — the signed webhook is what records the payment.

export const metadata: Metadata = { title: 'Payment received · Konst Design' };

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.razorpay_payment_link_status === 'string' ? sp.razorpay_payment_link_status : null;
  const paid = status === null || status === 'paid';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center">
        <h1 className="text-xl font-bold text-[var(--text-heading)]">
          {paid ? 'Thank you — payment received' : 'Payment not completed'}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {paid
            ? 'Konst Design will send your receipt on WhatsApp shortly. You can close this page.'
            : 'Your payment did not go through. You can try again from the same link, or contact Konst Design.'}
        </p>
      </div>
    </main>
  );
}
