import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

// Real enum values from schema.ts materialCategoryEnum
const MATERIAL_CATEGORIES = [
  'laminate',
  'hardware',
  'furniture',
  'fabric',
  'lighting',
  'flooring',
  'sanitary',
  'other',
] as const;

const CreateMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.enum(MATERIAL_CATEGORIES),
  currentRatePaise: z.number().int().nonnegative().optional(),
  sellingRatePaise: z.number().int().nonnegative().optional(),
  lastPurchasePricePaise: z.number().int().nonnegative().optional(),
  vendorId: z.string().uuid().optional(),
  brand: z.string().optional(),
  hsnSac: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const conditions = [eq(materials.tenantId, ctx.tenantId)];

    if (category) {
      const categoryParsed = z.enum(MATERIAL_CATEGORIES).safeParse(category);
      if (!categoryParsed.success) {
        return NextResponse.json({ error: 'Invalid category filter' }, { status: 400 });
      }
      conditions.push(eq(materials.category, categoryParsed.data));
    }

    const rows = await db
      .select()
      .from(materials)
      .where(and(...conditions))
      .orderBy(desc(materials.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[materials GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required to add materials' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateMaterialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    const [material] = await db
      .insert(materials)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        unit: input.unit,
        category: input.category,
        currentRatePaise: input.currentRatePaise ?? 0,
        sellingRatePaise: input.sellingRatePaise ?? 0,
        lastPurchasePricePaise: input.lastPurchasePricePaise ?? null,
        vendorId: input.vendorId ?? null,
        brand: input.brand ?? null,
        hsnSac: input.hsnSac ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    return NextResponse.json({ data: material, message: 'Material created' }, { status: 201 });
  } catch (err) {
    console.error('[materials POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
