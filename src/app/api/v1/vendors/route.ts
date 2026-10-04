import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, asc, count, inArray, sql } from 'drizzle-orm';
import { purchaseOrders } from '@/lib/db/schema';
import { listRange, takePage } from '@/lib/pagination';
import { VENDOR_CATEGORY_MAX } from '@/lib/vendor-categories';
import { findVendorCategory } from '@/lib/vendor-categories-server';

function firstZodMessage(err: z.ZodError): string | null {
  const first = err.issues[0];
  if (!first) return null;
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}

const CreateVendorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  gstin: z.string().optional(),
  // Must name one of the studio's vendor categories (matched case-insensitively).
  category: z.string().trim().max(VENDOR_CATEGORY_MAX).nullable().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const range = listRange(request);
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const conditions = [eq(vendors.tenantId, ctx.tenantId)];

    if (category?.trim()) {
      conditions.push(sql`lower(${vendors.category}) = lower(${category.trim()})`);
    }

    const rows = await db
      .select()
      .from(vendors)
      .where(and(...conditions))
      .orderBy(asc(vendors.name))
        .limit(range.limit + 1)
        .offset(range.offset);

    const { page, hasMore } = takePage(rows, range);

    // Enrich with open PO counts
    const vendorIds = page.map((v) => v.id);
    const openPOCountByVendor = new Map<string, number>();
    if (vendorIds.length > 0) {
      const openStatuses = ['draft', 'sent', 'acknowledged', 'partial'] as const;
      const poCounts = await db
        .select({ vendorId: purchaseOrders.vendorId, cnt: count() })
        .from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.tenantId, ctx.tenantId),
          inArray(purchaseOrders.vendorId, vendorIds),
          inArray(purchaseOrders.status, openStatuses),
        ))
        .groupBy(purchaseOrders.vendorId);
      for (const pc of poCounts) {
        if (pc.vendorId) openPOCountByVendor.set(pc.vendorId, Number(pc.cnt));
      }
    }

    const enriched = page.map((v) => ({ ...v, openPOCount: openPOCountByVendor.get(v.id) ?? 0 }));

    return NextResponse.json({ data: enriched, hasMore, limit: range.limit, offset: range.offset });
  } catch (err) {
    console.error('[vendors GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) ?? 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;

  try {
    let category: string | null = null;
    if (input.category) {
      const found = await findVendorCategory(ctx.tenantId, input.category);
      if (!found) {
        return NextResponse.json({ error: `Unknown category "${input.category}". Add it first.` }, { status: 422 });
      }
      category = found.name;
    }

    const [vendor] = await db
      .insert(vendors)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        gstin: input.gstin ?? null,
        category,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    return NextResponse.json({ data: vendor }, { status: 201 });
  } catch (err) {
    console.error('[vendors POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
