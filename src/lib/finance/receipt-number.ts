import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { and, eq, like } from 'drizzle-orm';
import { istYearMonth } from '@/lib/dates/ist';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** RCT-YYMM- prefix for the IST month of `d`. */
export function receiptPrefix(d: Date = new Date()): string {
  const { year, month } = istYearMonth(d);
  return `RCT-${String(year).slice(2)}${String(month).padStart(2, '0')}-`;
}

/**
 * Next number after the highest existing one with this prefix.
 * Ignores numbers that don't follow the pattern (hand-typed or legacy).
 */
export function nextInSequence(prefix: string, existing: readonly (string | null)[], width = 4): string {
  let max = 0;
  for (const n of existing) {
    if (!n || !n.startsWith(prefix)) continue;
    const tail = n.slice(prefix.length);
    if (!/^\d+$/.test(tail)) continue;
    max = Math.max(max, Number(tail));
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}

/**
 * Next receipt number for a tenant: RCT-YYMM-NNNN, one more than the highest
 * this IST month. Call inside the transaction that inserts the payment, and wrap
 * that transaction in `retryOnUniqueViolation` — two writers can still pick the
 * same number, and the (tenant_id, receipt_number) index rejects the second.
 */
export async function nextReceiptNumber(tx: Tx | typeof db, tenantId: string): Promise<string> {
  const prefix = receiptPrefix();
  const rows = await tx.select({ n: payments.receiptNumber }).from(payments)
    .where(and(eq(payments.tenantId, tenantId), like(payments.receiptNumber, `${prefix}%`)));
  return nextInSequence(prefix, rows.map(r => r.n));
}

/** Postgres unique_violation (23505), unwrapped from Drizzle's error wrapper. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505') return true;
    e = typeof e === 'object' && e !== null && 'cause' in e ? (e as { cause: unknown }).cause : undefined;
  }
  return false;
}

/** Re-run `fn` (a whole transaction) when it loses a numbering race. */
export async function retryOnUniqueViolation<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isUniqueViolation(err)) throw err;
    }
  }
}
