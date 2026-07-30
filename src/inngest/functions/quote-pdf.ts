import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { quotes, quoteLines, projects, customers, tenants, leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderQuotePdf, type QuotePdfInput } from '@/lib/pdf/quote';
import { getServiceClient } from '@/lib/supabase/service';
import { whatsapp } from '@/lib/whatsapp/send';

// ── Internal step-return type (extends QuotePdfInput with extras for step 4) ─
interface QuoteData extends QuotePdfInput {
  clientPhone: string | null;
  quoteVersion: number;
}

export const quotePdf = inngest.createFunction(
  { id: 'quote-pdf', name: 'Generate Quote PDF' },
  { event: 'quote/pdf.requested' },
  async ({ event, step }) => {
    const { quoteId, tenantId } = event.data as { quoteId: string; tenantId: string };

    // ── Step 1: Fetch everything needed to render the PDF ────────────────────
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
      } else if (quote.leadId) {
        // Lead-linked pre-sale quote — use lead contact details
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
        .select({ name: tenants.name, gstin: tenants.gstin })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return {
        quoteNumber:   `QUO-${quoteId.slice(-6).toUpperCase()}`,
        version:       quote.version,
        issuedAt:      new Date(quote.createdAt),
        studio:        { name: tenant?.name ?? 'Interior Studio', gstin: tenant?.gstin ?? null },
        client:        { name: clientName, phone: clientPhone },
        project:       { name: project?.name ?? 'Estimate' },
        lines,
        subtotalPaise: quote.subtotalPaise,
        gstPaise:      quote.gstPaise,
        totalPaise:    quote.totalPaise,
        clientPhone,
        quoteVersion:  quote.version,
      };
    });

    // ── Step 2: Render PDF + upload (combined to avoid serialising a Buffer) ─
    const pdfUrl = await step.run('render-and-upload', async (): Promise<string> => {
      const buffer = await renderQuotePdf({
        ...quoteData,
        issuedAt: new Date(quoteData.issuedAt),
      });

      const supabase = getServiceClient();
      const storagePath = `${tenantId}/${quoteId}-v${quoteData.quoteVersion}.pdf`;

      // Suppress "already exists" — bucket is created once; this is a no-op after that
      await supabase.storage
        .createBucket('quotes', { public: true, fileSizeLimit: 10_485_760 })
        .catch(() => {});

      const { error: uploadError } = await supabase.storage
        .from('quotes')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('quotes')
        .getPublicUrl(storagePath);

      return publicUrl;
    });

    // ── Step 3: Persist the PDF URL and mark as sent ─────────────────────────
    await step.run('update-quote-record', async () => {
      await db
        .update(quotes)
        .set({ pdfUrl, sentAt: new Date() })
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
    });

    // ── Step 4: Notify client via WhatsApp (best-effort — never fails the job)
    //    Document messages only deliver inside the 24h customer-service window.
    //    Proactive sends outside that window require a registered template with
    //    a document header. Register one and swap the send type when creds land.
    const waResult = await step.run('notify-client-whatsapp', async () => {
      if (!quoteData.clientPhone) return { skipped: 'no-phone' };
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

        // Persist WA message ID for delivery tracking
        await db
          .update(quotes)
          .set({ waMessageId: messageId })
          .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

        return { sent: true, messageId, to: quoteData.clientPhone };
      } catch (err) {
        console.error('[quote-pdf] WhatsApp send failed (likely outside 24h window):', err);
        return { skipped: 'send-error', error: String(err) };
      }
    });

    return { quoteId, pdfUrl, waResult, status: 'complete' };
  },
);
