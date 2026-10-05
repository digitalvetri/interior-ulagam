import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quotes, quoteSections, quoteLines } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { requireUuid } from '@/lib/http';
import { eq, and, asc, max, or } from 'drizzle-orm';
import { recalculateQuoteTotals } from '@/lib/quotes/totals';
import { REVISABLE_QUOTE_STATUSES, isAcceptedQuoteStatus } from '@/lib/quotes/status';

class ReviseError extends Error {
  constructor(message: string, readonly status: number, readonly details?: Record<string, unknown>) { super(message); }
}

/**
 * POST /api/v1/quotes/[id]/revise — create version V+1 as a new draft.
 *
 * Only a sent or accepted quote can be revised (a draft is edited in place).
 * A quote can be revised once; the revision is the new head. A sent parent is
 * marked 'revised' straight away; an accepted parent stays the live contract
 * basis until the revision itself is accepted (see /approve and /accept).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.COMMERCIAL);
  if (denied) return denied;

  const { id } = await params;
  const badId = requireUuid(id);
  if (badId) return badId;

  try {
    const newId = await db.transaction(async (tx) => {
      // Lock the original so two clicks cannot create two V+1 drafts.
      const [original] = await tx
        .select({
          id: quotes.id,
          leadId: quotes.leadId,
          projectId: quotes.projectId,
          version: quotes.version,
          status: quotes.status,
          discountPaise: quotes.discountPaise,
          gstPct: quotes.gstPct,
          termsText: quotes.termsText,
          paymentTerms: quotes.paymentTerms,
        })
        .from(quotes)
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
        .for('update');

      if (!original) throw new ReviseError('Quote not found', 404);
      if (!(REVISABLE_QUOTE_STATUSES as readonly string[]).includes(original.status)) {
        throw new ReviseError(
          original.status === 'draft'
            ? 'A draft quote can be edited directly — revise it after it has been sent'
            : `A '${original.status}' quote cannot be revised`,
          422,
        );
      }

      const [existingChild] = await tx
        .select({ id: quotes.id, version: quotes.version })
        .from(quotes)
        .where(and(eq(quotes.parentQuoteId, original.id), eq(quotes.tenantId, ctx.tenantId)))
        .limit(1);
      if (existingChild) {
        throw new ReviseError(
          `Revision v${existingChild.version} already exists for this quote`,
          409,
          { quoteId: existingChild.id },
        );
      }

      // Next version across the whole family (same lead or project), so versions never collide.
      const family = or(
        original.leadId ? eq(quotes.leadId, original.leadId) : undefined,
        original.projectId ? eq(quotes.projectId, original.projectId) : undefined,
        eq(quotes.id, original.id),
      );
      const [{ top }] = await tx
        .select({ top: max(quotes.version) })
        .from(quotes)
        .where(and(eq(quotes.tenantId, ctx.tenantId), family));
      const nextVersion = Math.max(original.version, top ?? 0) + 1;

      const [newQuote] = await tx
        .insert(quotes)
        .values({
          tenantId: ctx.tenantId,
          leadId: original.leadId,
          projectId: original.projectId,
          parentQuoteId: original.id,
          version: nextVersion,
          status: 'draft',
          discountPaise: original.discountPaise,
          gstPct: original.gstPct,
          termsText: original.termsText,
          paymentTerms: original.paymentTerms,
          subtotalPaise: 0,
          gstPaise: 0,
          totalPaise: 0,
          marginPaise: 0,
          pdfUrl: null,
          sentAt: null,
          acceptedAt: null,
          approvedAt: null,
          createdBy: ctx.dbUserId ?? null,
        })
        .returning({ id: quotes.id });

      // Copy sections (old id → new id) and lines.
      const originalSections = await tx
        .select({ id: quoteSections.id, room: quoteSections.room, sortOrder: quoteSections.sortOrder })
        .from(quoteSections)
        .where(eq(quoteSections.quoteId, id))
        .orderBy(asc(quoteSections.sortOrder));

      const sectionIdMap = new Map<string, string>();
      for (const sec of originalSections) {
        const [newSec] = await tx
          .insert(quoteSections)
          .values({ quoteId: newQuote.id, room: sec.room, sortOrder: sec.sortOrder })
          .returning({ id: quoteSections.id });
        sectionIdMap.set(sec.id, newSec.id);
      }

      const originalLines = await tx
        .select({
          sectionId: quoteLines.sectionId, room: quoteLines.room, item: quoteLines.item,
          description: quoteLines.description, qty: quoteLines.qty, unit: quoteLines.unit,
          clientRatePaise: quoteLines.clientRatePaise, costRatePaise: quoteLines.costRatePaise,
          marginPaise: quoteLines.marginPaise, hsnSac: quoteLines.hsnSac, finish: quoteLines.finish,
          sortOrder: quoteLines.sortOrder, materialId: quoteLines.materialId,
        })
        .from(quoteLines)
        .where(and(eq(quoteLines.quoteId, id), eq(quoteLines.tenantId, ctx.tenantId)));

      if (originalLines.length > 0) {
        await tx.insert(quoteLines).values(
          originalLines.map((line) => ({
            ...line,
            tenantId: ctx.tenantId,
            quoteId: newQuote.id,
            sectionId: line.sectionId ? (sectionIdMap.get(line.sectionId) ?? null) : null,
          })),
        );
      }

      await recalculateQuoteTotals(newQuote.id, tx);

      // A sent (not yet accepted) quote is superseded right away.
      if (!isAcceptedQuoteStatus(original.status)) {
        await tx.update(quotes).set({ status: 'revised' })
          .where(and(eq(quotes.id, original.id), eq(quotes.tenantId, ctx.tenantId)));
      }

      return newQuote.id;
    });

    const [refreshed] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, newId), eq(quotes.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: refreshed }, { status: 201 });
  } catch (err) {
    if (err instanceof ReviseError) {
      return NextResponse.json(
        { error: err.message, ...(err.details ? { details: err.details } : {}) },
        { status: err.status },
      );
    }
    console.error('[quotes/:id/revise POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
