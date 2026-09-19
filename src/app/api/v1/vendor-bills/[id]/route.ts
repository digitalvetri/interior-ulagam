import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses, purchaseOrders, vendors, projects, vendorPayments, grns } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

function derivedStatus(
  voidedAt: Date | null,
  totalPaise: number,
  paidPaise: number,
): 'void' | 'paid' | 'partial' | 'unpaid' {
  if (voidedAt)             return 'void';
  if (paidPaise >= totalPaise && totalPaise > 0) return 'paid';
  if (paidPaise > 0)        return 'partial';
  return 'unpaid';
}

// GET /api/v1/vendor-bills/[id]
// Returns enriched vendor bill: expense + PO + GRN events + bill payments + derived status.
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: billId } = await params;

  // Fetch the expense (vendor bill)
  const [bill] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, billId), eq(expenses.tenantId, ctx.tenantId)))
    .limit(1);

  if (!bill) return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
  if (!bill.poId) return NextResponse.json({ error: 'This expense is not linked to a purchase order' }, { status: 400 });

  // Fetch the PO with vendor + project
  const [poRow] = await db
    .select({
      id:          purchaseOrders.id,
      poNumber:    purchaseOrders.poNumber,
      linesJson:   purchaseOrders.linesJson,
      status:      purchaseOrders.status,
      vendorName:  vendors.name,
      vendorId:    purchaseOrders.vendorId,
      projectId:   purchaseOrders.projectId,
      projectName: projects.name,
    })
    .from(purchaseOrders)
    .leftJoin(vendors,  eq(purchaseOrders.vendorId,  vendors.id))
    .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
    .where(and(eq(purchaseOrders.id, bill.poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  // Fetch GRN delivery events for this PO (active only, deduplicated by grnNumber)
  const grnRows = await db
    .select({
      grnNumber:    grns.grnNumber,
      deliveryDate: grns.deliveryDate,
      receivedAt:   grns.receivedAt,
    })
    .from(grns)
    .where(and(
      eq(grns.poId, bill.poId),
      eq(grns.tenantId, ctx.tenantId),
      ne(grns.status, 'void'),
    ))
    .orderBy(grns.receivedAt);

  // Deduplicate GRNs into delivery events
  const grnMap = new Map<string, { grnNumber: string | null; deliveryDate: string | null; receivedAt: string; lineCount: number }>();
  for (const g of grnRows) {
    const key = g.grnNumber ?? `legacy-${g.receivedAt.toISOString()}`;
    const existing = grnMap.get(key);
    if (!existing) {
      grnMap.set(key, { grnNumber: g.grnNumber, deliveryDate: g.deliveryDate, receivedAt: g.receivedAt.toISOString(), lineCount: 1 });
    } else {
      existing.lineCount++;
    }
  }
  const grnEvents = Array.from(grnMap.values());

  // Fetch payments specifically linked to this bill
  const billPayments = await db
    .select({
      id:             vendorPayments.id,
      expenseId:      vendorPayments.expenseId,
      purchaseOrderId: vendorPayments.purchaseOrderId,
      amountPaise:    vendorPayments.amountPaise,
      method:         vendorPayments.method,
      reference:      vendorPayments.reference,
      note:           vendorPayments.note,
      paidAt:         vendorPayments.paidAt,
      createdAt:      vendorPayments.createdAt,
    })
    .from(vendorPayments)
    .where(and(
      eq(vendorPayments.expenseId, billId),
      eq(vendorPayments.tenantId, ctx.tenantId),
    ))
    .orderBy(vendorPayments.paidAt);

  const totalPaise = bill.amountPaise + bill.gstAmountPaise;
  const paidPaise  = billPayments.reduce((s, p) => s + p.amountPaise, 0);

  return NextResponse.json({
    data: {
      bill: {
        ...bill,
        voidedAt:  bill.voidedAt?.toISOString()  ?? null,
        paidAt:    bill.paidAt?.toISOString()     ?? null,
        approvedAt: bill.approvedAt?.toISOString() ?? null,
        createdAt: bill.createdAt.toISOString(),
        updatedAt: bill.updatedAt.toISOString(),
      },
      po: poRow ? {
        id:          poRow.id,
        poNumber:    poRow.poNumber,
        linesJson:   poRow.linesJson,
        status:      poRow.status,
        vendorName:  poRow.vendorName  ?? bill.vendorName ?? null,
        vendorId:    poRow.vendorId    ?? null,
        projectId:   poRow.projectId   ?? null,
        projectName: poRow.projectName ?? null,
      } : null,
      grnEvents,
      payments: billPayments.map(p => ({
        ...p,
        paidAt:    p.paidAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      derived: {
        totalPaise,
        paidPaise,
        balancePaise: Math.max(0, totalPaise - paidPaise),
        status: derivedStatus(bill.voidedAt, totalPaise, paidPaise),
      },
    },
  });
}

// DELETE /api/v1/vendor-bills/[id]  →  void the bill
// Blocked if any payments exist against this bill.
export async function DELETE(
  _req: NextRequest,
  { params }: Params,
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: billId } = await params;

  const [bill] = await db
    .select({ id: expenses.id, voidedAt: expenses.voidedAt })
    .from(expenses)
    .where(and(eq(expenses.id, billId), eq(expenses.tenantId, ctx.tenantId)))
    .limit(1);

  if (!bill) return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
  if (bill.voidedAt) return NextResponse.json({ error: 'Bill is already voided' }, { status: 409 });

  // Block void if any payments exist
  const [existingPayment] = await db
    .select({ id: vendorPayments.id })
    .from(vendorPayments)
    .where(and(
      eq(vendorPayments.expenseId, billId),
      eq(vendorPayments.tenantId, ctx.tenantId),
    ))
    .limit(1);

  if (existingPayment) {
    return NextResponse.json({
      error: 'Cannot void a bill that has recorded payments. Reverse the payments first.',
    }, { status: 409 });
  }

  const [updated] = await db
    .update(expenses)
    .set({ voidedAt: new Date() })
    .where(and(eq(expenses.id, billId), eq(expenses.tenantId, ctx.tenantId)))
    .returning({ id: expenses.id, voidedAt: expenses.voidedAt });

  return NextResponse.json({ data: updated });
}
