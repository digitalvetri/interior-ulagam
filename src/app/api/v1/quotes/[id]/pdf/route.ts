import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quotes, quoteLines, projects, leads, tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { renderQuotePdf } from '@/lib/pdf/quote';
import { extractBranding, extractTerms, extractValidityDays } from '@/lib/pdf/branding';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';

// GET /api/v1/quotes/[id]/pdf — return existing pdfUrl without regenerating
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [quote] = await db
      .select({ pdfUrl: quotes.pdfUrl })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, ctx.tenantId)))
      .limit(1);

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    return NextResponse.json({ data: { pdfUrl: quote.pdfUrl } });
  } catch (err) {
    console.error('[quotes/:id/pdf GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/quotes/[id]/pdf — generate PDF, upload to S3, return public URL
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: quoteId } = await params;

  try {
    // 1. Fetch quote with joined lead + project data — verify tenantId
    const [quote] = await db
      .select({
        id: quotes.id,
        tenantId: quotes.tenantId,
        quoteNumber: quotes.quoteNumber,
        version: quotes.version,
        subtotalPaise: quotes.subtotalPaise,
        gstPaise: quotes.gstPaise,
        totalPaise: quotes.totalPaise,
        termsText: quotes.termsText,
        createdAt: quotes.createdAt,
        projectName: projects.name,
        leadContactName: leads.contactName,
        leadContactPhone: leads.contactPhone,
        leadProjectLocation: leads.projectLocation,
      })
      .from(quotes)
      .leftJoin(projects, eq(quotes.projectId, projects.id))
      .leftJoin(leads, eq(quotes.leadId, leads.id))
      .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, ctx.tenantId)))
      .limit(1);

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    // 2. Fetch quote lines
    const lines = await db
      .select({
        room: quoteLines.room,
        item: quoteLines.item,
        description: quoteLines.description,
        qty: quoteLines.qty,
        unit: quoteLines.unit,
        clientRatePaise: quoteLines.clientRatePaise,
      })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId));

    // 3. Fetch tenant branding
    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    // 4. Build QuotePdfInput
    const quoteNumber = quote.quoteNumber ?? `QUO-${quoteId.slice(0, 8).toUpperCase()}`;
    const validityDays = extractValidityDays(tenant?.brandingJson);
    const issuedAt = new Date(quote.createdAt);
    const validUntil = new Date(issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
    const projectName =
      quote.projectName ??
      quote.leadContactName ??
      'Project';

    const buffer = await renderQuotePdf({
      quoteNumber,
      version: quote.version,
      issuedAt,
      validUntil,
      studio,
      client: {
        name: quote.leadContactName ?? 'Client',
        phone: quote.leadContactPhone ?? null,
        address: quote.leadProjectLocation ?? null,
      },
      project: { name: projectName },
      lines: lines.map((l) => ({
        room: l.room,
        item: l.item,
        description: l.description ?? null,
        unit: l.unit,
        qty: l.qty,
        clientRatePaise: l.clientRatePaise,
      })),
      subtotalPaise: quote.subtotalPaise,
      gstPaise: quote.gstPaise,
      totalPaise: quote.totalPaise,
      terms: quote.termsText ?? extractTerms(tenant?.brandingJson, 'quotation'),
    });

    // 5–6. Upload to QUOTES_BUCKET
    const key = `quotes/${quoteId}/${quoteNumber}.pdf`;
    await putObject({ bucket: QUOTES_BUCKET, key, body: buffer, contentType: 'application/pdf' });

    // 7. Build public URL
    const pdfUrl = getPublicUrl(QUOTES_BUCKET, key);

    // 8. Persist pdfUrl on the quote row
    await db
      .update(quotes)
      .set({ pdfUrl })
      .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: { pdfUrl } });
  } catch (err) {
    console.error('[quotes/:id/pdf POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
