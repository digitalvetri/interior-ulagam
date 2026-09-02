import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { payments, invoices, projects, customers, tenants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderReceiptPdf } from '@/lib/pdf/receipt';
import { extractBranding } from '@/lib/pdf/branding';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';

export const receiptPdf = defineJob(
  { id: 'receipt-pdf', name: 'Generate Payment Receipt PDF' },
  { event: 'receipt/pdf.requested' },
  async ({ event, step }) => {
    const { paymentId, tenantId } = event.data as { paymentId: string; tenantId: string };

    const receiptData = await step.run('fetch-payment-data', async () => {
      const [payment] = await db
        .select({
          id:                payments.id,
          invoiceId:         payments.invoiceId,
          amountPaise:       payments.amountPaise,
          razorpayPaymentId: payments.razorpayPaymentId,
          razorpayLinkId:    payments.razorpayLinkId,
          reconciledAt:      payments.reconciledAt,
          createdAt:         payments.createdAt,
        })
        .from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
        .limit(1);

      if (!payment) throw new Error(`Payment ${paymentId} not found`);

      const [invoice] = await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate:   invoices.invoiceDate,
          projectId:     invoices.projectId,
        })
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId))
        .limit(1);

      if (!invoice) throw new Error(`Invoice for payment ${paymentId} not found`);

      const [project] = await db
        .select({ name: projects.name, customerId: projects.customerId })
        .from(projects)
        .where(eq(projects.id, invoice.projectId))
        .limit(1);

      let clientName = 'Valued Client';
      let clientPhone: string | null = null;

      if (project?.customerId) {
        const [customer] = await db
          .select({ fullName: customers.fullName, phone: customers.phone })
          .from(customers)
          .where(eq(customers.id, project.customerId))
          .limit(1);
        if (customer) {
          clientName = customer.fullName;
          clientPhone = customer.phone;
        }
      }

      const [tenant] = await db
        .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const studio = extractBranding(tenant ?? { name: 'Interior Studio' });

      // Receipt number: REC-<last 6 of paymentId>
      const receiptNumber = `REC-${paymentId.slice(-6).toUpperCase()}`;

      const paymentDate = payment.reconciledAt ?? new Date(payment.createdAt);

      const paymentMode = payment.razorpayPaymentId ? 'Razorpay (Online)' : 'Manual';

      return {
        receiptNumber,
        paymentDate,
        studio,
        client: { name: clientName, phone: clientPhone },
        project: { name: project?.name ?? 'Project' },
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate),
        amountPaise: payment.amountPaise,
        paymentMode,
        referenceId: payment.razorpayPaymentId ?? payment.razorpayLinkId,
        clientPhone,
      };
    });

    const pdfUrl = await step.run('render-and-upload', async (): Promise<string> => {
      const buffer = await renderReceiptPdf({
        ...receiptData,
        paymentDate: new Date(receiptData.paymentDate),
        invoiceDate: new Date(receiptData.invoiceDate),
      });

      const storagePath = `${tenantId}/${paymentId}-receipt.pdf`;
      await putObject({
        bucket: QUOTES_BUCKET,
        key: storagePath,
        body: buffer,
        contentType: 'application/pdf',
      });

      return getPublicUrl(QUOTES_BUCKET, storagePath);
    });

    await step.run('update-payment-record', async () => {
      await db
        .update(payments)
        .set({ pdfUrl })
        .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));
    });

    return { paymentId, pdfUrl, status: 'complete' };
  },
);
