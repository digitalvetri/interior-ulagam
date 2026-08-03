import { and, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { purchaseOrders } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';

// NOTE — Vendor ACK webhook integration:
// When a vendor replies 'CONFIRMED', 'confirmed', or 'ok' via WhatsApp, the
// inbound webhook (src/app/api/webhooks/whatsapp/route.ts) should:
//   1. Look up the most recent purchaseOrder in status 'sent' for vendorPhone
//      matching the sender's phone number.
//   2. Enqueue 'po/acknowledged' with { poId, tenantId }
//      which will update the PO status to 'acknowledged' and cancel any pending
//      follow-up sequence.

interface POSentEventData {
  poId: string;
  tenantId: string;
}

interface FetchedPO {
  id: string;
  tenantId: string;
  poNumber: string;
  status: 'draft' | 'sent' | 'acknowledged' | 'partial' | 'complete' | 'cancelled';
  vendorPhone: string | null;
  vendorContactName: string | null;
  expectedDeliveryAt: string | null; // formatted for display — safe across step boundary
}

export const vendorPOWhatsApp = defineJob(
  {
    id: 'vendor-po-whatsapp',
    name: 'Vendor PO WhatsApp Delivery',
    cancelOn: [
      {
        event: 'po/cancelled',
        // `async` is the trigger event data (po/sent); `event` is the cancel event data
        if: 'event.data.poId == async.data.poId',
      },
    ],
  },
  { event: 'po/sent' },
  async ({ event, step }) => {
    const { poId, tenantId } = event.data as POSentEventData;

    // ── Step 1: Fetch PO ───────────────────────────────────────────────────────
    const po = await step.run('fetch-po', async (): Promise<FetchedPO | null> => {
      const [row] = await db
        .select({
          id: purchaseOrders.id,
          tenantId: purchaseOrders.tenantId,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
          vendorPhone: purchaseOrders.vendorPhone,
          vendorContactName: purchaseOrders.vendorContactName,
          expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
        })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

      if (!row) return null;

      // Format the date here while it is a real Date object — Date objects do
      // not survive Inngest's JSON step-memoization boundary.
      const formattedDelivery = row.expectedDeliveryAt
        ? new Date(row.expectedDeliveryAt).toLocaleDateString('en-IN')
        : null;

      return {
        id: row.id,
        tenantId: row.tenantId,
        poNumber: row.poNumber,
        status: row.status,
        vendorPhone: row.vendorPhone,
        vendorContactName: row.vendorContactName,
        expectedDeliveryAt: formattedDelivery,
      };
    });

    if (!po) {
      return { result: 'po_not_found' } as const;
    }

    if (!po.vendorPhone) {
      return { result: 'no_vendor_phone' } as const;
    }

    // ── Step 2: Send WhatsApp text to vendor ──────────────────────────────────
    const sendResult = await step.run('send-po-whatsapp', async () => {
      const vendorName = po.vendorContactName ?? 'Vendor';
      const deliveryLine = po.expectedDeliveryAt
        ? po.expectedDeliveryAt
        : 'TBD';

      const messageText =
        `Hello ${vendorName},\n\n` +
        `Purchase Order ${po.poNumber} has been sent to you.\n` +
        `Amount: please check details.\n` +
        `Expected Delivery: ${deliveryLine}\n\n` +
        `Please reply CONFIRMED to acknowledge this PO.\n\n` +
        `Thank you.`;

      // Use the shared helper — never call the Meta Graph API directly.
      const { messageId } = await whatsapp.send({
        type: 'text',
        to: po.vendorPhone as string,
        text: messageText,
      });

      await db
        .update(purchaseOrders)
        .set({ status: 'sent', waMessageId: messageId })
        .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

      return { sent: true, messageId } as const;
    });

    // ── Step 3: Wait 24 hours for vendor acknowledgement ─────────────────────
    await step.sleep('wait-24h', '24h');

    // ── Step 4: Check if PO was acknowledged; fire alert if not ───────────────
    await step.run('check-acknowledgement', async () => {
      const [current] = await db
        .select({ status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

      if (!current || current.status !== 'sent') {
        // Vendor has already acknowledged (or PO was updated) — nothing to do.
        return { acknowledged: true };
      }

      // Still in 'sent' state after 24 hours — fire a no-acknowledgement event.
      await step.sendEvent('fire-no-ack-event', {
        name: 'po/no_acknowledgement',
        data: { poId, tenantId },
      });

      return { acknowledged: false, eventFired: 'po/no_acknowledgement' };
    });

    return {
      result: 'complete',
      poId,
      sent: sendResult.sent,
      messageId: sendResult.messageId,
    };
  },
);
