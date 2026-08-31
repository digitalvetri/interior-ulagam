import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, leads, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { upsertCustomerFromLead } from '@/lib/customers/sync';
import { eq, and, desc } from 'drizzle-orm';

const isDev = process.env.NODE_ENV !== 'production';

function serverError(step: string, err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[projects ${step}]`, err);
  return NextResponse.json(
    {
      error: isDev ? `[${step}] ${message}` : 'Internal server error',
      ...(isDev && { step, detail: message }),
    },
    { status },
  );
}

const CreateProjectSchema = z.object({
  leadId:             z.string().uuid().optional(),
  clientName:         z.string().min(1).optional(),
  clientPhone:        z.string().min(7).optional(),
  name:               z.string().min(1),
  designerIds:        z.array(z.string().uuid()).default([]),
  totalContractPaise: z.number().int().nonnegative().optional(),
}).refine(
  d => d.leadId || (d.clientName && d.clientPhone),
  { message: 'Either leadId or both clientName and clientPhone are required' }
);

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db
      .select({
        id:                 projects.id,
        tenantId:           projects.tenantId,
        leadId:             projects.leadId,
        clientId:           projects.clientId,
        customerId:         projects.customerId,
        name:               projects.name,
        designerIds:        projects.designerIds,
        totalContractPaise: projects.totalContractPaise,
        lifecycleStage:     projects.lifecycleStage,
        timelineJson:       projects.timelineJson,
        startedAt:          projects.startedAt,
        expectedEndAt:      projects.expectedEndAt,
        createdAt:          projects.createdAt,
        // Context: customer name or lead contact for display
        customerFullName:   customers.fullName,
        leadContactName:    leads.contactName,
      })
      .from(projects)
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(eq(projects.tenantId, ctx.tenantId))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return serverError('GET select', err);
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

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  let leadId:    string | null = null;
  let customerId: string | null = null;

  if (input.leadId) {
    // ── Lead-linked path ─────────────────────────────────────────────────────
    let lead: {
      id: string;
      customerId: string | null;
      contactName: string;
      contactPhone: string;
      contactEmail: string | null;
      source: string;
      stage: string;
      ownerId: string | null;
      projectLocation: string | null;
      contactCity: string | null;
      pincode: string | null;
    } | undefined;
    try {
      [lead] = await db
        .select({
          id:              leads.id,
          customerId:      leads.customerId,
          contactName:     leads.contactName,
          contactPhone:    leads.contactPhone,
          contactEmail:    leads.contactEmail,
          source:          leads.source,
          stage:           leads.stage,
          ownerId:         leads.ownerId,
          projectLocation: leads.projectLocation,
          contactCity:     leads.contactCity,
          pincode:         leads.pincode,
        })
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)));
    } catch (err) {
      return serverError('POST lead-lookup', err);
    }

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    leadId = input.leadId;
    customerId = lead.customerId;

    if (!customerId) {
      try {
        const { customerId: cid } = await upsertCustomerFromLead(lead, ctx.tenantId);
        customerId = cid;
        await db
          .update(leads)
          .set({ customerId: cid })
          .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)));
      } catch (err) {
        console.error('[projects POST customer-upsert]', err);
      }
    }
  } else {
    // ── Standalone path: create customer from clientName + clientPhone ────────
    try {
      const [customer] = await db
        .insert(customers)
        .values({
          tenantId: ctx.tenantId,
          fullName: input.clientName!,
          phone:    input.clientPhone!,
        })
        .returning({ id: customers.id });
      customerId = customer?.id ?? null;
    } catch (err) {
      console.error('[projects POST customer-create]', err);
      // Non-fatal
    }
  }

  // ── Insert project ───────────────────────────────────────────────────────────
  let project: typeof projects.$inferSelect | undefined;
  try {
    [project] = await db
      .insert(projects)
      .values({
        tenantId:           ctx.tenantId,
        leadId:             leadId ?? undefined,
        customerId:         customerId ?? undefined,
        name:               input.name,
        designerIds:        input.designerIds,
        totalContractPaise: input.totalContractPaise ?? null,
      })
      .returning({
        id:                 projects.id,
        tenantId:           projects.tenantId,
        leadId:             projects.leadId,
        clientId:           projects.clientId,
        customerId:         projects.customerId,
        name:               projects.name,
        designerIds:        projects.designerIds,
        totalContractPaise: projects.totalContractPaise,
        lifecycleStage:     projects.lifecycleStage,
        timelineJson:       projects.timelineJson,
        startedAt:          projects.startedAt,
        expectedEndAt:      projects.expectedEndAt,
        createdAt:          projects.createdAt,
      });
  } catch (err) {
    return serverError('POST insert', err);
  }

  if (!project) {
    return serverError('POST insert', new Error('Insert returned no rows'));
  }

  // ── Mark lead as won (lead-linked path only) ─────────────────────────────────
  if (leadId) {
    try {
      await db
        .update(leads)
        .set({ stage: 'won', lastActivityAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)));
    } catch (err) {
      console.error('[projects POST lead-update]', err);
    }
  }

  return NextResponse.json({ data: project, message: 'Project created' }, { status: 201 });
}
