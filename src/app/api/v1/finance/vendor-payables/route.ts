import { NextResponse } from 'next/server';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purchaseOrders, vendors, vendorPayments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

interface PoLine { totalPaise?: number; qty?: number; unitRatePaise?: number }

function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as PoLine[]).reduce((sum, l) => {
    if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
    const qty  = typeof l.qty           === 'number' ? l.qty           : 0;
    const rate = typeof l.unitRatePaise  === 'number' ? l.unitRatePaise  : 0;
    return sum + qty * rate;
  }, 0);
}

// GET /api/v1/finance/vendor-payables — vendor-grouped payables for the Finance tab
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const poRows = await db
      .select({
        poId:      purchaseOrders.id,
        vendorId:  purchaseOrders.vendorId,
        vendorName: vendors.name,
        linesJson:  purchaseOrders.linesJson,
        status:     purchaseOrders.status,
      })
      .from(purchaseOrders)
      .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
      .where(
        and(
          eq(purchaseOrders.tenantId, ctx.tenantId),
          ne(purchaseOrders.status, 'cancelled'),
        ),
      );

    // Sum actual payments per PO
    const vpRows = await db
      .select({ purchaseOrderId: vendorPayments.purchaseOrderId, amountPaise: vendorPayments.amountPaise })
      .from(vendorPayments)
      .where(eq(vendorPayments.tenantId, ctx.tenantId));

    const paidByPo = new Map<string, number>();
    for (const vp of vpRows) {
      if (!vp.purchaseOrderId) continue;
      paidByPo.set(vp.purchaseOrderId, (paidByPo.get(vp.purchaseOrderId) ?? 0) + vp.amountPaise);
    }

    // Group by vendor
    const byVendor = new Map<string, {
      vendorId: string;
      vendorName: string;
      poCount: number;
      totalOrderedPaise: number;
      advancePaidPaise: number;
    }>();

    for (const row of poRows) {
      const key     = row.vendorId ?? '__no_vendor__';
      const name    = row.vendorName ?? 'Unknown vendor';
      const ordered = poTotalPaise(row.linesJson);
      const paid    = paidByPo.get(row.poId) ?? 0;

      if (!byVendor.has(key)) {
        byVendor.set(key, { vendorId: key, vendorName: name, poCount: 0, totalOrderedPaise: 0, advancePaidPaise: 0 });
      }
      const entry = byVendor.get(key)!;
      entry.poCount          += 1;
      entry.totalOrderedPaise += ordered;
      entry.advancePaidPaise  += paid;
    }

    const data = Array.from(byVendor.values())
      .filter(v => v.totalOrderedPaise > 0)
      .sort((a, b) =>
        (b.totalOrderedPaise - b.advancePaidPaise) -
        (a.totalOrderedPaise - a.advancePaidPaise),
      )
      .map(v => ({
        ...v,
        netPayablePaise: Math.max(0, v.totalOrderedPaise - v.advancePaidPaise),
      }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/v1/finance/vendor-payables]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
