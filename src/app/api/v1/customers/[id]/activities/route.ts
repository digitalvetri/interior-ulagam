import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerActivities, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ActivityTypeEnum = z.enum([
  'call', 'whatsapp', 'note', 'site_visit', 'meeting',
  'stage_change', 'project_created', 'payment_received', 'quote_sent', 'follow_up',
]);

// Activity types that represent real human contact — update lastContactedAt
const CONTACT_TYPES = new Set(['call', 'whatsapp', 'note', 'meeting', 'site_visit']);

const CreateActivitySchema = z.object({
  type: ActivityTypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  metadataJson: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

async function guardCustomer(customerId: string, tenantId: string) {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const exists = await guardCustomer(id, ctx.tenantId);
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rows = await db
      .select()
      .from(customerActivities)
      .where(
        and(
          eq(customerActivities.customerId, id),
          eq(customerActivities.tenantId, ctx.tenantId),
        ),
      )
      .orderBy(desc(customerActivities.createdAt))
      .limit(100);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id/activities]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const exists = await guardCustomer(id, ctx.tenantId);
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [activity] = await db
      .insert(customerActivities)
      .values({
        tenantId: ctx.tenantId,
        customerId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        body: parsed.data.body ?? null,
        metadataJson: parsed.data.metadataJson ?? null,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        performedBy: ctx.dbUserId ?? null,
      })
      .returning();

    if (CONTACT_TYPES.has(parsed.data.type)) {
      await db
        .update(customers)
        .set({ lastContactedAt: new Date() })
        .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)));
    }

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/customers/:id/activities]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
