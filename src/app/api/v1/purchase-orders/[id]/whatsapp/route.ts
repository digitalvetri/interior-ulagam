import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purchaseOrders, vendors, projects, tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { renderPurchaseOrderPdf } from '@/lib/pdf/purchase-order';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';
import { whatsapp } from '@/lib/whatsapp/send';

type BrandingJson = {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIFSC?: string | null;
  bankUPI?: string | null;
  poTerms?: string | null;
};

type RawLine = {
  description?: string;
  item?: string;
  qty?: number;
  unit?: string;
  unitRatePaise?: number;
  ratePaise?: number;
  totalPaise?: number;
  hsnSac?: string | null;
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const vendorPhone = po.vendorPhone;
  if (!vendorPhone) {
    return NextResponse.json(
      { error: 'No vendor phone number on this order. Add a vendor with a phone number first.' },
      { status: 422 },
    );
  }

  const [tenantRow, vendorRow, projectRow] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).then(r => r[0] ?? null),
    po.vendorId
      ? db.select().from(vendors).where(eq(vendors.id, po.vendorId)).then(r => r[0] ?? null)
      : null,
    po.projectId
      ? db.select().from(projects).where(eq(projects.id, po.projectId)).then(r => r[0] ?? null)
      : null,
  ]);

  const branding = (tenantRow?.brandingJson ?? {}) as BrandingJson;
  const rawLines = (Array.isArray(po.linesJson) ? po.linesJson : []) as RawLine[];

  const lines = rawLines.map(l => ({
    item: l.description ?? l.item ?? '—',
    unit: l.unit ?? 'nos',
    qty: l.qty ?? 0,
    ratePaise: l.unitRatePaise ?? l.ratePaise ?? 0,
    hsnSac: l.hsnSac ?? null,
  }));

  const subtotalPaise = lines.reduce((s, l) => s + l.ratePaise * l.qty, 0);
  const advancePaise  = po.advancePaidPaise ?? 0;
  const balancePaise  = Math.max(0, subtotalPaise - advancePaise);

  try {
    const pdfBuffer = await renderPurchaseOrderPdf({
      poNumber: po.poNumber,
      issuedAt: po.createdAt,
      expectedDeliveryAt: po.expectedDeliveryAt ?? null,
      studio: {
        name: tenantRow?.name ?? 'Studio',
        address: branding.address,
        phone: branding.phone,
        email: branding.email,
        logoUrl: branding.logoUrl,
        bankName: branding.bankName,
        bankAccount: branding.bankAccount,
        bankIFSC: branding.bankIFSC,
        bankUPI: branding.bankUPI,
      },
      vendor: {
        name: vendorRow?.name ?? po.vendorContactName ?? 'Vendor',
        phone: vendorRow?.phone ?? vendorPhone,
        address: vendorRow?.address ?? null,
        gstin: vendorRow?.gstin ?? null,
      },
      project: { name: projectRow?.name ?? 'Project' },
      lines,
      subtotalPaise,
      advancePaidPaise: advancePaise,
      balanceDuePaise: balancePaise,
      terms: branding.poTerms ?? null,
    });

    // Upload PDF to public quotes bucket
    const key = `purchase-orders/${id}/${po.poNumber}.pdf`;
    await putObject({ bucket: QUOTES_BUCKET, key, body: pdfBuffer, contentType: 'application/pdf' });
    const pdfUrl = getPublicUrl(QUOTES_BUCKET, key);

    // Store pdfUrl on the PO row
    await db
      .update(purchaseOrders)
      .set({ pdfUrl })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    // Send via WhatsApp
    const phone = vendorPhone.replace(/\D/g, ''); // strip non-digits
    const { messageId } = await whatsapp.send({
      type: 'document',
      to: phone,
      documentUrl: pdfUrl,
      filename: `${po.poNumber}.pdf`,
      caption: `Purchase Order ${po.poNumber}${projectRow ? ` — ${projectRow.name}` : ''}`,
    });

    // Store message ID on the PO row
    await db
      .update(purchaseOrders)
      .set({ waMessageId: messageId })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    return NextResponse.json({ ok: true, messageId, pdfUrl });
  } catch (err) {
    console.error('[purchase-orders/:id/whatsapp POST]', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
