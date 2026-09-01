import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const CompleteSiteVisitSchema = z.object({
  notes: z.string().optional(),
});

// ─── POST /api/v1/site-visits/[id]/complete ──────────────────────────────────

export async function POST(
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
    // Body is optional for this endpoint — default to empty object
    body = {};
  }

  const parsed = CompleteSiteVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Fetch the visit first so we can get leadId and guard against not-found
    const [visit] = await db
      .select()
      .from(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!visit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    }

    // Guard: already completed
    if (visit.completedAt !== null) {
      return NextResponse.json(
        { error: 'Site visit is already marked as completed' },
        { status: 409 },
      );
    }

    const updateValues: Partial<typeof siteVisits.$inferInsert> = {
      completedAt: new Date(),
    };
    if (parsed.data.notes !== undefined) {
      updateValues.notes = parsed.data.notes;
    }

    const [updated] = await db
      .update(siteVisits)
      .set(updateValues)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .returning();

    // Advance lead stage to measurement (next stage after site visit)
    await db
      .update(leads)
      .set({ stage: 'measurement', lastActivityAt: new Date() })
      .where(and(eq(leads.id, visit.leadId), eq(leads.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: updated, message: 'Site visit marked as completed' });
  } catch (e) {
    console.error('[POST /api/v1/site-visits/[id]/complete]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
