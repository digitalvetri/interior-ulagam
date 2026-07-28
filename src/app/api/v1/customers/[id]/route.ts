import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, customerActivities } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CustomerSourceEnum = z.enum([
  'referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other',
]);
const CustomerStageEnum = z.enum(['lead', 'opportunity', 'client', 'past_client']);

const UpdateCustomerSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(30).optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  company: z.string().max(120).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  source: CustomerSourceEnum.optional(),
  stage: CustomerStageEnum.optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

async function fetchOne(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
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
    const row = await fetchOne(id, ctx.tenantId);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (k === 'email' && v === '') { patch.email = null; continue; }
    patch[k] = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const existing = await fetchOne(id, ctx.tenantId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [row] = await db
      .update(customers)
      .set(patch)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .returning();

    // Auto-log stage changes on the activity timeline
    if (patch.stage && patch.stage !== existing.stage) {
      await db.insert(customerActivities).values({
        tenantId: ctx.tenantId,
        customerId: id,
        type: 'stage_change',
        title: `Stage changed to ${String(patch.stage).replace('_', ' ')}`,
        performedBy: ctx.dbUserId ?? null,
      });
    }

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/customers/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const [row] = await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .returning({ id: customers.id });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: { id: row.id } });
  } catch (e) {
    console.error('[DELETE /api/v1/customers/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
