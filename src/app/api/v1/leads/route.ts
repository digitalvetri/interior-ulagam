import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { inngest } from '@/inngest/client';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const LeadSourceEnum = z.enum([
  'instagram',
  'whatsapp',
  'referral',
  'website',
  'walk_in',
  'other',
]);

const LeadStageEnum = z.enum([
  'new',
  'site_visit_scheduled',
  'consultation_done',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
]);

const CreateLeadSchema = z.object({
  contactName: z.string().min(1),
  contactPhone: z.string().min(10),
  source: LeadSourceEnum,
  budgetBand: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

// ─── GET /api/v1/leads ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const stageParam = searchParams.get('stage');
  const ownerIdParam = searchParams.get('ownerId');

  // Validate optional stage query param
  const stageParsed = stageParam ? LeadStageEnum.safeParse(stageParam) : null;
  if (stageParsed && !stageParsed.success) {
    return NextResponse.json({ error: 'Invalid stage value' }, { status: 400 });
  }

  try {
    const conditions = [eq(leads.tenantId, ctx.tenantId)];

    if (stageParsed?.success) {
      conditions.push(eq(leads.stage, stageParsed.data));
    }
    if (ownerIdParam) {
      conditions.push(eq(leads.ownerId, ownerIdParam));
    }

    const result = await db
      .select({
        id: leads.id,
        tenantId: leads.tenantId,
        source: leads.source,
        stage: leads.stage,
        priority: leads.priority,
        ownerId: leads.ownerId,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        contactEmail: leads.contactEmail,
        propertyType: leads.propertyType,
        projectLocation: leads.projectLocation,
        budgetBand: leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName: leads.designerName,
        followUpDate: leads.followUpDate,
        lostReason: leads.lostReason,
        notes: leads.notes,
        firstTouchAt: leads.firstTouchAt,
        lastActivityAt: leads.lastActivityAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.lastActivityAt));

    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('[GET /api/v1/leads]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/leads ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { contactName, contactPhone, source, budgetBand, notes, ownerId } = parsed.data;

  try {
    const [lead] = await db
      .insert(leads)
      .values({
        tenantId: ctx.tenantId,
        contactName,
        contactPhone,
        source,
        budgetBand: budgetBand ?? null,
        notes: notes ?? null,
        ownerId: ownerId ?? null,
      })
      .returning();

    // Kick off the 3/7/14-day follow-up nudge sequence (non-blocking)
    await inngest.send({
      name: 'lead/followup.start',
      data: {
        leadId: lead.id,
        tenantId: lead.tenantId,
        contactPhone: lead.contactPhone,
        contactName: lead.contactName,
      },
    });

    return NextResponse.json({ data: lead, message: 'Lead created' }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/leads]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
