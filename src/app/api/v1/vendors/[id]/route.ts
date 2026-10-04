import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { VENDOR_CATEGORY_MAX } from '@/lib/vendor-categories';
import { findVendorCategory } from '@/lib/vendor-categories-server';

const UpdateVendorSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    gstin: z.string().optional(),
    // A studio vendor category name; null or '' clears it.
    category: z.string().trim().max(VENDOR_CATEGORY_MAX).nullable().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, ctx.tenantId)));

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({ data: vendor });
  } catch (err) {
    console.error('[vendors/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateVendorSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? (first.path.length ? `${first.path.join('.')}: ${first.message}` : first.message) : 'Validation error';
    return NextResponse.json({ error: msg, details: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { category: rawCategory, ...rest } = input;
  const values: typeof rest & { category?: string | null } = { ...rest };
  if (rawCategory !== undefined) values.category = rawCategory || null;

  try {
    if (values.category) {
      const found = await findVendorCategory(ctx.tenantId, values.category);
      if (!found) {
        return NextResponse.json({ error: `Unknown category "${values.category}". Add it first.` }, { status: 422 });
      }
      values.category = found.name;
    }

    const [updated] = await db
      .update(vendors)
      .set(values)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[vendors/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const { id } = await params;

  try {
    const [deleted] = await db
      .delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, ctx.tenantId)))
      .returning({ id: vendors.id });

    if (!deleted) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[vendors/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
