import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, projects, milestones, leads } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { requireUuid } from '@/lib/http';
import { eq, and, asc, count } from 'drizzle-orm';
import { applyStageTransition } from '@/lib/leads/transitions';
import { upsertCustomerFromLead } from '@/lib/customers/sync';
import { contractFromQuote, splitMilestones } from '@/lib/projects/booking';
import { linkLeadDesignDeliverables } from '@/lib/projects/link';
import { isAcceptedQuoteStatus } from '@/lib/quotes/status';

const BookQuoteSchema = z.object({
  projectName: z.string().trim().min(1, 'Project name is required').max(200),
  // Accepted for backward compatibility only. Milestones are marked paid by
  // payment allocation, never by this route.
  advancePaidPaise: z.number().int().min(0).default(0),
});

class BookError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/**
 * POST /api/v1/quotes/[id]/book — turn an accepted quote into a project.
 *
 * Idempotent: if the quote (or its lead) already has a project, that project is
 * reused and milestones are seeded only when it has none. Contract value is the
 * quote's EX-GST amount (subtotal − discount); GST % is copied from the quote.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.COMMERCIAL);
  if (denied) return denied;

  const { id } = await params;
  const badId = requireUuid(id);
  if (badId) return badId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BookQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;

  try {
    const [quote] = await db
      .select({ id: quotes.id, leadId: quotes.leadId, status: quotes.status, acceptedAt: quotes.acceptedAt })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    if (!quote.acceptedAt && !isAcceptedQuoteStatus(quote.status)) {
      return NextResponse.json({ error: 'Quote must be accepted before booking a project' }, { status: 422 });
    }

    // Resolve the client record up front (idempotent upsert by phone).
    let customerId: string | null = null;
    if (quote.leadId) {
      const [lead] = await db
        .select({
          id: leads.id, customerId: leads.customerId, contactName: leads.contactName, contactPhone: leads.contactPhone,
          contactEmail: leads.contactEmail, source: leads.source, stage: leads.stage, ownerId: leads.ownerId,
          projectLocation: leads.projectLocation, contactCity: leads.contactCity, pincode: leads.pincode,
        })
        .from(leads)
        .where(and(eq(leads.id, quote.leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);
      if (lead) {
        customerId = lead.customerId ?? (await upsertCustomerFromLead(lead, ctx.tenantId)).customerId;
        if (!lead.customerId) {
          await db.update(leads).set({ customerId })
            .where(and(eq(leads.id, lead.id), eq(leads.tenantId, ctx.tenantId)));
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      // Lock the quote row so two clicks on "Book" cannot both create a project.
      const [q] = await tx
        .select({
          id: quotes.id, projectId: quotes.projectId, leadId: quotes.leadId,
          subtotalPaise: quotes.subtotalPaise, discountPaise: quotes.discountPaise, gstPct: quotes.gstPct,
        })
        .from(quotes)
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
        .for('update');
      if (!q) throw new BookError('Quote not found', 404);

      const contractPaise = contractFromQuote({ subtotalPaise: Number(q.subtotalPaise), discountPaise: Number(q.discountPaise) });

      // 1. Find the project this quote belongs to: its own projectId first, then its lead's.
      let project: { id: string; totalContractPaise: number | null; customerId: string | null } | undefined;
      if (q.projectId) {
        [project] = await tx
          .select({ id: projects.id, totalContractPaise: projects.totalContractPaise, customerId: projects.customerId })
          .from(projects)
          .where(and(eq(projects.id, q.projectId), eq(projects.tenantId, ctx.tenantId)));
      }
      if (!project && q.leadId) {
        [project] = await tx
          .select({ id: projects.id, totalContractPaise: projects.totalContractPaise, customerId: projects.customerId })
          .from(projects)
          .where(and(eq(projects.leadId, q.leadId), eq(projects.tenantId, ctx.tenantId)))
          .orderBy(asc(projects.createdAt))
          .limit(1);
      }

      let created = false;
      let projectId: string;
      if (project) {
        projectId = project.id;
        // Fill in what the existing project is missing — never overwrite a contract the owner typed.
        const patch: { totalContractPaise?: number; gstPct?: number; customerId?: string } = {};
        if (project.totalContractPaise === null || Number(project.totalContractPaise) === 0) {
          patch.totalContractPaise = contractPaise;
          patch.gstPct = q.gstPct;
        }
        if (!project.customerId && customerId) patch.customerId = customerId;
        if (Object.keys(patch).length > 0) {
          await tx.update(projects).set(patch)
            .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));
        }
      } else {
        const [inserted] = await tx
          .insert(projects)
          .values({
            tenantId: ctx.tenantId,
            name: input.projectName,
            leadId: q.leadId,
            customerId: customerId ?? undefined,
            totalContractPaise: contractPaise,
            gstPct: q.gstPct,
            lifecycleStage: 'design_pending',
          })
          .returning({ id: projects.id });
        projectId = inserted.id;
        created = true;
      }

      // 2. Seed the default 10/40/40/10 milestones on the ex-GST contract — only if none exist.
      const [{ n }] = await tx
        .select({ n: count() })
        .from(milestones)
        .where(and(eq(milestones.projectId, projectId), eq(milestones.tenantId, ctx.tenantId)));
      if (n === 0 && contractPaise > 0) {
        await tx.insert(milestones).values(splitMilestones(contractPaise).map(m => ({
          tenantId: ctx.tenantId,
          projectId,
          label: m.label,
          pctOfTotal: m.pctOfTotal,
          amountPaise: m.amountPaise,
          sortOrder: m.sortOrder,
        })));
      }

      // 3. Link the quote and the lead's design deliverables to the project.
      await tx.update(quotes).set({ projectId })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));
      if (q.leadId) await linkLeadDesignDeliverables(tx, ctx.tenantId, q.leadId, projectId);

      return { projectId, created };
    });

    // Booking means the lead is won. ('booked' is not a lead_stage value — it
    // failed the enum after the project had already been committed.) The
    // project exists, so the 'won' transition links to it instead of creating one.
    if (quote.leadId) {
      try {
        await applyStageTransition(quote.leadId, ctx.tenantId, ctx.dbUserId ?? null, 'won');
      } catch (err) {
        console.error('[quotes/:id/book lead-transition]', err);
      }
    }

    const [project] = await db
      .select({ id: projects.id, name: projects.name, lifecycleStage: projects.lifecycleStage })
      .from(projects)
      .where(and(eq(projects.id, result.projectId), eq(projects.tenantId, ctx.tenantId)));
    const milestoneRows = await db
      .select({
        id: milestones.id, label: milestones.label, pctOfTotal: milestones.pctOfTotal,
        amountPaise: milestones.amountPaise, paymentStatus: milestones.paymentStatus, sortOrder: milestones.sortOrder,
      })
      .from(milestones)
      .where(and(eq(milestones.projectId, result.projectId), eq(milestones.tenantId, ctx.tenantId)))
      .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt));

    return NextResponse.json(
      { data: { project, milestones: milestoneRows, created: result.created } },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof BookError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[quotes/:id/book POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
