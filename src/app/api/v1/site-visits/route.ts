import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits, leads, users, customers, notifications } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const VISIT_PURPOSE_VALUES = [
  'initial', 'measurement', 'design_review',
  'site_inspection', 'material_inspection', 'final_inspection', 'other',
] as const;

const CreateSiteVisitSchema = z.object({
  leadId:     z.string().uuid(),
  scheduledAt: z.string().datetime(),
  address:    z.string().min(1),
  designerId: z.string().uuid().optional(),
  purpose:    z.enum(VISIT_PURPOSE_VALUES).optional(),
  notes:      z.string().optional(),
});

function isUniqueViolation(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = (e as { code?: string }).code;
  return code === '23505' || e.message.includes('23505');
}

// ─── GET /api/v1/site-visits ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const leadIdParam = searchParams.get('leadId');

  if (leadIdParam) {
    const leadIdParsed = z.string().uuid().safeParse(leadIdParam);
    if (!leadIdParsed.success) {
      return NextResponse.json({ error: 'Invalid leadId — must be a UUID' }, { status: 400 });
    }
  }

  try {
    const conditions = [eq(siteVisits.tenantId, ctx.tenantId)];
    if (leadIdParam) {
      conditions.push(eq(siteVisits.leadId, leadIdParam));
    }

    const result = await db
      .select({
        id:           siteVisits.id,
        leadId:       siteVisits.leadId,
        projectId:    siteVisits.projectId,
        designerId:   siteVisits.designerId,
        visitNumber:  siteVisits.visitNumber,
        status:       siteVisits.status,
        purpose:      siteVisits.purpose,
        scheduledAt:  siteVisits.scheduledAt,
        completedAt:  siteVisits.completedAt,
        locationJson: siteVisits.locationJson,
        photos:       siteVisits.photos,
        notes:        siteVisits.notes,
        followUpNotes: siteVisits.followUpNotes,
        createdAt:    siteVisits.createdAt,
        designerName: users.fullName,
        leadName:     leads.contactName,
        leadPhone:    leads.contactPhone,
        customerName: customers.fullName,
      })
      .from(siteVisits)
      .leftJoin(leads,     eq(siteVisits.leadId,     leads.id))
      .leftJoin(users,     eq(siteVisits.designerId,  users.id))
      .leftJoin(customers, eq(leads.customerId,        customers.id))
      .where(and(...conditions))
      .orderBy(desc(siteVisits.scheduledAt));

    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('[GET /api/v1/site-visits]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/site-visits ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSiteVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { leadId, scheduledAt, address, designerId, purpose, notes } = parsed.data;

  try {
    const [currentLead] = await db
      .select({ id: leads.id, stage: leads.stage })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!currentLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Use MAX-based numbering to prevent duplicates when visits are deleted
    const [{ maxNum }] = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${siteVisits.visitNumber} FROM 4) AS INTEGER)), 0)` })
      .from(siteVisits)
      .where(eq(siteVisits.tenantId, ctx.tenantId));
    const visitNumber = `SV-${String(maxNum + 1).padStart(4, '0')}`;

    const [visit] = await db
      .insert(siteVisits)
      .values({
        tenantId: ctx.tenantId,
        leadId,
        scheduledAt: new Date(scheduledAt),
        locationJson: { address },
        designerId: designerId ?? null,
        purpose:    purpose ?? null,
        notes:      notes ?? null,
        visitNumber,
      })
      .returning();

    // Auto-advance lead stage to site_visit if still in an early stage
    const EARLY_STAGES = ['new', 'contacted', 'qualified'];
    if (EARLY_STAGES.includes(currentLead.stage ?? '')) {
      await db.update(leads)
        .set({ stage: 'site_visit', lastActivityAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)));
    }

    // Notify assigned designer
    if (designerId) {
      const scheduledDate = new Date(scheduledAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      });
      await db.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId:   designerId,
        severity: 'info',
        title:    `Site visit scheduled — ${scheduledDate}`,
        body:     address,
        href:     `/site-visits/${visit.id}`,
      });
    }

    return NextResponse.json({ data: visit, message: 'Site visit scheduled' }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/site-visits]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
