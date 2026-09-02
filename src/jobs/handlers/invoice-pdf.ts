import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { invoices, projects, customers, tenants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderInvoicePdf, type HsnLine } from '@/lib/pdf/invoice';
import { extractBranding, extractTerms } from '@/lib/pdf/branding';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';

export const invoicePdf = defineJob(
  { id: 'invoice-pdf', name: 'Generate Invoice PDF' },
  { event: 'invoice/pdf.requested' },
  async ({ event, step }) => {
    const { invoiceId, tenantId } = event.data as { invoiceId: string; tenantId: string };

    const invoiceData = await step.run('fetch-invoice-data', async () => {
      const [invoice] = await db
        .select({
          id:              invoices.id,
          invoiceNumber:   invoices.invoiceNumber,
          invoiceDate:     invoices.invoiceDate,
          projectId:       invoices.projectId,
          hsnSacLinesJson: invoices.hsnSacLinesJson,
          subtotalPaise:   invoices.subtotalPaise,
          cgstPaise:       invoices.cgstPaise,
          sgstPaise:       invoices.sgstPaise,
          igstPaise:       invoices.igstPaise,
          isInterstate:    invoices.isInterstate,
          placeOfSupply:   invoices.placeOfSupply,
        })
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .limit(1);

      if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

      const [project] = await db
        .select({ name: projects.name, customerId: projects.customerId })
        .from(projects)
        .where(eq(projects.id, invoice.projectId))
        .limit(1);

      let clientName = 'Valued Client';
      let clientPhone: string | null = null;

      if (project?.customerId) {
        const [customer] = await db
          .select({ fullName: customers.fullName, phone: customers.phone, address: customers.address })
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
      const terms = extractTerms(tenant?.brandingJson, 'invoice');
      const totalPaise = invoice.subtotalPaise + invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;

      // hsnSacLinesJson may be an array of { hsnSac?, description, amountPaise, ... }
      const rawLines = Array.isArray(invoice.hsnSacLinesJson)
        ? (invoice.hsnSacLinesJson as Record<string, unknown>[])
        : [];
      const lines: HsnLine[] = rawLines.map((l) => ({
        hsnSac: typeof l.hsnSac === 'string' ? l.hsnSac : null,
        description: typeof l.description === 'string' ? l.description : 'Interior Design Services',
        amountPaise: typeof l.amountPaise === 'number' ? l.amountPaise : invoice.subtotalPaise,
        cgstPaise: typeof l.cgstPaise === 'number' ? l.cgstPaise : undefined,
        sgstPaise: typeof l.sgstPaise === 'number' ? l.sgstPaise : undefined,
        igstPaise: typeof l.igstPaise === 'number' ? l.igstPaise : undefined,
      }));

      // If no line items stored, synthesise one summary line
      if (lines.length === 0) {
        lines.push({
          hsnSac: '9954',
          description: `Interior Design Works — ${project?.name ?? 'Project'}`,
          amountPaise: invoice.subtotalPaise,
          cgstPaise: invoice.cgstPaise,
          sgstPaise: invoice.sgstPaise,
          igstPaise: invoice.igstPaise,
        });
      }

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate),
        studio,
        client: { name: clientName, phone: clientPhone },
        project: { name: project?.name ?? 'Project' },
        lines,
        subtotalPaise: invoice.subtotalPaise,
        cgstPaise: invoice.cgstPaise,
        sgstPaise: invoice.sgstPaise,
        igstPaise: invoice.igstPaise,
        totalPaise,
        isInterstate: invoice.isInterstate,
        placeOfSupply: invoice.placeOfSupply,
        terms,
        clientPhone,
      };
    });

    const pdfUrl = await step.run('render-and-upload', async (): Promise<string> => {
      const buffer = await renderInvoicePdf({
        ...invoiceData,
        invoiceDate: new Date(invoiceData.invoiceDate),
      });

      const storagePath = `${tenantId}/${invoiceId}-invoice.pdf`;
      await putObject({
        bucket: QUOTES_BUCKET,
        key: storagePath,
        body: buffer,
        contentType: 'application/pdf',
      });

      return getPublicUrl(QUOTES_BUCKET, storagePath);
    });

    await step.run('update-invoice-record', async () => {
      await db
        .update(invoices)
        .set({ pdfUrl })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
    });

    return { invoiceId, pdfUrl, status: 'complete' };
  },
);
