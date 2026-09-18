import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * Generate the next receipt number for a tenant in the format RCT-YYMM-NNNN.
 * Count-based within the calendar month, matching the expenseNumber pattern.
 * Must be called inside the same transaction as the INSERT to avoid races.
 */
export async function nextReceiptNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
