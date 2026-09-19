import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  siteVisits, leads, customers, users,
  measurementRounds, leadActivities, notifications,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// DELETE /api/v1/site-visits/[id]
export async function DELETE(
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
      .select({ id: siteVisits.id, status: siteVisits.status })
      .from(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!visit) return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });

    await db
      .delete(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: { id } });
  } catch (e) {
    console.error('[DELETE /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

const PatchSiteVisitSchema = z
  .object({
    scheduledAt:   z.string().datetime(),
    address:       z.string().min(1),
    designerId:    z.string().uuid().nullable(),
    notes:         z.string(),
    followUpNotes: z.string(),
    purpose:       z.enum(['initial', 'measurement', 'design_review', 'site_inspection', 'material_inspection', 'final_inspection', 'other']),
    projectId:     z.string().uuid().nullable(),
    status:        z.enum(['cancelled', 'no_show']),
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

  try {
    // Fetch current visit to guard against terminal-state mutations
    const [current] = await db
      .select({
        status:      siteVisits.status,
        scheduledAt: siteVisits.scheduledAt,
        leadId:      siteVisits.leadId,
        designerId:  siteVisits.designerId,
        locationJson: siteVisits.locationJson,
      })
      .from(siteVisits)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .limit(1);

    if (!current) return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });

    if (TERMINAL_STATUSES.has(current.status)) {
      return NextResponse.json(
        { error: `Cannot modify a ${current.status} visit.` },
        { status: 409 },
      );
    }

    const d = parsed.data;
    const isReschedule = d.scheduledAt !== undefined;
    const isStatusChange = d.status !== undefined;

    const updates: Partial<typeof siteVisits.$inferInsert> = {};
    if (d.scheduledAt   !== undefined) updates.scheduledAt   = new Date(d.scheduledAt);
    if (d.address       !== undefined) updates.locationJson  = { address: d.address };
    if (d.designerId    !== undefined) updates.designerId    = d.designerId;
    if (d.notes         !== undefined) updates.notes         = d.notes;
    if (d.followUpNotes !== undefined) updates.followUpNotes = d.followUpNotes;
    if (d.purpose       !== undefined) updates.purpose       = d.purpose;
    if (d.projectId     !== undefined) updates.projectId     = d.projectId;
    if (isStatusChange)                updates.status        = d.status;

    const [updated] = await db
      .update(siteVisits)
      .set(updates)
      .where(and(eq(siteVisits.id, id), eq(siteVisits.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });

    // Log reschedule in lead activity
    if (isReschedule && current.leadId) {
      const newDate = new Date(d.scheduledAt!);
      const oldDate = current.scheduledAt;
      const fmt = (dt: Date) => dt.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      });
      await db.insert(leadActivities).values({
        tenantId:    ctx.tenantId,
        leadId:      current.leadId,
        type:        'note',
        title:       `Site visit rescheduled — ${fmt(oldDate)} → ${fmt(newDate)}`,
        description: d.address ? `New address: ${d.address}` : null,
        scheduledAt: newDate,
        status:      'pending',
        createdBy:   ctx.dbUserId ?? undefined,
      });
    }

    // Notify designer on cancel / no_show
    if (isStatusChange && current.designerId) {
      const label = d.status === 'cancelled' ? 'cancelled' : 'marked as no-show';
      await db.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId:   current.designerId,
        severity: 'warning',
        title:    `Site visit ${label}`,
        body:     `The visit scheduled for ${current.scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} has been ${label}.`,
        href:     `/site-visits/${id}`,
      });
    }

    return NextResponse.json({ data: updated, message: 'Site visit updated' });
  } catch (e) {
    console.error('[PATCH /api/v1/site-visits/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
