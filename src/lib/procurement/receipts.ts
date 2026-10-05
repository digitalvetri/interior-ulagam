/**
 * Pure helpers for purchase-order receipts (GRNs) and document numbering.
 * Quantities may be fractional (e.g. 12.5 sqft), so all comparisons are done
 * on values rounded to 3 decimal places — the precision of grns.delivered_qty.
 */

export type ReceiptStatus = 'partial' | 'complete' | null;

/** Rounds a quantity to 3 decimal places (numeric(12,3)). */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Quantity still pending on a line, never negative. */
export function pendingQty(orderedQty: number, receivedQty: number): number {
  return Math.max(0, roundQty(orderedQty - receivedQty));
}

/**
 * The PO status implied by what has been received: 'complete' when every line
 * is fully received, 'partial' when something was received, else null (no change).
 */
export function receiptStatus(
  lines: ReadonlyArray<{ id: string; qty: number }>,
  receivedPerLine: Readonly<Record<string, number>>,
): ReceiptStatus {
  if (lines.length === 0) return null;
  const allComplete = lines.every((l) => roundQty(receivedPerLine[l.id] ?? 0) >= roundQty(l.qty));
  if (allComplete) return 'complete';
  const anyReceived = lines.some((l) => roundQty(receivedPerLine[l.id] ?? 0) > 0);
  return anyReceived ? 'partial' : null;
}

/**
 * Next document number of the form `${prefix}-${year}-NNN`, one past the
 * highest sequence already used for that prefix and year. Using the max (not a
 * row count) keeps numbers unique after deletions.
 */
export function nextDocNumber(prefix: string, year: number, existing: ReadonlyArray<string | null>): string {
  const head = `${prefix}-${year}-`;
  let max = 0;
  for (const n of existing) {
    if (!n || !n.startsWith(head)) continue;
    const seq = Number(n.slice(head.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return `${head}${String(max + 1).padStart(3, '0')}`;
}

/** True when a Postgres error (possibly wrapped by the driver/Drizzle) has the given SQLSTATE. */
export function hasPgCode(err: unknown, code: string): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === 'object'; i++) {
    if ((e as { code?: unknown }).code === code) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
