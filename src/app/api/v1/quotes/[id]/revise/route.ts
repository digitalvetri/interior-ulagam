import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes, quoteSections, quoteLines } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';
import { recalculateQuoteTotals } from '@/lib/quotes/totals';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    // Verify original quote belongs to tenant
    const [original] = await db
      .select({
        id: quotes.id,
        tenantId: quotes.tenantId,
        leadId: quotes.leadId,
        projectId: quotes.projectId,
        version: quotes.version,
        discountPaise: quotes.discountPaise,
        gstPct: quotes.gstPct,
        termsText: quotes.termsText,
        createdBy: quotes.createdBy,
      })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)));

    if (!original) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Step 1: Create new quote (reset computed + transient fields)
    const [newQuote] = await db
      .insert(quotes)
      .values({
        tenantId: ctx.tenantId,
        leadId: original.leadId,
        projectId: original.projectId,
        parentQuoteId: original.id,
        version: original.version + 1,
        status: 'draft',
        discountPaise: original.discountPaise,
        gstPct: original.gstPct,
        termsText: original.termsText,
        subtotalPaise: 0,
        gstPaise: 0,
        totalPaise: 0,
        marginPaise: 0,
        pdfUrl: null,
        sentAt: null,
        acceptedAt: null,
        approvedAt: null,
        createdBy: ctx.userId,
      })
      .returning();

    // Step 2: Copy all sections (old id → new id mapping)
    const originalSections = await db
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.quoteId, id))
      .orderBy(asc(quoteSections.sortOrder));

    const sectionIdMap = new Map<string, string>();
    for (const sec of originalSections) {
      const [newSec] = await db
        .insert(quoteSections)
        .values({
          quoteId: newQuote.id,
          room: sec.room,
          sortOrder: sec.sortOrder,
        })
        .returning({ id: quoteSections.id });
      sectionIdMap.set(sec.id, newSec.id);
    }

    // Step 3: Copy all lines, mapping old sectionId → new sectionId
    const originalLines = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id));

    if (originalLines.length > 0) {
      await db.insert(quoteLines).values(
        originalLines.map((line) => ({
          quoteId: newQuote.id,
          sectionId: line.sectionId ? (sectionIdMap.get(line.sectionId) ?? null) : null,
          room: line.room,
          item: line.item,
          description: line.description,
          qty: line.qty,
          unit: line.unit,
          clientRatePaise: line.clientRatePaise,
          costRatePaise: line.costRatePaise,
          marginPaise: line.marginPaise,
          hsnSac: line.hsnSac,
          finish: line.finish,
          sortOrder: line.sortOrder,
          materialId: line.materialId,
        })),
      );
    }

    // Step 4: Recalculate totals on the new quote
    await recalculateQuoteTotals(newQuote.id);

    // Fetch fresh with computed totals
    const [refreshed] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, newQuote.id));

    return NextResponse.json({ data: refreshed }, { status: 201 });
  } catch (err) {
    console.error('[quotes/:id/revise POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
