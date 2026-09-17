import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purchaseOrders, vendors, projects, tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { renderPurchaseOrderPdf } from '@/lib/pdf/purchase-order';

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
  id?: string;
  description?: string;
  item?: string;
  qty?: number;
  unit?: string;
  unitRatePaise?: number;
  ratePaise?: number;
  totalPaise?: number;
  hsnSac?: string | null;
};

export async function GET(
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
        phone: vendorRow?.phone ?? po.vendorPhone ?? null,
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

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${po.poNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[purchase-orders/:id/pdf GET]', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
