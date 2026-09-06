import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, projects, milestones } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { applyStageTransition } from '@/lib/leads/transitions';

const BookQuoteSchema = z.object({
  projectName: z.string().min(1),
  advancePaidPaise: z.number().int().min(0).default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BookQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify quote belongs to tenant and has been accepted (acceptedAt is not null)
    const [quote] = await db
      .select({
        id: quotes.id,
        tenantId: quotes.tenantId,
        leadId: quotes.leadId,
        totalPaise: quotes.totalPaise,
        acceptedAt: quotes.acceptedAt,
        status: quotes.status,
      })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!quote.acceptedAt && quote.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Quote must be accepted before booking a project' },
        { status: 422 },
      );
    }

    const totalPaise = quote.totalPaise;

    // Step 1: Create project
    const [project] = await db
      .insert(projects)
      .values({
        tenantId: ctx.tenantId,
        name: input.projectName,
        leadId: quote.leadId,
        totalContractPaise: totalPaise,
        lifecycleStage: 'design_pending',
      })
      .returning();

    // Step 2: Seed 4 milestones with 10/40/40/10 split
    const m1Amount = Math.round(totalPaise * 0.10);
    const m2Amount = Math.round(totalPaise * 0.40);
    const m3Amount = Math.round(totalPaise * 0.40);
    const m4Amount = totalPaise - m1Amount - m2Amount - m3Amount;

    const milestoneRows = await db
      .insert(milestones)
      .values([
        {
          projectId: project.id,
          label: 'Advance Payment',
          pctOfTotal: 10,
          amountPaise: m1Amount,
          paymentStatus: (input.advancePaidPaise > 0 ? 'paid' : 'pending') as 'paid' | 'pending',
        },
        {
          projectId: project.id,
          label: 'Design Approval',
          pctOfTotal: 40,
          amountPaise: m2Amount,
          paymentStatus: 'pending',
        },
        {
          projectId: project.id,
          label: 'Before Handover',
          pctOfTotal: 40,
          amountPaise: m3Amount,
          paymentStatus: 'pending',
        },
        {
          projectId: project.id,
          label: 'Completion',
          pctOfTotal: 10,
          amountPaise: m4Amount,
          paymentStatus: 'pending',
        },
      ])
      .returning();

    // Step 3: Link quote to new project
    await db
      .update(quotes)
      .set({ projectId: project.id })
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    // Step 4: Update lead stage to 'booked' if lead exists
    if (quote.leadId) {
      await applyStageTransition(quote.leadId, ctx.tenantId, ctx.userId, 'booked');
    }

    return NextResponse.json({ data: { project, milestones: milestoneRows } }, { status: 201 });
  } catch (err) {
    console.error('[quotes/:id/book POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
