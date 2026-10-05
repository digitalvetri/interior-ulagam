import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { and, eq, like } from 'drizzle-orm';
import { istYearMonth } from '@/lib/dates/ist';
import { nextInSequence } from './receipt-number';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Next invoice number for a tenant: INV-YYYY-NNNN, one more than the highest
 * this IST year. Call inside the inserting transaction and wrap it in
 * `retryOnUniqueViolation` (unique index on tenant_id + invoice_number).
 */
export async function nextInvoiceNumber(tx: Tx | typeof db, tenantId: string): Promise<string> {
  const prefix = `INV-${istYearMonth().year}-`;
  const rows = await tx.select({ n: invoices.invoiceNumber }).from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), like(invoices.invoiceNumber, `${prefix}%`)));
  return nextInSequence(prefix, rows.map(r => r.n));
}
