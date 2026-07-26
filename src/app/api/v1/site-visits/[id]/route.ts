import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const PatchSiteVisitSchema = z
  .object({
    scheduledAt: z.string().datetime(),
    address: z.string().min(1),
    designerId: z.string().uuid().nullable(),
    notes: z.string(),
  })
  .partial();

// ─── GET /api/v1/site-visits/[id] ────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid site visit id' }, { status: 400 });
  }

  try {
    const [visit] = await db
      .select()
      .from(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!visit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    }

    return NextResponse.json({ data: visit });
  } catch (e) {
    console.error('[GET /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/v1/site-visits/[id] ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid site visit id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSiteVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  const { scheduledAt, address, designerId, notes } = parsed.data;

  // Build update payload — only include fields that were provided
  const updates: Partial<typeof siteVisits.$inferInsert> = {};
  if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt);
  // address is stored inside locationJson jsonb
  if (address !== undefined) updates.locationJson = { address };
  if (designerId !== undefined) updates.designerId = designerId;
  if (notes !== undefined) updates.notes = notes;

  try {
    const [updated] = await db
      .update(siteVisits)
      .set(updates)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated, message: 'Site visit updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
