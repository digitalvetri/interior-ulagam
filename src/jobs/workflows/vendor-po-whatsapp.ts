import { and, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { purchaseOrders } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import { logPendingWorkflow } from '@/jobs/queue';
import { schedulePoAckCheck } from '@/jobs/workflows/schedule';

/**
 * Sends a purchase order to its vendor over WhatsApp, then checks 24 hours later
 * whether the vendor acknowledged it.
 *
 * The wait is a separate delayed job keyed `po:<poId>:ack-check`, cancelled when
 * the PO is acknowledged or cancelled — see cancelPoAckCheck.
 *
 * Vendor ACK webhook integration (still outstanding): when a vendor replies
 * 'CONFIRMED' / 'confirmed' / 'ok', the inbound WhatsApp webhook should find the
 * most recent purchaseOrder in status 'sent' for that phone, mark it
 * acknowledged, and call cancelPoAckCheck(poId).
 */
export interface PoData {
  poId: string;
  tenantId: string;
}

export const vendorPoSend = defineJob(
  { id: 'vendor-po-send', name: 'Vendor PO — send over WhatsApp' },
  { event: 'po/sent' },
  async ({ event }) => {
    const { poId, tenantId } = event.data as PoData;

    const [po] = await db
      .select({
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        vendorPhone: purchaseOrders.vendorPhone,
        vendorContactName: purchaseOrders.vendorContactName,
        expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
        waMessageId: purchaseOrders.waMessageId,
      })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

    if (!po) return { result: 'po_not_found' };
    if (!po.vendorPhone) return { result: 'no_vendor_phone' };

    // Idempotency guard. A retry re-runs this handler from the top, and without
    // this the vendor would receive the same purchase order twice.
    if (po.waMessageId) {
      await schedulePoAckCheck({ poId, tenantId }, poId);
      return { result: 'already_sent', messageId: po.waMessageId };
    }

    const vendorName = po.vendorContactName ?? 'Vendor';
    const deliveryLine = po.expectedDeliveryAt
      ? new Date(po.expectedDeliveryAt).toLocaleDateString('en-IN')
      : 'TBD';

    const { messageId } = await whatsapp.send({
      type: 'text',
      to: po.vendorPhone,
      text:
        `Hello ${vendorName},\n\n` +
        `Purchase Order ${po.poNumber} has been sent to you.\n` +
        `Amount: please check details.\n` +
        `Expected Delivery: ${deliveryLine}\n\n` +
        `Please reply CONFIRMED to acknowledge this PO.\n\n` +
        `Thank you.`,
    });

    await db
      .update(purchaseOrders)
      .set({ status: 'sent', waMessageId: messageId })
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

    await schedulePoAckCheck({ poId, tenantId }, poId);
    return { sent: true, messageId };
  },
);

export const vendorPoAckCheck = defineJob(
  { id: 'vendor-po-ack-check', name: 'Vendor PO — acknowledgement check' },
  { event: 'po/ack-check' },
  async ({ event }) => {
    const { poId, tenantId } = event.data as PoData;

    const [current] = await db
      .select({ status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)));

    if (!current || current.status !== 'sent') {
      // Acknowledged already, or the PO moved on — nothing to chase.
      return { acknowledged: true };
    }

    // 'po/no_acknowledgement' never had a consumer under Inngest either, so it is
    // logged rather than enqueued as work nothing would pick up.
    logPendingWorkflow('po/no_acknowledgement', { poId, tenantId });
    return { acknowledged: false };
  },
);
