/**
 * Quote statuses that mean "the client has agreed to this quote".
 *
 * The accept/approve routes write 'accepted'; older rows may still carry
 * 'approved'. Every reader (BOQ, P&L, cost-to-complete, analytics, alerts,
 * project money) must treat both the same way.
 */
export const ACCEPTED_QUOTE_STATUSES = ['accepted', 'approved'] as const;

export function isAcceptedQuoteStatus(status: string | null | undefined): boolean {
  return status === 'accepted' || status === 'approved';
}

/** Statuses a quote may be revised (V+1) from. */
export const REVISABLE_QUOTE_STATUSES = ['sent', 'accepted', 'approved'] as const;
