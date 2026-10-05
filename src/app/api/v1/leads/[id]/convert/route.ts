import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads, customers, projects, quotes, milestones } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { contractFromQuote, splitMilestones } from '@/lib/projects/booking';
import { linkLeadDesignDeliverables } from '@/lib/projects/link';
import { ACCEPTED_QUOTE_STATUSES } from '@/lib/quotes/status';

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
  const denied = requireApiRole(ctx, ROLES.CRM);
  if (denied) return denied;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = ConvertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.flatten() },
      { status: 422 },
    );
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
  // Duplicate-project guard: a lead may already be linked to a project even if its stage isn't 'won'
  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.leadId, leadId), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);
  if (existingProject) {
    return NextResponse.json(
      { error: 'This lead already has a project.', details: { projectId: existingProject.id } },
      { status: 422 },
    );
  }

  // 2. Find accepted/approved quote (if any) to get the budget
  const [acceptedQuote] = await db
    .select({
      id: quotes.id, subtotalPaise: quotes.subtotalPaise, discountPaise: quotes.discountPaise, gstPct: quotes.gstPct,
    })
    .from(quotes)
    .where(and(
      eq(quotes.leadId, leadId),
      eq(quotes.tenantId, ctx.tenantId),
      inArray(quotes.status, [...ACCEPTED_QUOTE_STATUSES]),
    ))
    .orderBy(desc(quotes.version), desc(quotes.createdAt))
    .limit(1);

  // Contract is EXCLUDING GST (the money engine adds projects.gst_pct on top),
  // so a quote contributes subtotal − discount, never its GST-inclusive total.
  const quoteContractPaise = acceptedQuote ? contractFromQuote(acceptedQuote) : 0;
  const totalContractPaise =
    budgetPaise ?? (quoteContractPaise > 0 ? quoteContractPaise : undefined);

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
        // Phone already exists — reuse the customer record and link this lead to them
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
        ...(acceptedQuote ? { gstPct: acceptedQuote.gstPct } : {}),
        lifecycleStage:     'design_pending',
        startedAt:          startDate ? new Date(startDate) : undefined,
      })
      .returning();
    projectId = project.id;

    // 6. Link the accepted quote to the new project
    if (acceptedQuote) {
      await tx.update(quotes)
        .set({ projectId: project.id })
        .where(and(eq(quotes.id, acceptedQuote.id), eq(quotes.tenantId, ctx.tenantId)));
    }

    // 6b. Attach the lead's design deliverables to the project
    await linkLeadDesignDeliverables(tx, ctx.tenantId, lead.id, project.id);

    // 7. Seed default milestones (10/40/40/10) on the ex-GST contract if budget is set
    if (totalContractPaise && totalContractPaise > 0) {
      await tx.insert(milestones).values(splitMilestones(totalContractPaise).map(m => ({
        tenantId:    ctx.tenantId,
        projectId:   project.id,
        label:       m.label,
        pctOfTotal:  m.pctOfTotal,
        amountPaise: m.amountPaise,
        sortOrder:   m.sortOrder,
      })));
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
    console.error('[POST /leads/[id]/convert]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!projectId) return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  return NextResponse.json({ data: { projectId } }, { status: 201 });
}
