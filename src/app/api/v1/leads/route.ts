import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { enqueue, enqueueBestEffort, logPendingWorkflow } from '@/jobs/queue';
import { upsertCustomerFromLead } from '@/lib/customers/sync';

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
  contactName:    z.string().min(1).max(120),
  contactPhone:   z.string().min(10).max(20),
  alternatePhone: z.string().max(20).optional(),
  contactEmail:   z.string().email().optional().or(z.literal('')),
  contactCity:    z.string().max(80).optional(),
  pincode:        z.string().max(10).optional(),
  source:         LeadSourceEnum,
  propertyType:   z.string().max(80).optional(),
  projectName:    z.string().max(200).optional(),
  projectLocation: z.string().max(500).optional(),
  budgetBand:     z.string().max(80).optional(),
  notes:          z.string().max(4000).optional(),
  ownerId:        z.string().uuid().optional(),
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
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const conditions = [eq(leads.tenantId, ctx.tenantId)];
    if (!includeArchived)     conditions.push(isNull(leads.archivedAt));
    if (stageParsed?.success) conditions.push(eq(leads.stage, stageParsed.data));
    if (ownerIdParam)         conditions.push(eq(leads.ownerId, ownerIdParam));

    const result = await db
      .select({
        id:                leads.id,
        tenantId:          leads.tenantId,
        source:            leads.source,
        stage:             leads.stage,
        priority:          leads.priority,
        ownerId:           leads.ownerId,
        contactName:       leads.contactName,
        contactPhone:      leads.contactPhone,
        contactEmail:      leads.contactEmail,
        propertyType:      leads.propertyType,
        projectLocation:   leads.projectLocation,
        budgetBand:        leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName:      leads.designerName,
        followUpDate:      leads.followUpDate,
        lostReason:        leads.lostReason,
        notes:             leads.notes,
        score:             leads.score,
        scoreBreakdown:    leads.scoreBreakdown,
        firstTouchAt:      leads.firstTouchAt,
        lastActivityAt:    leads.lastActivityAt,
        createdAt:         leads.createdAt,
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

  const {
    contactName, contactPhone, alternatePhone, contactEmail, contactCity,
    pincode, source, propertyType, projectName, projectLocation,
    budgetBand, notes, ownerId,
  } = parsed.data;

  try {
    // 1. Insert the lead — explicit RETURNING avoids schema-drift 500s when new
    //    columns exist in schema.ts but the migration hasn't been run yet.
    const [lead] = await db
      .insert(leads)
      .values({
        tenantId:        ctx.tenantId,
        contactName,
        contactPhone,
        alternatePhone:  alternatePhone || null,
        contactEmail:    (contactEmail && contactEmail !== '') ? contactEmail : null,
        contactCity:     contactCity || null,
        pincode:         pincode || null,
        source,
        propertyType:    propertyType || null,
        projectName:     projectName || null,
        projectLocation: projectLocation || null,
        budgetBand:      budgetBand || null,
        notes:           notes || null,
        ownerId:         ownerId || null,
      })
      .returning({
        id:                leads.id,
        tenantId:          leads.tenantId,
        source:            leads.source,
        stage:             leads.stage,
        priority:          leads.priority,
        ownerId:           leads.ownerId,
        contactName:       leads.contactName,
        contactPhone:      leads.contactPhone,
        contactEmail:      leads.contactEmail,
        propertyType:      leads.propertyType,
        projectLocation:   leads.projectLocation,
        budgetBand:        leads.budgetBand,
        projectValuePaise: leads.projectValuePaise,
        designerName:      leads.designerName,
        followUpDate:      leads.followUpDate,
        lostReason:        leads.lostReason,
        notes:             leads.notes,
        score:             leads.score,
        firstTouchAt:      leads.firstTouchAt,
        lastActivityAt:    leads.lastActivityAt,
        createdAt:         leads.createdAt,
      });

    // 2. Upsert customer + link both FKs. Wrapped so a schema mismatch (e.g. missing
    //    column before drizzle-kit push) never prevents the lead from being saved.
    //    Run `pnpm drizzle-kit push` then call POST /api/v1/customers/backfill to link
    //    any leads created while the column was absent.
    let customerId: string | undefined;
    try {
      const result = await upsertCustomerFromLead(
        {
          id:              lead.id,
          contactName:     lead.contactName,
          contactPhone:    lead.contactPhone,
          contactEmail:    lead.contactEmail ?? null,
          source:          lead.source,
          stage:           lead.stage,
          ownerId:         lead.ownerId ?? null,
          projectLocation: projectLocation ?? null,
          contactCity:     contactCity ?? null,
          pincode:         pincode ?? null,
        },
        ctx.tenantId,
      );
      customerId = result.customerId;

      // 3. Link lead → customer
      await db
        .update(leads)
        .set({ customerId })
        .where(eq(leads.id, lead.id));
    } catch (syncErr) {
      console.error('[POST /api/v1/leads] customer sync failed (run drizzle-kit push):', syncErr);
    }

    // 4. Non-blocking: nudge sequence + enrichment + initial score
    logPendingWorkflow('lead/followup.start', {
      leadId: lead.id, tenantId: lead.tenantId,
      contactPhone: lead.contactPhone, contactName: lead.contactName,
    });
    await enqueueBestEffort('lead/created', {
      leadId: lead.id, tenantId: lead.tenantId, inboundText: notes ?? undefined,
    });
    await enqueueBestEffort('lead/score.compute', { leadId: lead.id, tenantId: lead.tenantId });

    return NextResponse.json({ data: { ...lead, customerId }, message: 'Lead created' }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/leads]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
