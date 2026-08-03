import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, ilike, inArray, notInArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { enqueue } from '@/jobs/queue';

const CustomerSourceEnum = z.enum([
  'referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other',
]);
const CustomerStageEnum = z.enum(['lead', 'opportunity', 'client', 'past_client']);

const CreateCustomerSchema = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(500).optional(),
  source: CustomerSourceEnum.optional(),
  stage: CustomerStageEnum.optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  notes: z.string().max(4000).optional(),
  ownerId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const stageParam = searchParams.get('stage');
  const stage = stageParam ? CustomerStageEnum.safeParse(stageParam) : null;
  if (stage && !stage.success) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
  }

  try {
    const conditions = [eq(customers.tenantId, ctx.tenantId)];
    if (stage?.success) conditions.push(eq(customers.stage, stage.data));
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(customers.fullName, like),
        ilike(customers.phone, like),
        ilike(customers.email, like),
        ilike(customers.company, like),
      );
      if (search) conditions.push(search);
    }

    const customerRows = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.createdAt))
      .limit(500);

    // Attach the most-recently-active lead stage for the pipeline badge.
    // Two queries + in-memory merge — avoids a complex lateral join.
    const ids = customerRows.map((c) => c.id);
    const activeLeads =
      ids.length > 0
        ? await db
            .select({
              customerId: leads.customerId,
              id:          leads.id,
              stage:       leads.stage,
            })
            .from(leads)
            .where(
              and(
                eq(leads.tenantId, ctx.tenantId),
                inArray(leads.customerId, ids),
                notInArray(leads.stage, ['won', 'lost']),
              ),
            )
            .orderBy(desc(leads.lastActivityAt))
        : [];

    // One active lead per customer — take the most recent (already ordered)
    const leadByCustomer = new Map<string, { id: string; stage: string }>();
    for (const l of activeLeads) {
      if (l.customerId && !leadByCustomer.has(l.customerId)) {
        leadByCustomer.set(l.customerId, { id: l.id, stage: l.stage });
      }
    }

    const rows = customerRows.map((c) => {
      const activeLead = leadByCustomer.get(c.id);
      return {
        ...c,
        activeLeadId:    activeLead?.id    ?? null,
        activeLeadStage: activeLead?.stage ?? null,
      };
    });

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/customers]', e);
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Duplicate detection: block if a customer with the same phone already exists
    const [duplicate] = await db
      .select({ id: customers.id, fullName: customers.fullName })
      .from(customers)
      .where(and(eq(customers.tenantId, ctx.tenantId), eq(customers.phone, parsed.data.phone)))
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: 'duplicate', existingId: duplicate.id, existingName: duplicate.fullName },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(customers)
      .values({
        tenantId: ctx.tenantId,
        ownerId: parsed.data.ownerId ?? null,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email && parsed.data.email !== '' ? parsed.data.email : null,
        company: parsed.data.company ?? null,
        city: parsed.data.city ?? null,
        address: parsed.data.address ?? null,
        source: parsed.data.source ?? 'other',
        stage: parsed.data.stage ?? 'lead',
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes ?? null,
      })
      .returning();

    // Trigger background enrichment (links to lead, detects WA history)
    await enqueue('customer/created', { customerId: row.id, tenantId: ctx.tenantId, phone: row.phone });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/customers]', e);
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
