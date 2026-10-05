// Pure stage-gate decisions. No database access — stage-gates.ts loads the
// data and asks these. All amounts are integer paise.

/** Procurement needs the 2nd milestone (by sort order, then creation) fully paid. */
export function secondMilestonePaid(
  ms: readonly { sortOrder: number; createdAt: Date | string; paymentStatus: string }[],
): boolean {
  const ordered = [...ms].sort((a, b) =>
    a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (ordered.length === 0) return false;
  // A project with a single milestone has no "milestone 2" — require that one.
  const target = ordered.length >= 2 ? ordered[1] : ordered[0];
  return target.paymentStatus === 'paid';
}

/**
 * Design is approved when no deliverable is still unapproved. A project with no
 * deliverables at all is not blocked (projects brought in mid-way have none).
 */
export function designApproved(statuses: readonly string[]): { ok: boolean; pending: number; total: number } {
  const pending = statuses.filter(s => s !== 'approved').length;
  return { ok: pending === 0, pending, total: statuses.length };
}

/**
 * What is still owed on a project at completion: the revised contract incl. GST
 * (from the money engine) less money received, less discounts / write-offs,
 * plus refunds paid back out.
 */
export function completionOutstanding(input: {
  totalWithGstPaise: number;
  receivedPaise: number;
  adjustments: readonly { kind: 'discount' | 'refund' | 'write_off'; amountPaise: number }[];
}): number {
  let credited = input.receivedPaise;
  for (const a of input.adjustments) credited += a.kind === 'refund' ? -a.amountPaise : a.amountPaise;
  return Math.max(0, input.totalWithGstPaise - credited);
}
