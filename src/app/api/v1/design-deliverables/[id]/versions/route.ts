import { NextRequest, NextResponse } from 'next/server';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designDeliverables, deliverableVersions } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const AddVersionSchema = z.object({
  fileUrl: z.string().url(),
  fileType: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// POST /api/v1/design-deliverables/[id]/versions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AddVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Verify deliverable belongs to tenant
    const [deliverable] = await db
      .select({ id: designDeliverables.id })
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    // Get the current max version number
    const [{ maxVersion }] = await db
      .select({ maxVersion: max(deliverableVersions.versionNumber) })
      .from(deliverableVersions)
      .where(eq(deliverableVersions.deliverableId, id));

    const nextVersionNumber = (maxVersion ?? 0) + 1;

    // Insert new version
    const [version] = await db
      .insert(deliverableVersions)
      .values({
        deliverableId: id,
        versionNumber: nextVersionNumber,
        fileUrl: parsed.data.fileUrl,
        fileType: parsed.data.fileType ?? null,
        notes: parsed.data.notes ?? null,
        createdBy: ctx.dbUserId ?? null,
      })
      .returning();

    // Reset parent deliverable status to 'draft' — new upload clears any prior approval/share
    await db
      .update(designDeliverables)
      .set({ status: 'draft' })
      .where(eq(designDeliverables.id, id));

    return NextResponse.json({ data: version }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/design-deliverables/[id]/versions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
