import { NextResponse } from 'next/server';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purchaseOrders, vendors } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

interface PoLine { qty?: number; ratePaise?: number }

function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as PoLine[]).reduce((sum, l) => {
    const qty  = typeof l.qty      === 'number' ? l.qty      : 0;
    const rate = typeof l.ratePaise === 'number' ? l.ratePaise : 0;
    return sum + qty * rate;
  }, 0);
}

// GET /api/v1/finance/vendor-payables — all-vendor payable summary for tenant
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db
      .select({
        poId:             purchaseOrders.id,
        vendorId:         purchaseOrders.vendorId,
        vendorName:       vendors.name,
        linesJson:        purchaseOrders.linesJson,
        advancePaidPaise: purchaseOrders.advancePaidPaise,
        status:           purchaseOrders.status,
      })
      .from(purchaseOrders)
      .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
      .where(
        and(
          eq(purchaseOrders.tenantId, ctx.tenantId),
          ne(purchaseOrders.status, 'cancelled'),
        ),
      );

    // Group by vendor
    const byVendor = new Map<string, {
      vendorId: string;
      vendorName: string;
      poCount: number;
      totalOrderedPaise: number;
      advancePaidPaise: number;
    }>();

    for (const row of rows) {
      const key = row.vendorId ?? '__no_vendor__';
      const name = row.vendorName ?? 'Unknown vendor';
      const ordered = poTotalPaise(row.linesJson);

      if (!byVendor.has(key)) {
        byVendor.set(key, {
          vendorId: key,
          vendorName: name,
          poCount: 0,
          totalOrderedPaise: 0,
          advancePaidPaise: 0,
        });
      }
      const entry = byVendor.get(key)!;
      entry.poCount          += 1;
      entry.totalOrderedPaise += ordered;
      entry.advancePaidPaise  += row.advancePaidPaise;
    }

    const data = Array.from(byVendor.values())
      .filter(v => v.totalOrderedPaise > 0)
      .sort((a, b) => (b.totalOrderedPaise - b.advancePaidPaise) - (a.totalOrderedPaise - a.advancePaidPaise))
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
