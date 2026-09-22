import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, customers, projects, quotes, milestones } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ConvertSchema = z.object({
  projectName:  z.string().min(1).max(200),
  budgetPaise:  z.number().int().nonnegative().optional(),
  projectType:  z.string().max(50).optional(),
  siteCity:     z.string().max(100).optional(),
  startDate:    z.string().datetime().optional(),
  requirement:  z.string().max(2000).optional(),
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

  const { projectName, budgetPaise, projectType, siteCity, startDate, requirement, siteAddress } = parsed.data;

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // BR-1: Lost leads must be reopened before conversion
  if (lead.stage === 'lost') {
    return NextResponse.json(
      { error: 'A lost lead must be reopened before it can be converted.' },
      { status: 422 },
    );
  }
  // CX-2: Prevent double-conversion of already-won leads
  if (lead.stage === 'won') {
    return NextResponse.json(
      { error: 'This lead has already been converted to a project.' },
      { status: 422 },
    );
  }

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

  // 3–8. All mutations in one atomic transaction (CX-1)
  let customerId = lead.customerId;
  let projectId: string | undefined;

  try {
  await db.transaction(async (tx) => {
    // 3. Ensure a customer record exists for this lead
    if (!customerId) {
      const [inserted] = await tx
        .insert(customers)
        .values({
          tenantId: ctx.tenantId,
          fullName: lead.contactName,
          phone:    lead.contactPhone,
          email:    lead.contactEmail ?? undefined,
          city:     lead.contactCity  ?? undefined,
          source:   'other',
          stage:    'client',
          leadId:   lead.id,
        })
        .onConflictDoNothing({ target: [customers.tenantId, customers.phone] })
        .returning({ id: customers.id });

      if (inserted) {
        customerId = inserted.id;
      } else {
        const [existing] = await tx
          .select({ id: customers.id, leadId: customers.leadId })
          .from(customers)
          .where(and(
            eq(customers.tenantId, ctx.tenantId),
            eq(customers.phone, lead.contactPhone),
          ))
          .limit(1);
        if (!existing) throw new Error('INTERNAL: customer lookup failed after conflict');
        // Prevent silently merging unrelated contacts with the same phone
        if (existing.leadId && existing.leadId !== leadId) {
          throw Object.assign(new Error('PHONE_CONFLICT'), { code: 'PHONE_CONFLICT' });
        }
        customerId = existing.id;
      }

      await tx.update(leads)
        .set({ customerId })
        .where(eq(leads.id, leadId));
    }

    // 4. Advance customer to 'client' stage + apply any missing fields from request
    const customerPatch: Record<string, string> = { stage: 'client' };
    if (siteAddress) customerPatch.address = siteAddress;
    if (siteCity)    customerPatch.city    = siteCity;
    await tx.update(customers)
      .set(customerPatch)
      .where(eq(customers.id, customerId!));

    // 5. Create the project
    const [project] = await tx
      .insert(projects)
      .values({
        tenantId:           ctx.tenantId,
        name:               projectName,
        customerId:         customerId ?? undefined,
        leadId:             lead.id,
        totalContractPaise: totalContractPaise ?? null,
        lifecycleStage:     'design_pending',
        startedAt:          startDate ? new Date(startDate) : undefined,
      })
      .returning();
    projectId = project.id;

    // 6. Link the accepted quote to the new project
    if (acceptedQuote) {
      await tx.update(quotes)
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
        await tx.insert(milestones).values({
          projectId:   project.id,
          label:       def.label,
          pctOfTotal:  def.pctOfTotal,
          amountPaise,
        });
      }
    }

    // 8. Mark lead as won, clear followUpDate (BR-3/C), persist project type, requirement,
    //    and sync projectValuePaise so the lead page reflects the quoted amount.
    await tx.update(leads)
      .set({
        stage:             'won',
        followUpDate:      null,
        propertyType:      projectType || undefined,
        notes:             requirement || undefined,
        projectValuePaise: totalContractPaise ?? undefined,
      })
      .where(eq(leads.id, leadId));
  });

  } catch (err) {
    if (err instanceof Error && err.message === 'PHONE_CONFLICT') {
      return NextResponse.json(
        { error: 'A customer with this phone number is already linked to a different lead. Update the phone number or merge the contacts first.' },
        { status: 409 },
      );
    }
    console.error('[POST /leads/[id]/convert]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!projectId) return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  return NextResponse.json({ data: { projectId } }, { status: 201 });
}
