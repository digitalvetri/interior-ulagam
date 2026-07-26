import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leadActivities, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const LeadActivityTypeEnum = z.enum([
  'call', 'whatsapp', 'note', 'site_visit', 'meeting', 'stage_change', 'follow_up',
]);
const FollowUpStatusEnum = z.enum([
  'pending', 'completed', 'overdue', 'rescheduled', 'cancelled',
]);

const CreateActivitySchema = z.object({
  type: LeadActivityTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  status: FollowUpStatusEnum.optional(),
});

// Look up the lead within the caller's tenant. Returns null if the lead
// doesn't exist or belongs to another tenant — either way the caller
// should not learn about it.
async function findLeadInTenant(leadId: string, tenantId: string) {
  const [row] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// ─── GET /api/v1/leads/[id]/activities ────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const lead = await findLeadInTenant(id, ctx.tenantId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.leadId, id),
          eq(leadActivities.tenantId, ctx.tenantId),
        ),
      )
      .orderBy(desc(leadActivities.createdAt));

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/leads/[id]/activities]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/leads/[id]/activities ───────────────────────────────────────

export async function POST(
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

  const parsed = CreateActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const lead = await findLeadInTenant(id, ctx.tenantId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const [inserted] = await db
      .insert(leadActivities)
      .values({
        tenantId: ctx.tenantId,
        leadId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
        status: parsed.data.status ?? null,
        createdBy: ctx.userId,
      })
      .returning();

    // Keep the pipeline sort accurate — any logged activity bumps lastActivityAt.
    await db
      .update(leads)
      .set({ lastActivityAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/leads/[id]/activities]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
