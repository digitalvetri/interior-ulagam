/** Status written by the Razorpay webhook on successful capture. */
export const PAYMENT_SETTLED = 'captured' as const;

/** Fallback invoice due days when no tenant setting exists. */
export const DEFAULT_INVOICE_DUE_DAYS = 7;
