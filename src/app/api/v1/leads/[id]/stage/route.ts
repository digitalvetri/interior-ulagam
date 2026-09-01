import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth';
import { applyStageTransition } from '@/lib/leads/transitions';

const LeadStageEnum = z.enum([
  'new', 'contacted', 'qualified', 'site_visit', 'measurement',
  'quotation', 'negotiation', 'won', 'lost',
  // legacy values accepted for backward compat
  'site_visit_scheduled', 'consultation_done', 'proposal_sent',
]);

const StageTransitionSchema = z
  .object({
    stage: LeadStageEnum,
    lostReason: z.string().min(1).optional(),
  })
  .refine(
    (data) => !(data.stage === 'lost' && !data.lostReason),
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
  if (!z.string().uuid().safeParse(id).success) {
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
    const updated = await applyStageTransition(
      id,
      ctx.tenantId,
      ctx.dbUserId ?? null,
      stage,
      lostReason,
    );

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated, message: `Lead moved to ${stage}` });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]/stage]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
