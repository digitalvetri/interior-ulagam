import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { payments, invoices, projects, leads, tenants, customers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { renderReceiptPdf } from '@/lib/pdf/receipt';
import { extractBranding } from '@/lib/pdf/branding';
import { putObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

// POST /api/v1/payments/[id]/receipt — generate receipt PDF, store, return presigned URL
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { id: paymentId } = await params;

  try {
    // Works for payments without an invoice too: project and client come from the payment itself.
    const [row] = await db
      .select({
        id:                payments.id,
        amountPaise:       payments.amountPaise,
        razorpayPaymentId: payments.razorpayPaymentId,
        reconciledAt:      payments.reconciledAt,
        createdAt:         payments.createdAt,
        receivedAt:        payments.receivedAt,
        receiptNumber:     payments.receiptNumber,
        mode:              payments.mode,
        reference:         payments.reference,
        invoiceId:         payments.invoiceId,
        invoiceNumber:     invoices.invoiceNumber,
        invoiceDate:       invoices.invoiceDate,
        projectName:       projects.name,
        clientName:        sql<string | null>`coalesce(${customers.fullName}, ${leads.contactName})`,
        clientPhone:       sql<string | null>`coalesce(${customers.phone}, ${leads.contactPhone})`,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(projects, sql`${projects.id} = coalesce(${payments.projectId}, ${invoices.projectId})`)
      .leftJoin(customers, sql`${customers.id} = coalesce(${payments.customerId}, ${projects.customerId})`)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, ctx.tenantId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const studio = extractBranding(tenant ?? { name: 'Konst Design' });

    const paymentDate = row.receivedAt ?? row.reconciledAt ?? row.createdAt;
    const receiptNumber = row.receiptNumber ?? `REC-${row.id.slice(0, 8).toUpperCase()}`;
    const MODES: Record<string, string> = { upi: 'UPI', cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque', card: 'Card', razorpay: 'Razorpay' };

    const buffer = await renderReceiptPdf({
      receiptNumber,
      paymentDate,
      studio,
      client: { name: row.clientName ?? 'Client', phone: row.clientPhone ?? null },
      project: { name: row.projectName ?? 'Advance payment' },
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      amountPaise: row.amountPaise,
      paymentMode: row.mode ? MODES[row.mode] ?? row.mode : row.razorpayPaymentId ? 'Razorpay' : 'Manual',
      referenceId: row.razorpayPaymentId ?? row.reference ?? null,
    });

    const s3Key = `receipts/${ctx.tenantId}/${paymentId}.pdf`;
    await putObject({
      bucket: DOCUMENTS_BUCKET,
      key: s3Key,
      body: buffer,
      contentType: 'application/pdf',
    });

    await db
      .update(payments)
      .set({ pdfUrl: s3Key })
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, ctx.tenantId)));

    const presignedUrl = await getDownloadUrl({ bucket: DOCUMENTS_BUCKET, key: s3Key, expiresIn: 604800});
    return NextResponse.json({ data: { pdfUrl: presignedUrl } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/payments/:id/receipt]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/v1/payments/[id]/receipt — return presigned URL for stored receipt
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: paymentId } = await params;

  try {
    const [row] = await db
      .select({ pdfUrl: payments.pdfUrl })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, ctx.tenantId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (!row.pdfUrl) {
      return NextResponse.json({ error: 'Receipt not yet generated — use POST to generate' }, { status: 404 });
    }

    const presignedUrl = await getDownloadUrl({ bucket: DOCUMENTS_BUCKET, key: row.pdfUrl, expiresIn: 604800});
    return NextResponse.json({ data: { pdfUrl: presignedUrl } });
  } catch (err) {
    console.error('[GET /api/v1/payments/:id/receipt]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
