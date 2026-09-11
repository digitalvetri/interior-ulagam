import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices, projects, leads, tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { renderInvoicePdf } from '@/lib/pdf/invoice';
import type { HsnLine } from '@/lib/pdf/invoice';
import { extractBranding, extractTerms } from '@/lib/pdf/branding';
import { putObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

// POST /api/v1/invoices/[id]/pdf — generate PDF, upload to S3, return presigned URL
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: invoiceId } = await params;

  try {
    // 1. Fetch invoice with project and lead for client info
    const [invoice] = await db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        hsnSacLinesJson: invoices.hsnSacLinesJson,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise: invoices.cgstPaise,
        sgstPaise: invoices.sgstPaise,
        igstPaise: invoices.igstPaise,
        isInterstate: invoices.isInterstate,
        placeOfSupply: invoices.placeOfSupply,
        projectName: projects.name,
        leadContactName: leads.contactName,
        leadContactPhone: leads.contactPhone,
        leadContactEmail: leads.contactEmail,
        leadProjectLocation: leads.projectLocation,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // 2. Fetch tenant branding
    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    // 3. Cast JSONB lines — hsnSacLinesJson is stored as HsnLine[]
    const rawLines = Array.isArray(invoice.hsnSacLinesJson)
      ? (invoice.hsnSacLinesJson as HsnLine[])
      : [];

    const studio = extractBranding(tenant ?? { name: 'Konst Design' });

    // 4. Render PDF buffer
    const buffer = await renderInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      studio,
      client: {
        name: invoice.leadContactName ?? invoice.projectName ?? 'Client',
        phone: invoice.leadContactPhone ?? null,
        address: invoice.leadProjectLocation ?? null,
      },
      project: { name: invoice.projectName ?? 'Project' },
      lines: rawLines,
      subtotalPaise: invoice.subtotalPaise,
      cgstPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      totalPaise: invoice.subtotalPaise + invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise,
      isInterstate: invoice.isInterstate,
      placeOfSupply: invoice.placeOfSupply ?? null,
      terms: extractTerms(tenant?.brandingJson, 'invoice'),
    });

    // 5. Upload to private DOCUMENTS_BUCKET
    const key = `invoices/${invoiceId}.pdf`;
    await putObject({ bucket: DOCUMENTS_BUCKET, key, body: buffer, contentType: 'application/pdf' });

    // 6. Persist the S3 key (not the presigned URL — presigned expires)
    await db
      .update(invoices)
      .set({ pdfUrl: key })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)));

    // 7. Return a short-lived presigned URL — inline so the browser previews, not downloads
    const presignedUrl = await getDownloadUrl({
      bucket: DOCUMENTS_BUCKET,
      key,
      expiresIn: 60,
      inline: true,
    });

    return NextResponse.json({ data: { pdfUrl: presignedUrl } });
  } catch (err) {
    console.error('[invoices/:id/pdf POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/v1/invoices/[id]/pdf — return a fresh presigned URL for an already-generated PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: invoiceId } = await params;

  try {
    const [invoice] = await db
      .select({ pdfUrl: invoices.pdfUrl })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (!invoice.pdfUrl) {
      return NextResponse.json({ error: 'PDF not yet generated — use POST to generate' }, { status: 404 });
    }

    const presignedUrl = await getDownloadUrl({
      bucket: DOCUMENTS_BUCKET,
      key: invoice.pdfUrl,
      expiresIn: 60,
      inline: true,
    });

    return NextResponse.json({ data: { pdfUrl: presignedUrl } });
  } catch (err) {
    console.error('[invoices/:id/pdf GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
