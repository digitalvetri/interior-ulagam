import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, quoteLines, projects, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const UpdateQuoteSchema = z
  .object({
    status: z.enum(['draft', 'sent', 'approved', 'revised']).optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [quote] = await db
      .select({
        id: quotes.id,
        tenantId: quotes.tenantId,
        projectId: quotes.projectId,
        leadId: quotes.leadId,
        version: quotes.version,
        status: quotes.status,
        subtotalPaise: quotes.subtotalPaise,
        gstPaise: quotes.gstPaise,
        totalPaise: quotes.totalPaise,
        pdfUrl: quotes.pdfUrl,
        sentAt: quotes.sentAt,
        approvedAt: quotes.approvedAt,
        createdBy: quotes.createdBy,
        createdAt: quotes.createdAt,
        projectName: projects.name,
        leadContactName: leads.contactName,
        leadContactPhone: leads.contactPhone,
        leadStage: leads.stage,
        leadBudgetBand: leads.budgetBand,
      })
      .from(quotes)
      .leftJoin(projects, eq(quotes.projectId, projects.id))
      .leftJoin(leads, eq(quotes.leadId, leads.id))
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const lines = await db
      .select({
        id: quoteLines.id,
        quoteId: quoteLines.quoteId,
        room: quoteLines.room,
        item: quoteLines.item,
        description: quoteLines.description,
        qty: quoteLines.qty,
        unit: quoteLines.unit,
        clientRatePaise: quoteLines.clientRatePaise,
        costRatePaise: quoteLines.costRatePaise,
        marginPaise: quoteLines.marginPaise,
        hsnSac: quoteLines.hsnSac,
        materialId: quoteLines.materialId,
        createdAt: quoteLines.createdAt,
      })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id));

    return NextResponse.json({ data: { ...quote, lines } });
  } catch (err) {
    console.error('[quotes/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Fetch quote to check ownership and draft status
    const [existing] = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotes can be updated via this endpoint' },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(quotes)
      .set(input)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated, message: 'Quote updated' });
  } catch (err) {
    console.error('[quotes/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
