import { and, eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { leads, projects, quoteLines, quotes, tenants } from '@/lib/db/schema';
import { renderQuotePdf, type QuotePdfLine } from '@/lib/pdf/quote';
import { getServiceClient } from '@/lib/supabase/service';
import { whatsapp } from '@/lib/whatsapp/send';

// Storage requirement: a private bucket named `quote-pdfs` must exist in
// Supabase Storage. The service-role client bypasses RLS to write into it;
// clients receive a signed URL via WhatsApp. See supabase/rls-policies.sql
// for the bucket setup note.
const BUCKET = 'quote-pdfs';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface QuotePdfRequestedData {
  quoteId: string;
  tenantId: string;
}

// NOTE — The /send route flips status to 'sent' before this function runs.
// If PDF generation exhausts all Inngest retries, the quote will remain
// 'sent' with a null pdfUrl. That's acceptable for MVP (the studio can
// re-trigger from the dashboard), but revisit if partial-failure rate grows.
export const quotePdf = inngest.createFunction(
  { id: 'quote-pdf', name: 'Generate Quote PDF' },
  { event: 'quote/pdf.requested' },
  async ({ event, step }) => {
    const { quoteId, tenantId } = event.data as QuotePdfRequestedData;

    // ── Step 1: Fetch quote + related context ─────────────────────────────
    const context = await step.run('fetch-quote-context', async () => {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

      if (!quote) return null;

      const [tenant] = await db
        .select({ name: tenants.name, gstin: tenants.gstin })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      const [project] = await db
        .select({ name: projects.name, leadId: projects.leadId })
        .from(projects)
        .where(eq(projects.id, quote.projectId));

      let clientName = 'Client';
      let clientPhone: string | null = null;
      if (project?.leadId) {
        const [lead] = await db
          .select({
            contactName: leads.contactName,
            contactPhone: leads.contactPhone,
          })
          .from(leads)
          .where(eq(leads.id, project.leadId));
        if (lead) {
          clientName = lead.contactName;
          clientPhone = lead.contactPhone;
        }
      }

      const lineRows = await db
        .select({
          room: quoteLines.room,
          item: quoteLines.item,
          description: quoteLines.description,
          unit: quoteLines.unit,
          qty: quoteLines.qty,
          clientRatePaise: quoteLines.clientRatePaise,
        })
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, quoteId));

      return {
        quoteNumber: `Q-${quote.id.slice(0, 8).toUpperCase()}`,
        version: quote.version,
        issuedAtIso: (quote.sentAt ?? quote.createdAt).toISOString(),
        studio: {
          name: tenant?.name ?? 'Studio',
          gstin: tenant?.gstin ?? null,
        },
        project: { name: project?.name || 'Project' },
        client: { name: clientName, phone: clientPhone },
        lines: lineRows as QuotePdfLine[],
        subtotalPaise: quote.subtotalPaise,
        gstPaise: quote.gstPaise,
        totalPaise: quote.totalPaise,
      };
    });

    if (!context) {
      return { result: 'quote_not_found' } as const;
    }

    // ── Step 2: Render PDF + upload to Supabase Storage ───────────────────
    const uploaded = await step.run('render-and-upload', async () => {
      const pdfBuffer = await renderQuotePdf({
        quoteNumber: context.quoteNumber,
        version: context.version,
        issuedAt: new Date(context.issuedAtIso),
        studio: context.studio,
        client: context.client,
        project: context.project,
        lines: context.lines,
        subtotalPaise: context.subtotalPaise,
        gstPaise: context.gstPaise,
        totalPaise: context.totalPaise,
      });

      const path = `${tenantId}/${quoteId}-v${context.version}.pdf`;
      const supabase = getServiceClient();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) {
        throw new Error(
          `Signed URL failed: ${signError?.message ?? 'unknown'}`,
        );
      }

      return { path, url: signed.signedUrl };
    });

    // ── Step 3: Persist pdfUrl on the quote ───────────────────────────────
    await step.run('save-pdf-url', async () => {
      await db
        .update(quotes)
        .set({ pdfUrl: uploaded.url })
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
    });

    // ── Step 4: WhatsApp the PDF to the client (best-effort) ──────────────
    const delivery = await step.run('send-whatsapp', async () => {
      if (!context.client.phone) {
        return { sent: false, reason: 'no_client_phone' } as const;
      }

      const filename = `${context.quoteNumber}.pdf`;
      const caption =
        `Hello ${context.client.name},\n\n` +
        `Please find the quotation for ${context.project.name} attached.\n` +
        `Reply here if anything needs adjustment.\n\n` +
        `— ${context.studio.name}`;

      const { messageId } = await whatsapp.send({
        type: 'document',
        to: context.client.phone,
        link: uploaded.url,
        filename,
        caption,
      });

      await db
        .update(quotes)
        .set({ waMessageId: messageId })
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

      return { sent: true, messageId } as const;
    });

    return {
      result: 'complete',
      quoteId,
      pdfPath: uploaded.path,
      pdfUrl: uploaded.url,
      delivery,
    };
  },
);
