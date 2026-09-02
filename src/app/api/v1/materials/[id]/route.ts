import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

interface PriceHistoryEntry {
  rate: number;
  changedAt: string;
}

const UpdateMaterialSchema = z
  .object({
    currentRatePaise: z.number().int().nonnegative().optional(),
    sellingRatePaise: z.number().int().nonnegative().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).optional(),
    brand: z.string().optional(),
    unit: z.string().min(1).optional(),
    hsnSac: z.string().optional(),
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
    const [material] = await db
      .select()
      .from(materials)
      .where(and(eq(materials.id, id), eq(materials.tenantId, ctx.tenantId)));

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    return NextResponse.json({ data: material });
  } catch (err) {
    console.error('[materials/:id GET]', err);
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

  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required to edit materials' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select()
      .from(materials)
      .where(and(eq(materials.id, id), eq(materials.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Build the update payload
    const updateValues: Partial<typeof materials.$inferInsert> = {};

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.brand !== undefined) updateValues.brand = input.brand;
    if (input.unit !== undefined) updateValues.unit = input.unit;
    if (input.hsnSac !== undefined) updateValues.hsnSac = input.hsnSac;
    if (input.notes !== undefined) updateValues.notes = input.notes;
    if (input.sellingRatePaise !== undefined) updateValues.sellingRatePaise = input.sellingRatePaise;
    if (input.vendorId !== undefined) updateValues.vendorId = input.vendorId;

    // Handle rate change: record price history and shift current → last
    if (
      input.currentRatePaise !== undefined &&
      input.currentRatePaise !== existing.currentRatePaise
    ) {
      const existingHistory = (existing.priceHistoryJson as PriceHistoryEntry[]) ?? [];
      const newHistoryEntry: PriceHistoryEntry = {
        rate: existing.currentRatePaise,
        changedAt: new Date().toISOString(),
      };
      const updatedHistory: PriceHistoryEntry[] = [...existingHistory, newHistoryEntry];

      updateValues.currentRatePaise = input.currentRatePaise;
      updateValues.lastPurchasePricePaise = existing.currentRatePaise;
      updateValues.priceHistoryJson = updatedHistory;
    }

    const [updated] = await db
      .update(materials)
      .set(updateValues)
      .where(and(eq(materials.id, id), eq(materials.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated, message: 'Material updated' });
  } catch (err) {
    console.error('[materials/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
