import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { siteVisits, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const CreateSiteVisitSchema = z.object({
  leadId: z.string().uuid(),
  scheduledAt: z.string().datetime(), // ISO string
  // address is stored in locationJson as { address: string }
  address: z.string().min(1),
  designerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// ─── GET /api/v1/site-visits ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const leadIdParam = searchParams.get('leadId');

  // Validate optional leadId query param
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
      .select()
      .from(siteVisits)
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

  const { leadId, scheduledAt, address, designerId, notes } = parsed.data;

  try {
    // Verify the lead belongs to this tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const [visit] = await db
      .insert(siteVisits)
      .values({
        tenantId: ctx.tenantId,
        leadId,
        scheduledAt: new Date(scheduledAt),
        locationJson: { address },
        designerId: designerId ?? null,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json(
      { data: visit, message: 'Site visit scheduled' },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/v1/site-visits]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
