import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, customers, projects, quotes, milestones } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ConvertSchema = z.object({
  projectName:  z.string().min(1).max(200),
  budgetPaise:  z.number().int().nonnegative().optional(),
  // Optional missing client fields — written to the customer record
  pincode:      z.string().max(10).optional(),
  siteAddress:  z.string().max(500).optional(),
});

// POST /api/v1/leads/[id]/convert
// Single server transaction: ensure customer, create project, link accepted quote,
// seed milestones, update lead.stage → 'won'. Returns { projectId }.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = ConvertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { projectName, budgetPaise, pincode, siteAddress } = parsed.data;

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // 2. Find accepted/approved quote (if any) to get the budget
  const [acceptedQuote] = await db
    .select({ id: quotes.id, totalPaise: quotes.totalPaise })
    .from(quotes)
    .where(and(
      eq(quotes.leadId, leadId),
      eq(quotes.tenantId, ctx.tenantId),
      inArray(quotes.status, ['accepted', 'approved']),
    ))
    .orderBy(quotes.createdAt)
    .limit(1);

  const totalContractPaise =
    budgetPaise ??
    (acceptedQuote?.totalPaise && acceptedQuote.totalPaise > 0 ? acceptedQuote.totalPaise : undefined);

  // 3. Ensure a customer record exists for this lead
  let customerId = lead.customerId;

  if (!customerId) {
    // Create or find by phone
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(
        eq(customers.phone, lead.contactPhone),
        eq(customers.tenantId, ctx.tenantId),
      ))
      .limit(1);

    if (existing) {
      customerId = existing.id;
    } else {
      const [newCustomer] = await db
        .insert(customers)
        .values({
          tenantId: ctx.tenantId,
          fullName: lead.contactName,
          phone:    lead.contactPhone,
          email:    lead.contactEmail ?? undefined,
          city:     lead.contactCity  ?? undefined,
          source:   'other',
          leadId:   lead.id,
        })
        .returning({ id: customers.id });
      customerId = newCustomer.id;
    }

    // Link the customer to the lead
    await db.update(leads)
      .set({ customerId })
      .where(eq(leads.id, leadId));
  }

  // 4. Update customer with any missing fields provided in request
  const customerPatch: Record<string, string> = {};
  if (pincode)     customerPatch.address = pincode;     // customers table uses address for pincode+address
  if (siteAddress) customerPatch.address = siteAddress;
  if (Object.keys(customerPatch).length > 0) {
    await db.update(customers)
      .set(customerPatch)
      .where(eq(customers.id, customerId));
  }

  // 5. Create the project
  const [project] = await db
    .insert(projects)
    .values({
      tenantId:           ctx.tenantId,
      name:               projectName,
      customerId:         customerId ?? undefined,
      leadId:             lead.id,
      totalContractPaise: totalContractPaise ?? null,
      lifecycleStage:     'design_pending',
    })
    .returning();

  // 6. Link the accepted quote to the new project
  if (acceptedQuote) {
    await db.update(quotes)
      .set({ projectId: project.id })
      .where(eq(quotes.id, acceptedQuote.id));
  }

  // 7. Seed default milestones (10/40/40/10) if budget is set
  if (totalContractPaise && totalContractPaise > 0) {
    const defaults: Array<{ label: string; pctOfTotal: number }> = [
      { label: 'Advance',         pctOfTotal: 10 },
      { label: 'Design Approval', pctOfTotal: 40 },
      { label: 'Work Completion', pctOfTotal: 40 },
      { label: 'Handover',        pctOfTotal: 10 },
    ];
    for (const def of defaults) {
      const amountPaise = Math.round((totalContractPaise * def.pctOfTotal) / 100);
      await db.insert(milestones).values({
        projectId:   project.id,
        label:       def.label,
        pctOfTotal:  def.pctOfTotal,
        amountPaise,
      });
    }
  }

  // 8. Mark lead as won
  await db.update(leads)
    .set({ stage: 'won' })
    .where(eq(leads.id, leadId));

  return NextResponse.json({ data: { projectId: project.id } }, { status: 201 });
}
