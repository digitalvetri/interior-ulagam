import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vendorCategories, vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { VendorCategoryNameSchema } from '@/lib/vendor-categories';
import { findVendorCategory, isUniqueViolation } from '@/lib/vendor-categories-server';

const RenameSchema = z.object({ name: VendorCategoryNameSchema }).strict();
const IdSchema = z.string().uuid();

// Renaming or deleting rewrites every vendor in that category, so — like
// editing or removing a vendor — it is owner-only. Adding stays PROCUREMENT.

// ─── PATCH /api/v1/vendor-categories/:id — rename ────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = RenameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 422 });
  }
  const { name } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: vendorCategories.id, name: vendorCategories.name })
        .from(vendorCategories)
        .where(and(eq(vendorCategories.id, id), eq(vendorCategories.tenantId, ctx.tenantId)))
        .for('update');
      if (!current) return { kind: 'not_found' as const };

      // A case-only rename ("hardware" → "Hardware") must not clash with itself.
      const [clash] = await tx
        .select({ name: vendorCategories.name })
        .from(vendorCategories)
        .where(and(
          eq(vendorCategories.tenantId, ctx.tenantId),
          ne(vendorCategories.id, id),
          sql`lower(${vendorCategories.name}) = lower(${name})`,
        ))
        .limit(1);
      if (clash) return { kind: 'conflict' as const, name: clash.name };

      const [row] = await tx
        .update(vendorCategories)
        .set({ name })
        .where(and(eq(vendorCategories.id, id), eq(vendorCategories.tenantId, ctx.tenantId)))
        .returning({ id: vendorCategories.id, name: vendorCategories.name, sortOrder: vendorCategories.sortOrder });

      const moved = await tx
        .update(vendors)
        .set({ category: name })
        .where(and(
          eq(vendors.tenantId, ctx.tenantId),
          sql`lower(${vendors.category}) = lower(${current.name})`,
        ))
        .returning({ id: vendors.id });

      return { kind: 'ok' as const, row, vendorsUpdated: moved.length };
    });

    if (result.kind === 'not_found') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: `A category named "${result.name}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({
      data: { ...result.row, vendorCount: result.vendorsUpdated },
      vendorsUpdated: result.vendorsUpdated,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `A category named "${name}" already exists.` }, { status: 409 });
    }
    console.error('[vendor-categories/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/vendor-categories/:id[?reassignTo=<name>] ────────────────
// Vendors in the deleted category move to `reassignTo`, or are left uncategorised.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  const reassignRaw = request.nextUrl.searchParams.get('reassignTo')?.trim() || null;

  try {
    const [current] = await db
      .select({ id: vendorCategories.id, name: vendorCategories.name })
      .from(vendorCategories)
      .where(and(eq(vendorCategories.id, id), eq(vendorCategories.tenantId, ctx.tenantId)));
    if (!current) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    let target: { id: string; name: string } | null = null;
    if (reassignRaw) {
      target = await findVendorCategory(ctx.tenantId, reassignRaw);
      if (!target) {
        return NextResponse.json({ error: `There is no category named "${reassignRaw}" to move vendors to.` }, { status: 400 });
      }
      if (target.id === current.id) {
        return NextResponse.json({ error: 'Choose a different category to move these vendors to.' }, { status: 400 });
      }
    }

    const affected = await db.transaction(async (tx) => {
      const updated = await tx
        .update(vendors)
        .set({ category: target ? target.name : null })
        .where(and(
          eq(vendors.tenantId, ctx.tenantId),
          sql`lower(${vendors.category}) = lower(${current.name})`,
        ))
        .returning({ id: vendors.id });
      await tx
        .delete(vendorCategories)
        .where(and(eq(vendorCategories.id, current.id), eq(vendorCategories.tenantId, ctx.tenantId)));
      return updated.length;
    });

    return NextResponse.json({
      data: {
        id: current.id,
        name: current.name,
        moved: target ? affected : 0,
        cleared: target ? 0 : affected,
        reassignedTo: target?.name ?? null,
      },
    });
  } catch (err) {
    console.error('[vendor-categories/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
