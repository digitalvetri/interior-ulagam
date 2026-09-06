import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quotes, quoteLines } from '@/lib/db/schema';

/**
 * Recalculate and persist quote totals after any line or header change.
 *
 * Formula (discount-aware):
 *   subtotalPaise  = SUM(clientRatePaise * qty) over all lines
 *   marginPaise    = SUM(line.marginPaise) over all lines
 *   gstPaise       = ROUND((subtotalPaise - discountPaise) * gstPct / 100)
 *   totalPaise     = subtotalPaise - discountPaise + gstPaise
 */
export async function recalculateQuoteTotals(quoteId: string): Promise<void> {
  // Fetch the quote's discount and GST rate
  const [quote] = await db
    .select({
      discountPaise: quotes.discountPaise,
      gstPct: quotes.gstPct,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));

  if (!quote) return;

  // Aggregate line totals
  const allLines = await db
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

  await db
    .update(quotes)
    .set({ subtotalPaise, gstPaise, totalPaise, marginPaise: quoteMarginPaise })
    .where(eq(quotes.id, quoteId));
}
