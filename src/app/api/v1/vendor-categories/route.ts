import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vendorCategories, vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { VendorCategoryNameSchema } from '@/lib/vendor-categories';
import { findVendorCategory, isUniqueViolation } from '@/lib/vendor-categories-server';

const CreateSchema = z.object({ name: VendorCategoryNameSchema });

// ─── GET /api/v1/vendor-categories ───────────────────────────────────────────
// The studio's categories with how many vendors use each.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  try {
    const rows = await db
      .select({
        id: vendorCategories.id,
        name: vendorCategories.name,
        sortOrder: vendorCategories.sortOrder,
        vendorCount: sql<number>`count(${vendors.id})::int`,
      })
      .from(vendorCategories)
      .leftJoin(vendors, and(
        eq(vendors.tenantId, vendorCategories.tenantId),
        sql`lower(${vendors.category}) = lower(${vendorCategories.name})`,
      ))
      .where(eq(vendorCategories.tenantId, ctx.tenantId))
      .groupBy(vendorCategories.id)
      .orderBy(asc(vendorCategories.sortOrder), asc(sql`lower(${vendorCategories.name})`));

    // Rename/delete are owner-only (like editing or removing a vendor).
    return NextResponse.json({ data: rows, canManage: ctx.role === 'owner' });
  } catch (err) {
    console.error('[vendor-categories GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/vendor-categories ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 422 });
  }
  const { name } = parsed.data;

  try {
    const existing = await findVendorCategory(ctx.tenantId, name);
    if (existing) {
      return NextResponse.json({ error: `A category named "${existing.name}" already exists.` }, { status: 409 });
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${vendorCategories.sortOrder}), -1)::int` })
      .from(vendorCategories)
      .where(eq(vendorCategories.tenantId, ctx.tenantId));

    const [row] = await db
      .insert(vendorCategories)
      .values({ tenantId: ctx.tenantId, name, sortOrder: maxOrder + 1 })
      .returning({ id: vendorCategories.id, name: vendorCategories.name, sortOrder: vendorCategories.sortOrder });

    return NextResponse.json({ data: { ...row, vendorCount: 0 } }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `A category named "${name}" already exists.` }, { status: 409 });
    }
    console.error('[vendor-categories POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
