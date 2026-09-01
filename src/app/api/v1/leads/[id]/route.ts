import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, waMessages, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { enqueueBestEffort } from '@/jobs/queue';
import { applyStageTransition } from '@/lib/leads/transitions';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const LeadSourceEnum = z.enum(['instagram', 'whatsapp', 'referral', 'website', 'walk_in', 'other']);

// Won/lost are terminal — must use PATCH /api/v1/leads/[id]/stage for those.
const MidPipelineStageEnum = z.enum([
  'new', 'contacted', 'qualified', 'site_visit', 'measurement', 'quotation', 'negotiation',
  // legacy values accepted for backward compat
  'site_visit_scheduled', 'consultation_done', 'proposal_sent',
]);

const PatchLeadSchema = z.object({
  // Pipeline fields (terminal stages go through /stage endpoint)
  stage:        MidPipelineStageEnum,
  ownerId:      z.string().uuid().nullable(),
  followUpDate: z.union([z.string().datetime({ offset: true }), z.string().date(), z.null()]),
  // Contact edit fields
  contactName:     z.string().min(1).max(120),
  contactPhone:    z.string().min(10).max(20),
  alternatePhone:  z.string().max(20).nullable(),
  contactEmail:    z.string().email().nullable().or(z.literal('')),
  contactCity:     z.string().max(80).nullable(),
  pincode:         z.string().max(10).nullable(),
  // Project edit fields
  projectName:       z.string().max(200).nullable(),
  propertyType:      z.string().max(80).nullable(),
  projectLocation:   z.string().max(500).nullable(),
  budgetBand:        z.string().max(80),
  projectValuePaise: z.number().int().min(0).nullable(),
  source:            LeadSourceEnum,
  notes:           z.string().max(4000),
  // Archive toggle
  archive: z.boolean(),
}).partial();

