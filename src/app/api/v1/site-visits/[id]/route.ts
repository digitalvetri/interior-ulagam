import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits, leads, customers, users, measurementRounds } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const PatchSiteVisitSchema = z
  .object({
    scheduledAt:    z.string().datetime(),
    address:        z.string().min(1),
    designerId:     z.string().uuid().nullable(),
    notes:          z.string(),
    followUpNotes:  z.string(),
    purpose:        z.enum(['initial', 'measurement', 'design_review', 'site_inspection', 'material_inspection', 'final_inspection', 'other']),
    projectId:      z.string().uuid().nullable(),
  })
  .partial();

// GET /api/v1/site-visits/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid site visit id' }, { status: 400 });
  }

  try {
    const [visit] = await db
      .select({
        id:            siteVisits.id,
        tenantId:      siteVisits.tenantId,
        leadId:        siteVisits.leadId,
        projectId:     siteVisits.projectId,
        designerId:    siteVisits.designerId,
        status:        siteVisits.status,
        purpose:       siteVisits.purpose,
        visitNumber:   siteVisits.visitNumber,
        scheduledAt:   siteVisits.scheduledAt,
        completedAt:   siteVisits.completedAt,
        locationJson:  siteVisits.locationJson,
        photos:        siteVisits.photos,
        notes:         siteVisits.notes,
        followUpNotes: siteVisits.followUpNotes,
        createdAt:     siteVisits.createdAt,
        leadName:      leads.contactName,
        leadPhone:     leads.contactPhone,
        customerName:  customers.fullName,
        customerId:    customers.id,
        designerName:  users.fullName,
      })
      .from(siteVisits)
      .leftJoin(leads,     eq(siteVisits.leadId,    leads.id))
      .leftJoin(customers, eq(leads.customerId,      customers.id))
      .leftJoin(users,     eq(siteVisits.designerId, users.id))
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!visit) {
      return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    }

    const measurements = await db
      .select({
        id:                measurementRounds.id,
        roundName:         measurementRounds.roundName,
        status:            measurementRounds.status,
        measurementNumber: measurementRounds.measurementNumber,
        completedAt:       measurementRounds.completedAt,
      })
      .from(measurementRounds)
      .where(and(
        eq(measurementRounds.siteVisitId, id),
        eq(measurementRounds.tenantId, ctx.tenantId),
      ));

    return NextResponse.json({ data: { ...visit, measurements } });
  } catch (e) {
    console.error('[GET /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/site-visits/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid site visit id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = PatchSiteVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  const updates: Partial<typeof siteVisits.$inferInsert> = {};
  const d = parsed.data;
  if (d.scheduledAt   !== undefined) updates.scheduledAt   = new Date(d.scheduledAt);
  if (d.address       !== undefined) updates.locationJson  = { address: d.address };
  if (d.designerId    !== undefined) updates.designerId    = d.designerId;
  if (d.notes         !== undefined) updates.notes         = d.notes;
  if (d.followUpNotes !== undefined) updates.followUpNotes = d.followUpNotes;
  if (d.purpose       !== undefined) updates.purpose       = d.purpose;
  if (d.projectId     !== undefined) updates.projectId     = d.projectId;

  try {
    const [updated] = await db
      .update(siteVisits)
      .set(updates)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
    return NextResponse.json({ data: updated, message: 'Site visit updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
