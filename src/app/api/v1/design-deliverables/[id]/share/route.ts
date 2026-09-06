import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { designDeliverables, deliverableVersions } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// POST /api/v1/design-deliverables/[id]/share
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [deliverable] = await db
      .select({ id: designDeliverables.id, status: designDeliverables.status })
      .from(designDeliverables)
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .limit(1);

    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    // Find the latest version and mark it as shared
    const [latestVersion] = await db
      .select({ id: deliverableVersions.id })
      .from(deliverableVersions)
      .where(eq(deliverableVersions.deliverableId, id))
      .orderBy(desc(deliverableVersions.versionNumber))
      .limit(1);

    if (latestVersion) {
      await db
        .update(deliverableVersions)
        .set({ sharedAt: new Date() })
        .where(eq(deliverableVersions.id, latestVersion.id));
    }

    // Update deliverable status to 'shared'
    const [updated] = await db
      .update(designDeliverables)
      .set({ status: 'shared' })
      .where(and(eq(designDeliverables.id, id), eq(designDeliverables.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/v1/design-deliverables/[id]/share]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
