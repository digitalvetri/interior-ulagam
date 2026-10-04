import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vendorCategories } from '@/lib/db/schema';
import { DEFAULT_VENDOR_CATEGORIES, normalizeCategoryName } from '@/lib/vendor-categories';

// Server-only helpers for vendor categories. Auth and role checks stay in each
// route handler (the tenant-isolation and role-enforcement tests read them there).

/** Postgres unique_violation, unwrapped from Drizzle's error wrapper. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505') return true;
    e = typeof e === 'object' && e !== null && 'cause' in e ? (e as { cause: unknown }).cause : undefined;
  }
  return false;
}

/** Case-insensitive lookup of a tenant's category; returns the stored row or null. */
export async function findVendorCategory(
  tenantId: string,
  rawName: string,
): Promise<{ id: string; name: string } | null> {
  const name = normalizeCategoryName(rawName);
  if (!name) return null;
  const [row] = await db
    .select({ id: vendorCategories.id, name: vendorCategories.name })
    .from(vendorCategories)
    .where(and(
      eq(vendorCategories.tenantId, tenantId),
      sql`lower(${vendorCategories.name}) = lower(${name})`,
    ))
    .limit(1);
  return row ?? null;
}

/** Seeds the default list for a new studio. Safe to call twice. */
export async function seedDefaultVendorCategories(tenantId: string): Promise<void> {
  await db
    .insert(vendorCategories)
    .values(DEFAULT_VENDOR_CATEGORIES.map((name, i) => ({ tenantId, name, sortOrder: i })))
    .onConflictDoNothing();
}
