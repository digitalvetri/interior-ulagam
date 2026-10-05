import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quotes, quoteLines } from '@/lib/db/schema';

/**
 * A database handle: the pool, or a transaction taken from it.
 *
 * Drizzle's transaction object exposes the same query builder as `db` but is a
 * distinct type, so the callback parameter type is derived from
 * `db.transaction` rather than restated — it cannot drift from the real one.
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbHandle = typeof db | Transaction;

/**
 * Recalculate and persist quote totals after any line or header change.
 *
 * Formula (discount-aware):
 *   subtotalPaise  = SUM(clientRatePaise * qty) over all lines
 *   marginPaise    = SUM(line.marginPaise) over all lines
 *   gstPaise       = ROUND((subtotalPaise - discountPaise) * gstPct / 100)
 *   totalPaise     = subtotalPaise - discountPaise + gstPaise
 *
 * Pass the transaction handle when called alongside a line change, so the
 * recalculation commits or rolls back with the change that prompted it —
 * otherwise a failure in between leaves the quote's totals disagreeing with
 * its lines, on the document a client is sent.
 */
export async function recalculateQuoteTotals(
  quoteId: string,
  tx: DbHandle = db,
): Promise<void> {
  // Fetch the quote's discount and GST rate
  const [quote] = await tx
    .select({
      discountPaise: quotes.discountPaise,
      gstPct: quotes.gstPct,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));

  if (!quote) return;

  // Aggregate line totals
  const allLines = await tx
    .select({
      clientRatePaise: quoteLines.clientRatePaise,
      qty: quoteLines.qty,
      marginPaise: quoteLines.marginPaise,
    })
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId));

  const subtotalPaise = allLines.reduce(
    (acc, l) => acc + l.clientRatePaise * l.qty,
    0,
  );
  const quoteMarginPaise = allLines.reduce(
    (acc, l) => acc + l.marginPaise,
    0,
  );

  const discountPaise = quote.discountPaise ?? 0;
  const gstPct = quote.gstPct ?? 18;
  const gstPaise = Math.round((subtotalPaise - discountPaise) * gstPct / 100);
  const totalPaise = subtotalPaise - discountPaise + gstPaise;

  await tx
    .update(quotes)
    // Any change that moves the totals also makes the stored PDF stale.
    .set({ subtotalPaise, gstPaise, totalPaise, marginPaise: quoteMarginPaise, pdfUrl: null })
    .where(eq(quotes.id, quoteId));
}

/**
 * Drop the stored PDF after an edit that does not go through
 * recalculateQuoteTotals (sections, validity, payment terms, number, terms) so
 * the next download regenerates it instead of sending an out-of-date document.
 */
export async function invalidateQuotePdf(quoteId: string, tenantId: string, tx: DbHandle = db): Promise<void> {
  await tx.update(quotes).set({ pdfUrl: null })
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
}