// ─── GET /api/v1/leads/[id] ──────────────────────────────────────────────────

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
    const [lead] = await db
      .select({
        id: leads.id,
        tenantId: leads.tenantId,
        customerId: leads.customerId,
        source: leads.source,
        stage: leads.stage,
        priority: leads.priority,
        ownerId: leads.ownerId,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        alternatePhone: leads.alternatePhone,
        contactEmail: leads.contactEmail,
        contactCity: leads.contactCity,
        pincode: leads.pincode,
        propertyType: leads.propertyType,
        projectName: leads.projectName,
        projectLocation: leads.projectLocation,
        budgetBand: leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName: leads.designerName,
        followUpDate: leads.followUpDate,
        lostReason: leads.lostReason,
        notes: leads.notes,
        score: leads.score,
        scoreBreakdown: leads.scoreBreakdown,
        firstTouchAt: leads.firstTouchAt,
        lastActivityAt: leads.lastActivityAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const recentMessages = await db
      .select({
        id: waMessages.id,
        direction: waMessages.direction,
        bodyPreview: waMessages.bodyPreview,
        createdAt: waMessages.createdAt,
      })
      .from(waMessages)
      .where(and(eq(waMessages.tenantId, ctx.tenantId), eq(waMessages.threadId, lead.contactPhone)))
      .orderBy(desc(waMessages.createdAt))
      .limit(3);

    const [linkedProject] = await db
      .select({ id: projects.id, name: projects.name, lifecycleStage: projects.lifecycleStage, customerId: projects.customerId })
      .from(projects)
      .where(and(eq(projects.leadId, lead.id), eq(projects.tenantId, ctx.tenantId)))
      .limit(1);

    return NextResponse.json({ data: { ...lead, recentMessages, linkedProject: linkedProject ?? null } });
  } catch (e) {
    console.error('[GET /api/v1/leads/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/v1/leads/[id] ────────────────────────────────────────────────

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
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = PatchLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
  }

  const d = parsed.data;

  // Stage transitions run through the shared helper (customer sync, activity log, etc.)
  // This must happen before the general field update so lastActivityAt is consistent.
  if (d.stage !== undefined) {
    const transitioned = await applyStageTransition(
      id, ctx.tenantId, ctx.dbUserId ?? null, d.stage,
    );
    if (!transitioned) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Build non-stage field updates
  const updates: Partial<typeof leads.$inferInsert> = {};
  if (d.ownerId      !== undefined) updates.ownerId    = d.ownerId;
  if (d.notes        !== undefined) updates.notes      = d.notes;
  if (d.budgetBand   !== undefined) updates.budgetBand = d.budgetBand;
  if (d.source       !== undefined) updates.source     = d.source;
  if (d.followUpDate !== undefined) {
    updates.followUpDate = d.followUpDate === null ? null : new Date(d.followUpDate);
  }
  // Contact edit fields
  if (d.contactName     !== undefined) updates.contactName     = d.contactName;
  if (d.contactPhone    !== undefined) updates.contactPhone    = d.contactPhone;
  if (d.alternatePhone  !== undefined) updates.alternatePhone  = d.alternatePhone;
  if (d.contactEmail    !== undefined) updates.contactEmail    = d.contactEmail || null;
  if (d.contactCity     !== undefined) updates.contactCity     = d.contactCity;
  if (d.pincode         !== undefined) updates.pincode         = d.pincode;
  // Project edit fields
  if (d.projectName       !== undefined) updates.projectName       = d.projectName;
  if (d.propertyType      !== undefined) updates.propertyType      = d.propertyType;
  if (d.projectLocation   !== undefined) updates.projectLocation   = d.projectLocation;
  if (d.projectValuePaise !== undefined) updates.projectValuePaise = d.projectValuePaise;
  // Archive
  if (d.archive !== undefined) updates.archivedAt = d.archive ? new Date() : null;

  updates.lastActivityAt = new Date();

  try {
    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .returning({
        id: leads.id,
        tenantId: leads.tenantId,
        customerId: leads.customerId,
        source: leads.source,
        stage: leads.stage,
        priority: leads.priority,
        ownerId: leads.ownerId,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        alternatePhone: leads.alternatePhone,
        contactEmail: leads.contactEmail,
        contactCity: leads.contactCity,
        pincode: leads.pincode,
        propertyType: leads.propertyType,
        projectName: leads.projectName,
        projectLocation: leads.projectLocation,
        budgetBand: leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName: leads.designerName,
        followUpDate: leads.followUpDate,
        lostReason: leads.lostReason,
        notes: leads.notes,
        score: leads.score,
        scoreBreakdown: leads.scoreBreakdown,
        firstTouchAt: leads.firstTouchAt,
        lastActivityAt: leads.lastActivityAt,
        createdAt: leads.createdAt,
      });

    if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Propagate project name + final price to the linked project record (if one exists)
    if (d.projectName !== undefined || d.projectValuePaise !== undefined) {
      const prjUpdates: Partial<typeof projects.$inferInsert> = {};
      if (d.projectName !== undefined) {
        prjUpdates.name = d.projectName?.trim() || `${updated.contactName}'s Project`;
      }
      if (d.projectValuePaise !== undefined) {
        prjUpdates.totalContractPaise = d.projectValuePaise ?? 0;
      }
      await db.update(projects)
        .set(prjUpdates)
        .where(and(eq(projects.leadId, id), eq(projects.tenantId, ctx.tenantId)));
    }

    // Rescore when budget, notes, or final price change (helper fires rescore on real stage changes)
    if (d.budgetBand !== undefined || d.notes !== undefined || d.projectValuePaise !== undefined) {
      void enqueueBestEffort('lead/score.compute', { leadId: id, tenantId: ctx.tenantId });
    }

    return NextResponse.json({ data: updated, message: 'Lead updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/leads/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/leads/[id] ───────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['owner', 'designer'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and designers can delete leads' }, { status: 403 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .returning({ id: leads.id });

    if (!deleted) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    return NextResponse.json({ message: 'Lead deleted' });
  } catch (e) {
    console.error('[DELETE /api/v1/leads/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
