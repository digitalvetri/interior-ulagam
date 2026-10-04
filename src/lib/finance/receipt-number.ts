import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { istMonthRange, istYearMonth } from '@/lib/dates/ist';

/**
 * Generate the next receipt number for a tenant in the format RCT-YYMM-NNNN.
 * Count-based within the calendar month, matching the expenseNumber pattern.
 * Must be called inside the same transaction as the INSERT to avoid races.
 */
export async function nextReceiptNumber(tenantId: string): Promise<string> {
  // IST calendar month (server runs in UTC).
  const { year, month } = istYearMonth();
  const yy = String(year).slice(2);
  const mm = String(month).padStart(2, '0');
  const monthStart = istMonthRange(year, month).start.toISOString();

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(
      eq(payments.tenantId, tenantId),
      sql`created_at >= ${monthStart}`,
      sql`receipt_number is not null`,
    ));

  const seq = String(Number(cnt) + 1).padStart(4, '0');
  return `RCT-${yy}${mm}-${seq}`;
}
