import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const LeadStageEnum = z.enum([
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
]);

const StageTransitionSchema = z
  .object({
    stage: LeadStageEnum,
    lostReason: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      // lostReason is required when moving to 'lost'
      if (data.stage === 'lost' && !data.lostReason) return false;
      return true;
    },
    { message: 'lostReason is required when stage is "lost"', path: ['lostReason'] },
  );

// ─── PATCH /api/v1/leads/[id]/stage ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = StageTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { stage, lostReason } = parsed.data;

  try {
    const [updated] = await db
      .update(leads)
      .set({
        stage,
        lostReason: stage === 'lost' ? (lostReason ?? null) : null,
        lastActivityAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated, message: `Lead moved to ${stage}` });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]/stage]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
