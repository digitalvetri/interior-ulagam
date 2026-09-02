import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { quotes, quoteLines, projects, customers, tenants, leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderQuotePdf, type QuotePdfInput } from '@/lib/pdf/quote';
import { extractBranding, extractTerms, extractValidityDays } from '@/lib/pdf/branding';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';
import { whatsapp } from '@/lib/whatsapp/send';

interface QuoteData extends QuotePdfInput {
  clientPhone: string | null;
  quoteVersion: number;
}

export const quotePdf = defineJob(
  { id: 'quote-pdf', name: 'Generate Quote PDF' },
  { event: 'quote/pdf.requested' },
  async ({ event, step }) => {
    const { quoteId, tenantId } = event.data as { quoteId: string; tenantId: string };

    const quoteData = await step.run('fetch-quote-data', async (): Promise<QuoteData> => {
      const [quote] = await db
        .select({
          id:            quotes.id,
          version:       quotes.version,
          projectId:     quotes.projectId,
          leadId:        quotes.leadId,
          subtotalPaise: quotes.subtotalPaise,
          gstPaise:      quotes.gstPaise,
          totalPaise:    quotes.totalPaise,
          createdAt:     quotes.createdAt,
        })
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
        .limit(1);

      if (!quote) throw new Error(`Quote ${quoteId} not found for tenant ${tenantId}`);

      const project = quote.projectId
        ? (await db
            .select({ name: projects.name, customerId: projects.customerId })
            .from(projects)
            .where(eq(projects.id, quote.projectId))
            .limit(1))[0]
        : undefined;

      const lines = await db
        .select({
          room:            quoteLines.room,
          item:            quoteLines.item,
          description:     quoteLines.description,
          unit:            quoteLines.unit,
          qty:             quoteLines.qty,
          clientRatePaise: quoteLines.clientRatePaise,
        })
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, quoteId));

      let clientName = 'Valued Client';
      let clientPhone: string | null = null;
      let clientAddress: string | null = null;

      if (project?.customerId) {
        const [customer] = await db
          .select({ fullName: customers.fullName, phone: customers.phone, address: customers.address })
          .from(customers)
          .where(eq(customers.id, project.customerId))
          .limit(1);
        if (customer) {
          clientName = customer.fullName;
          clientPhone = customer.phone;
          clientAddress = customer.address;
        }
      } else if (quote.leadId) {
        const [lead] = await db
          .select({ contactName: leads.contactName, contactPhone: leads.contactPhone })
          .from(leads)
          .where(eq(leads.id, quote.leadId))
          .limit(1);
        if (lead) {
          clientName = lead.contactName;
          clientPhone = lead.contactPhone;
        }
      }

      const [tenant] = await db
        .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
      const terms = extractTerms(tenant?.brandingJson, 'quotation');
      const validityDays = extractValidityDays(tenant?.brandingJson);
      const issuedAt = new Date(quote.createdAt);
      const validUntil = new Date(issuedAt);
      validUntil.setDate(validUntil.getDate() + validityDays);

      return {
        quoteNumber:   `QUO-${quoteId.slice(-6).toUpperCase()}`,
        version:       quote.version,
        issuedAt,
        validUntil,
        studio,
        client:        { name: clientName, phone: clientPhone, address: clientAddress },
        project:       { name: project?.name ?? 'Estimate' },
        lines,
        subtotalPaise: quote.subtotalPaise,
        gstPaise:      quote.gstPaise,
        totalPaise:    quote.totalPaise,
        terms,
        clientPhone,
        quoteVersion:  quote.version,
      };
    });

    const pdfUrl = await step.run('render-and-upload', async (): Promise<string> => {
      const buffer = await renderQuotePdf({
        ...quoteData,
        issuedAt: new Date(quoteData.issuedAt),
        validUntil: quoteData.validUntil ? new Date(quoteData.validUntil) : null,
      });

      const storagePath = `${tenantId}/${quoteId}-v${quoteData.quoteVersion}.pdf`;
      await putObject({
        bucket: QUOTES_BUCKET,
        key: storagePath,
        body: buffer,
        contentType: 'application/pdf',
      });

      return getPublicUrl(QUOTES_BUCKET, storagePath);
    });

    await step.run('update-quote-record', async () => {
      await db
        .update(quotes)
        .set({ pdfUrl, sentAt: new Date() })
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
    });

    const waResult = await step.run('notify-client-whatsapp', async () => {
      if (!quoteData.clientPhone) return { skipped: 'no-phone' };

      const [existing] = await db
        .select({ waMessageId: quotes.waMessageId })
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
        .limit(1);
      if (existing?.waMessageId) {
        return { skipped: 'already-sent', messageId: existing.waMessageId };
      }
      if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return { skipped: 'missing-whatsapp-env' };
      }

      try {
        const { messageId } = await whatsapp.send({
          type:        'document',
          to:          quoteData.clientPhone,
          documentUrl: pdfUrl,
          filename:    `Quote-${quoteData.quoteNumber}.pdf`,
          caption:
            `Hi ${quoteData.client.name}, your interior design quotation from ` +
            `${quoteData.studio.name} is ready.\n\n` +
            `Total: ₹${(quoteData.totalPaise / 100).toLocaleString('en-IN')}\n\n` +
            `Please review and let us know if you have any questions.`,
        });

        await db
          .update(quotes)
          .set({ waMessageId: messageId })
          .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

        return { sent: true, messageId, to: quoteData.clientPhone };
      } catch (err) {
        console.error('[quote-pdf] WhatsApp send failed:', err);
        return { skipped: 'send-error', error: String(err) };
      }
    });

    return { quoteId, pdfUrl, waResult, status: 'complete' };
  },
);
