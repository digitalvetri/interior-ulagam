import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purchaseOrders, vendors, projects, vendorPayments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

interface PoLine { totalPaise?: number; qty?: number; unitRatePaise?: number }

function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as PoLine[]).reduce((sum, l) => {
    if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
    const qty  = typeof l.qty          === 'number' ? l.qty          : 0;
    const rate = typeof l.unitRatePaise === 'number' ? l.unitRatePaise : 0;
    return sum + qty * rate;
  }, 0);
}

// GET /api/v1/finance/overview — PO-level payables for the standalone /vendor-payables page
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const poRows = await db
      .select({
        id:          purchaseOrders.id,
        vendorName:  vendors.name,
        projectName: projects.name,
        poNumber:    purchaseOrders.poNumber,
        linesJson:   purchaseOrders.linesJson,
        status:      purchaseOrders.status,
      })
      .from(purchaseOrders)
      .leftJoin(vendors,  eq(purchaseOrders.vendorId,  vendors.id))
      .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
      .where(
        and(
          eq(purchaseOrders.tenantId, ctx.tenantId),
          ne(purchaseOrders.status, 'cancelled'),
        ),
      );

    const vpRows = await db
      .select({ purchaseOrderId: vendorPayments.purchaseOrderId, amountPaise: vendorPayments.amountPaise })
      .from(vendorPayments)
      .where(eq(vendorPayments.tenantId, ctx.tenantId));

    const paidByPo = new Map<string, number>();
    for (const vp of vpRows) {
      if (!vp.purchaseOrderId) continue;
      paidByPo.set(vp.purchaseOrderId, (paidByPo.get(vp.purchaseOrderId) ?? 0) + vp.amountPaise);
    }

    const vendorPayables = poRows
      .map(po => ({
        id:                 po.id,
        vendor_name:        po.vendorName  ?? 'Unknown vendor',
        project_name:       po.projectName ?? 'Unknown project',
        po_number:          po.poNumber,
        total_amount_paise: poTotalPaise(po.linesJson),
        paid_amount_paise:  paidByPo.get(po.id) ?? 0,
        status:             po.status,
      }))
      .filter(r => r.total_amount_paise > 0)
      .sort((a, b) =>
        (b.total_amount_paise - b.paid_amount_paise) -
        (a.total_amount_paise - a.paid_amount_paise),
      );

    return NextResponse.json({ data: { vendorPayables } });
  } catch (err) {
    console.error('[GET /api/v1/finance/overview]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
