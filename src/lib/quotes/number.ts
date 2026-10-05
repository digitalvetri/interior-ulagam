/**
 * The one way a quote's document number is shown: the stored quote_number when
 * set, otherwise a stable label derived from the quote id. Used by the quote
 * page, the print preview, both PDF paths and the project documents list.
 */
export function quoteNumberOf(quote: { id: string; quoteNumber?: string | null }): string {
  const stored = quote.quoteNumber?.trim();
  if (stored) return stored;
  return `QUO-${quote.id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}
