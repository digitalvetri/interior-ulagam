import { inngest } from '@/inngest/client';

export const quotePdf = inngest.createFunction(
  { id: 'quote-pdf', name: 'Generate Quote PDF' },
  { event: 'quote/pdf.requested' },
  async ({ event, step }) => {
    const { quoteId, tenantId } = event.data as { quoteId: string; tenantId: string };

    // TODO: generate PDF (Playwright headless Chromium or @react-pdf/renderer),
    //       upload to Supabase Storage, update quotes.pdfUrl, send via WhatsApp template
    await step.sleep('wait-before-generate', '1s');

    return { quoteId, tenantId, status: 'pdf-generation-stub' };
  },
);
