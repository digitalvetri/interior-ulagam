import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requirements } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

// Mirrors the RoomEntry shape stored in requirements.roomsJson
interface RoomEntry {
  name: string;
  stylePreference?: string;
  budgetBandPaise?: number; // integer paise — NEVER float
  notes?: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const PatchRequirementSchema = z
  .object({
    styleTags: z.array(z.string()),
    budgetBand: z.string(),
    notes: z.string(),
    totalAreaSqft: z.number().int().nonnegative(),
    moodboardUrls: z.array(z.string().url()),
    // Replaces the entire roomsJson array
    rooms: z.array(
      z.object({
        name: z.string().min(1),
        stylePreference: z.string().optional(),
        budgetBandPaise: z.number().int().nonnegative().optional(),
        notes: z.string().optional(),
      }),
    ),
  })
  .partial();

// ─── PATCH /api/v1/requirements/[id] ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid requirements id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  const { styleTags, budgetBand, notes, totalAreaSqft, moodboardUrls, rooms } = parsed.data;

  const updates: Partial<typeof requirements.$inferInsert> = {};
  if (styleTags !== undefined) updates.styleTags = styleTags;
  if (budgetBand !== undefined) updates.budgetBand = budgetBand;
  if (notes !== undefined) updates.notes = notes;
  if (totalAreaSqft !== undefined) updates.totalAreaSqft = totalAreaSqft;
  if (moodboardUrls !== undefined) updates.moodboardUrls = moodboardUrls;
  if (rooms !== undefined) {
    const roomEntries: RoomEntry[] = rooms.map((r) => {
      const entry: RoomEntry = { name: r.name };
      if (r.stylePreference !== undefined) entry.stylePreference = r.stylePreference;
      if (r.budgetBandPaise !== undefined) entry.budgetBandPaise = r.budgetBandPaise;
      if (r.notes !== undefined) entry.notes = r.notes;
      return entry;
    });
    updates.roomsJson = roomEntries;
  }

  try {
    const [updated] = await db
      .update(requirements)
      .set(updates)
      .where(and(eq(requirements.id, id), eq(requirements.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Requirements not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated, message: 'Requirements updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/requirements/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/requirements/[id] ────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid requirements id' }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(requirements)
      .where(and(eq(requirements.id, id), eq(requirements.tenantId, ctx.tenantId)))
      .returning({ id: requirements.id });

    if (!deleted) {
      return NextResponse.json({ error: 'Requirements not found' }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id }, message: 'Requirements deleted' });
  } catch (e) {
    console.error('[DELETE /api/v1/requirements/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
