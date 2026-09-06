import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, tenants, measurementRounds, measurementItems, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderMeasurementSheetPdf } from '@/lib/pdf/measurement-sheet';
import { putObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

// POST /api/v1/leads/[id]/measurements/[roundId]/pdf
// Generate a measurement-sheet PDF for a single round, upload to S3, return presigned URL (300s TTL).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leadId, roundId } = await params;

  try {
    // 1. Verify lead belongs to this tenant
    const [lead] = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        projectLocation: leads.projectLocation,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // 2. Fetch the single round — must belong to this lead (two-hop ownership check)
    const [round] = await db
      .select({
        id: measurementRounds.id,
        roundName: measurementRounds.roundName,
        scheduledAt: measurementRounds.scheduledAt,
        completedAt: measurementRounds.completedAt,
        assignedToName: users.fullName,
        notes: measurementRounds.notes,
      })
      .from(measurementRounds)
      .leftJoin(users, eq(measurementRounds.assignedToId, users.id))
      .where(
        and(
          eq(measurementRounds.id, roundId),
          eq(measurementRounds.leadId, leadId),
        ),
      )
      .limit(1);

    if (!round) return NextResponse.json({ error: 'Measurement round not found' }, { status: 404 });

    // 3. Fetch items for this round
    const items = await db
      .select({
        room: measurementItems.room,
        itemName: measurementItems.itemName,
        dimensionsJson: measurementItems.dimensionsJson,
        qty: measurementItems.qty,
        unit: measurementItems.unit,
        notes: measurementItems.notes,
      })
      .from(measurementItems)
      .where(eq(measurementItems.roundId, roundId))
      .orderBy(asc(measurementItems.createdAt));

    // 4. Fetch tenant branding
    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
    const docNumber = `MS-${roundId.slice(-6).toUpperCase()}`;

    // 5. Render PDF buffer
    const buffer = await renderMeasurementSheetPdf({
      docNumber,
      issuedAt: new Date(),
      studio,
      client: { name: lead.contactName, phone: lead.contactPhone },
      projectLocation: lead.projectLocation ?? null,
      rounds: [
        {
          roundName: round.roundName,
          scheduledAt: round.scheduledAt?.toISOString() ?? null,
          completedAt: round.completedAt?.toISOString() ?? null,
          assignedToName: round.assignedToName ?? null,
          notes: round.notes ?? null,
          items: items.map((i) => ({
            room: i.room,
            itemName: i.itemName,
            dimensionsJson: i.dimensionsJson as {
              length?: number;
              width?: number;
              height?: number;
              area?: number;
              unit: string;
            },
            qty: i.qty,
            unit: i.unit,
            notes: i.notes ?? null,
          })),
        },
      ],
    });

    // 6. Upload to private DOCUMENTS_BUCKET
    const key = `measurements/${roundId}.pdf`;
    await putObject({ bucket: DOCUMENTS_BUCKET, key, body: buffer, contentType: 'application/pdf' });

    // 7. Return presigned download URL (300s TTL)
    const presignedUrl = await getDownloadUrl({
      bucket: DOCUMENTS_BUCKET,
      key,
      expiresIn: 300,
      filename: `${docNumber}.pdf`,
    });

    return NextResponse.json({ data: { pdfUrl: presignedUrl } });
  } catch (err) {
    console.error('[leads/:id/measurements/:roundId/pdf POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
