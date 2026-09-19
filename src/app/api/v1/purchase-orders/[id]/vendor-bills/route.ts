import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { expenses, purchaseOrders, vendors } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, count } from 'drizzle-orm';

const GST_RATES = [0, 5, 12, 18, 28] as const;

const CreateVendorBillSchema = z.object({
  amountPaise:    z.number().int().positive('Bill amount must be positive'),
  gstPct:         z.number().refine(v => (GST_RATES as readonly number[]).includes(v), { message: 'GST % must be 0, 5, 12, 18, or 28' }).default(0),
  gstAmountPaise: z.number().int().nonnegative().default(0),
  dueDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description:    z.string().optional(),
});

// GET /api/v1/purchase-orders/[id]/vendor-bills
// Returns all vendor bills (expenses) linked to this PO, newest first.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: poId } = await params;

  try {
    const [po] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
      .limit(1);

    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const rows = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.poId, poId), eq(expenses.tenantId, ctx.tenantId)))
      .orderBy(desc(expenses.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[purchase-orders/:id/vendor-bills GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/purchase-orders/[id]/vendor-bills
// Creates an expense (category='material', payeeType='vendor') linked to this PO.
// Auto-fills vendorId, vendorName, projectId from the PO.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: poId } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = CreateVendorBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Load PO with vendor details
    const [poRow] = await db
      .select({
        id:               purchaseOrders.id,
        projectId:        purchaseOrders.projectId,
        vendorId:         purchaseOrders.vendorId,
        vendorContactName: purchaseOrders.vendorContactName,
        status:           purchaseOrders.status,
        poNumber:         purchaseOrders.poNumber,
        vendorName:       vendors.name,
      })
      .from(purchaseOrders)
      .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
      .limit(1);

    if (!poRow) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (poRow.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot create a vendor bill for a cancelled PO.' }, { status: 409 });
    }

    // Generate expense number
    const [{ expCount }] = await db
      .select({ expCount: count() })
      .from(expenses)
      .where(eq(expenses.tenantId, ctx.tenantId));

    const expenseNumber = `EXP-${String(Number(expCount) + 1).padStart(4, '0')}`;

    const resolvedVendorName = poRow.vendorName ?? poRow.vendorContactName ?? null;

    const [expense] = await db
      .insert(expenses)
      .values({
        tenantId:       ctx.tenantId,
        projectId:      poRow.projectId,
        poId,
        category:       'material',
        payeeType:      'vendor',
        vendorId:       poRow.vendorId ?? null,
        vendorName:     resolvedVendorName,
        amountPaise:    input.amountPaise,
        gstPct:         input.gstPct,
        gstAmountPaise: input.gstAmountPaise,
        description:    input.description ?? `Vendor bill for ${poRow.poNumber}`,
        loggedBy:       ctx.dbUserId ?? null,
        loggedVia:      'manual',
        dueDate:        input.dueDate ?? null,
        expenseNumber,
      })
      .returning();

    return NextResponse.json({ data: expense, message: 'Vendor bill created' }, { status: 201 });
  } catch (err) {
    console.error('[purchase-orders/:id/vendor-bills POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
