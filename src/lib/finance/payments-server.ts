import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, invoices, milestones, payments, projects } from '@/lib/db/schema';
import { allocatePayment, customerProjectIds } from '@/lib/project-money/server';
import { PAYMENT_SETTLED } from './constants';
import { invoiceStatusFor, invoiceTotalPaise } from './gst';
import { nextReceiptNumber, retryOnUniqueViolation } from './receipt-number';

// Client-payment writes shared by every route that records money coming in.
// All queries are tenant-scoped.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/**
 * Re-derive an invoice's status from the settled payments against it.
 * Void invoices are never touched. A draft with nothing received stays draft;
 * once money arrives it is issued (issued_at stamped if missing) so it shows in
 * receivables and the GST report.
 */
export async function syncInvoiceStatus(tx: Db, tenantId: string, invoiceId: string): Promise<void> {
  const [inv] = await tx.select({
    status: invoices.status, subtotalPaise: invoices.subtotalPaise, cgstPaise: invoices.cgstPaise,
    sgstPaise: invoices.sgstPaise, igstPaise: invoices.igstPaise,
  }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
  if (!inv || inv.status === 'void') return;

  const [{ paidPaise }] = await tx
    .select({ paidPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), eq(payments.invoiceId, invoiceId), ne(payments.status, 'pending')));

  if (inv.status === 'draft' && paidPaise === 0) return;
  const status = invoiceStatusFor(invoiceTotalPaise(inv), paidPaise);
  await tx.update(invoices)
    .set({ status, issuedAt: sql`coalesce(${invoices.issuedAt}, now())` })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId), ne(invoices.status, 'void')));
}

export interface RecordPaymentInput {
  amountPaise: number;
  mode: 'upi' | 'cash' | 'bank' | 'cheque' | 'card' | 'razorpay';
  reference?: string | null;
  receivedAt?: Date;
  note?: string | null;
  invoiceId?: string | null;
  projectId?: string | null;
  customerId?: string | null;
  allocations?: { milestoneId: string; amountPaise: number }[];
  /** Require a project (directly or through the invoice) — no orphan receipts. */
  requireProject?: boolean;
}

export type RecordPaymentResult =
  | { ok: true; payment: typeof payments.$inferSelect; allocatedPaise: number; advancePaise: number }
  | { ok: false; status: number; error: string };

/** Record a manual receipt: numbered, tied to project/client, allocated to milestones, invoice status synced. */
export async function recordClientPayment(tenantId: string, userId: string | null, d: RecordPaymentInput): Promise<RecordPaymentResult> {
  let projectId = d.projectId ?? null;
  let customerId = d.customerId ?? null;
  let allocations = d.allocations;

  if (d.invoiceId) {
    const [inv] = await db.select({ projectId: invoices.projectId, status: invoices.status })
      .from(invoices).where(and(eq(invoices.id, d.invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
    if (!inv) return { ok: false, status: 404, error: 'Invoice not found' };
    if (inv.status === 'void') return { ok: false, status: 409, error: 'This invoice is void — payments cannot be recorded against it.' };
    if (projectId && projectId !== inv.projectId) {
      return { ok: false, status: 422, error: 'That invoice belongs to a different project.' };
    }
    projectId = inv.projectId;
    // Money against a milestone's invoice goes to that milestone first.
    if (!allocations?.length) {
      const [ms] = await db.select({ id: milestones.id }).from(milestones)
        .where(and(eq(milestones.tenantId, tenantId), eq(milestones.invoiceId, d.invoiceId))).limit(1);
      if (ms) allocations = [{ milestoneId: ms.id, amountPaise: d.amountPaise }];
    }
  }

  if (projectId) {
    const [proj] = await db.select({ customerId: projects.customerId }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
    if (!proj) return { ok: false, status: 404, error: 'Project not found' };
    if (customerId) {
      const owned = await customerProjectIds(tenantId, customerId);
      if (!owned.some(p => p.id === projectId)) return { ok: false, status: 422, error: 'That project does not belong to this client.' };
    }
    customerId = customerId ?? proj.customerId;
  } else if (d.requireProject) {
    return { ok: false, status: 422, error: 'Pick the project (or invoice) this payment is for.' };
  }
  if (customerId) {
    const [cust] = await db.select({ id: customers.id }).from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId))).limit(1);
    if (!cust) return { ok: false, status: 404, error: 'Client not found' };
  }
  if (allocations && allocations.reduce((s, a) => s + a.amountPaise, 0) > d.amountPaise) {
    // Only reachable for an explicit split; the invoice default above equals the amount.
    return { ok: false, status: 422, error: 'The split adds up to more than the payment.' };
  }
  if (allocations?.length && !projectId) return { ok: false, status: 422, error: 'Pick the project to apply this payment to.' };

  const receivedAt = d.receivedAt ?? new Date();
  const result = await retryOnUniqueViolation(() => db.transaction(async (tx) => {
    const receiptNumber = await nextReceiptNumber(tx, tenantId);
    const [row] = await tx.insert(payments).values({
      tenantId, invoiceId: d.invoiceId ?? null, projectId, customerId,
      amountPaise: d.amountPaise, status: PAYMENT_SETTLED, mode: d.mode,
      reference: d.reference ?? null, receivedAt, recordedBy: userId, note: d.note ?? null, receiptNumber,
    }).returning();
    const allocation = projectId
      ? await allocatePayment(tx, tenantId, row.id, projectId, d.amountPaise, allocations)
      : { allocatedPaise: 0, advancePaise: d.amountPaise };
    if (d.invoiceId) await syncInvoiceStatus(tx, tenantId, d.invoiceId);
    return { row, allocation };
  }));

  return { ok: true, payment: result.row, ...result.allocation };
}
