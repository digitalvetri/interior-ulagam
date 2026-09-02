import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseOrders, projects, vendors } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, count, desc } from 'drizzle-orm';

const PO_STATUSES = [
  'draft',
  'sent',
  'acknowledged',
  'partial',
  'complete',
  'cancelled',
] as const;

const CreatePurchaseOrderSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  linesJson: z.array(z.record(z.unknown())).min(1),
  expectedDeliveryAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const status = searchParams.get('status');

  if (status) {
    const statusParsed = z.enum(PO_STATUSES).safeParse(status);
    if (!statusParsed.success) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }
  }

  try {
    const conditions = [eq(purchaseOrders.tenantId, ctx.tenantId)];

    if (projectId) {
      conditions.push(eq(purchaseOrders.projectId, projectId));
    }

    if (status) {
      const validStatus = status as (typeof PO_STATUSES)[number];
      conditions.push(eq(purchaseOrders.status, validStatus));
    }

    const rows = await db
      .select({
        id:                  purchaseOrders.id,
        tenantId:            purchaseOrders.tenantId,
        projectId:           purchaseOrders.projectId,
        vendorId:            purchaseOrders.vendorId,
        vendorContactName:   purchaseOrders.vendorContactName,
        vendorPhone:         purchaseOrders.vendorPhone,
        poNumber:            purchaseOrders.poNumber,
        linesJson:           purchaseOrders.linesJson,
        status:              purchaseOrders.status,
        advancePaidPaise:    purchaseOrders.advancePaidPaise,
        expectedDeliveryAt:  purchaseOrders.expectedDeliveryAt,
        pdfUrl:              purchaseOrders.pdfUrl,
        createdAt:           purchaseOrders.createdAt,
        projectName:         projects.name,
        vendorName:          vendors.name,
      })
      .from(purchaseOrders)
      .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
      .leftJoin(vendors,  eq(purchaseOrders.vendorId,  vendors.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt));

    // Compute line count and total paise from linesJson
    const enriched = rows.map((po) => {
      const lines = Array.isArray(po.linesJson) ? (po.linesJson as Record<string, unknown>[]) : [];
      const lineCount = lines.length;
      const totalPaise = lines.reduce((sum, l) => {
        const qty      = typeof l.qty === 'number' ? l.qty : 0;
        const rate     = typeof l.ratePaise === 'number' ? l.ratePaise
                       : typeof l.rate === 'number' ? l.rate * 100 : 0;
        return sum + qty * rate;
      }, 0);
      return { ...po, lineCount, totalPaise };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('[purchase-orders GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreatePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Auto-generate PO number: count all POs for this tenant + 1, format PO-YYYY-NNN
    const [{ value: poCountRaw }] = await db
      .select({ value: count() })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.tenantId, ctx.tenantId));

    const poSequence = Number(poCountRaw) + 1;
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-${String(poSequence).padStart(3, '0')}`;

    const [po] = await db
      .insert(purchaseOrders)
      .values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        vendorId: input.vendorId ?? null,
        poNumber,
        linesJson: input.linesJson,
        status: 'draft',
        advancePaidPaise: 0,
        expectedDeliveryAt: input.expectedDeliveryAt
          ? new Date(input.expectedDeliveryAt)
          : null,
      })
      .returning();

    return NextResponse.json({ data: po, message: 'Purchase order created' }, { status: 201 });
  } catch (err) {
    console.error('[purchase-orders POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
