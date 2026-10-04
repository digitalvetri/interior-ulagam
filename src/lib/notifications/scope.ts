import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { notifications } from '@/lib/db/schema';
import type { TenantContext } from '@/lib/auth';

/**
 * Whose notifications the caller may see and act on: their own, plus — for
 * owners — studio-level ones with no recipient. Previously every query was
 * scoped only by tenant, so all staff saw (and cleared) everyone's alerts.
 */
export function visibleTo(ctx: TenantContext): SQL {
  const mine = eq(notifications.userId, ctx.userId);
  const scope = ctx.role === 'owner' ? or(mine, isNull(notifications.userId))! : mine;
  return and(eq(notifications.tenantId, ctx.tenantId), scope)!;
}
