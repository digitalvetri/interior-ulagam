import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { purchaseOrders, projects, vendors, tenants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderPurchaseOrderPdf, type POLine } from '@/lib/pdf/purchase-order';
import { extractBranding, extractTerms } from '@/lib/pdf/branding';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';

export const poPdf = defineJob(
  { id: 'po-pdf', name: 'Generate Purchase Order PDF' },
  { event: 'po/pdf.requested' },
  async ({ event, step }) => {
    const { poId, tenantId } = event.data as { poId: string; tenantId: string };

    const poData = await step.run('fetch-po-data', async () => {
      const [po] = await db
        .select({
          id:                  purchaseOrders.id,
          poNumber:            purchaseOrders.poNumber,
          projectId:           purchaseOrders.projectId,
          vendorId:            purchaseOrders.vendorId,
          linesJson:           purchaseOrders.linesJson,
          advancePaidPaise:    purchaseOrders.advancePaidPaise,
          expectedDeliveryAt:  purchaseOrders.expectedDeliveryAt,
          vendorPhone:         purchaseOrders.vendorPhone,
          vendorContactName:   purchaseOrders.vendorContactName,
          createdAt:           purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)))
        .limit(1);

      if (!po) throw new Error(`PO ${poId} not found`);

      const [project] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, po.projectId))
        .limit(1);

      let vendorName = po.vendorContactName ?? 'Vendor';
      let vendorPhone: string | null = po.vendorPhone;
      let vendorAddress: string | null = null;

      if (po.vendorId) {
        const [vendor] = await db
          .select({ name: vendors.name, phone: vendors.phone, address: vendors.address })
          .from(vendors)
          .where(eq(vendors.id, po.vendorId))
          .limit(1);
        if (vendor) {
          vendorName = vendor.name;
          vendorPhone = vendor.phone ?? vendorPhone;
          vendorAddress = vendor.address;
        }
      }

      const [tenant] = await db
        .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
      const terms = extractTerms(tenant?.brandingJson, 'po');

      // Parse linesJson — flexible JSONB structure
      const rawLines = Array.isArray(po.linesJson)
        ? (po.linesJson as Record<string, unknown>[])
        : [];
      const lines: POLine[] = rawLines.map((l) => ({
        item: typeof l.item === 'string' ? l.item : 'Material',
        description: typeof l.description === 'string' ? l.description : null,
        unit: typeof l.unit === 'string' ? l.unit : 'nos',
        qty: typeof l.qty === 'number' ? l.qty : 1,
        ratePaise: typeof l.ratePaise === 'number' ? l.ratePaise
          : typeof l.rate === 'number' ? l.rate * 100
          : 0,
        hsnSac: typeof l.hsnSac === 'string' ? l.hsnSac : null,
      }));

      const subtotalPaise = lines.reduce((s, l) => s + l.ratePaise * l.qty, 0);
      const balanceDuePaise = subtotalPaise - po.advancePaidPaise;

      return {
        poNumber: po.poNumber,
        issuedAt: new Date(po.createdAt),
        expectedDeliveryAt: po.expectedDeliveryAt ? new Date(po.expectedDeliveryAt) : null,
        studio,
        vendor: { name: vendorName, phone: vendorPhone, address: vendorAddress },
        project: { name: project?.name ?? 'Project' },
        lines,
        subtotalPaise,
        advancePaidPaise: po.advancePaidPaise,
        balanceDuePaise,
        terms,
      };
    });

    const pdfUrl = await step.run('render-and-upload', async (): Promise<string> => {
      const buffer = await renderPurchaseOrderPdf({
        ...poData,
        issuedAt: new Date(poData.issuedAt),
        expectedDeliveryAt: poData.expectedDeliveryAt ? new Date(poData.expectedDeliveryAt) : null,
      });

      const storagePath = `${tenantId}/${poId}-po.pdf`;
      await putObject({
        bucket: QUOTES_BUCKET,
        key: storagePath,
        body: buffer,
        contentType: 'application/pdf',
      });

      return getPublicUrl(QUOTES_BUCKET, storagePath);
    });

    await step.run('update-po-record', async () => {
      await db
        .update(purchaseOrders)
        .set({ pdfUrl })
        .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));
    });

    return { poId, pdfUrl, status: 'complete' };
  },
);
