import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  leads, tenants, measurementRounds, measurementItems, users,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderMeasurementSheetPdf } from '@/lib/pdf/measurement-sheet';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [lead] = await db
    .select({
      id:              leads.id,
      contactName:     leads.contactName,
      contactPhone:    leads.contactPhone,
      projectLocation: leads.projectLocation,
    })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [tenant] = await db
    .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  const rounds = await db
    .select({
      id:             measurementRounds.id,
      roundName:      measurementRounds.roundName,
      scheduledAt:    measurementRounds.scheduledAt,
      completedAt:    measurementRounds.completedAt,
      assignedToName: users.fullName,
      notes:          measurementRounds.notes,
    })
    .from(measurementRounds)
    .leftJoin(users, eq(measurementRounds.assignedToId, users.id))
    .where(eq(measurementRounds.leadId, id))
    .orderBy(asc(measurementRounds.createdAt));

  const roundIds = rounds.map(r => r.id);
  const allItems = roundIds.length
    ? await db
        .select({
          roundId:        measurementItems.roundId,
          room:           measurementItems.room,
          itemName:       measurementItems.itemName,
          dimensionsJson: measurementItems.dimensionsJson,
          qty:            measurementItems.qty,
          unit:           measurementItems.unit,
          notes:          measurementItems.notes,
        })
        .from(measurementItems)
        .where(inArray(measurementItems.roundId, roundIds))
        .orderBy(asc(measurementItems.createdAt))
    : [];

  const itemsByRound = new Map<string, typeof allItems>(rounds.map(r => [r.id, []]));
  for (const item of allItems) {
    itemsByRound.get(item.roundId)?.push(item);
  }

  const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
  const docNumber = `MS-${id.slice(-6).toUpperCase()}`;

  try {
    const buf = await renderMeasurementSheetPdf({
      docNumber,
      issuedAt: new Date(),
      studio,
      client: { name: lead.contactName, phone: lead.contactPhone },
      projectLocation: lead.projectLocation,
      rounds: rounds.map(r => ({
        roundName:      r.roundName,
        scheduledAt:    r.scheduledAt?.toISOString() ?? null,
        completedAt:    r.completedAt?.toISOString() ?? null,
        assignedToName: r.assignedToName ?? null,
        notes:          r.notes ?? null,
        items: (itemsByRound.get(r.id) ?? []).map(i => ({
          room:           i.room,
          itemName:       i.itemName,
          dimensionsJson: i.dimensionsJson as {
            length?: number; width?: number; height?: number; area?: number; unit: string;
          },
          qty:   i.qty,
          unit:  i.unit,
          notes: i.notes ?? null,
        })),
      })),
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${docNumber}.pdf"`,
        'Content-Length':      String(buf.length),
      },
    });
  } catch (err) {
    console.error('[measurements/pdf GET]', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
